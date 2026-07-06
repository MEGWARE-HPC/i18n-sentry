// React extractor
// Supports:
//   react-i18next:
//     const { t } = useTranslation()
//     t('key')
//     <Trans i18nKey="key" />
//     this.props.t('key')  (withTranslation HOC)
//     i18n.t('key')
//     this.t('key')
//     t`Hello world`
//
//   react-intl:
//     <FormattedMessage id="key" />
//     intl.formatMessage({ id: 'key' })
//     useIntl() → intl.formatMessage({ id: 'key' })
//     defineMessages({ id: 'key' })

import type { FileIssue, SentryConfig } from "../core/config.js";
import { isIgnoredText, isValidI18nKey } from "../core/filters.js";
import { getLine } from "../utils/files.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripNonTextBlocks(source: string): string {
    return source.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
}

// ── Key Extractors ────────────────────────────────────────────────────────────

export function extractI18nKeys(source: string): { key: string; line: number }[] {
    const results: { key: string; line: number }[] = [];
    const seen = new Set<string>();

    function push(key: string, index: number) {
        const normalized = key.trim();
        if (!normalized || !isValidI18nKey(normalized)) return;

        const unique = `${normalized}@${index}`;
        if (seen.has(unique)) return;
        seen.add(unique);

        results.push({ key: normalized, line: getLine(source, index) });
    }

    let m: RegExpExecArray | null;

    // 1. t('key') — react-i18next core usage
    const tRe = /(?<![a-zA-Z0-9_])\$?t\(\s*(['"])([^'"\n]+)\1/g;
    while ((m = tRe.exec(source)) !== null) {
        const before = source.substring(0, m.index).trimEnd();
        const prevWord = (before.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/) || [])[1];

        const NON_I18N = new Set(["emit", "import", "querySelector", "createElement", "getContext"]);

        if (prevWord && NON_I18N.has(prevWord)) continue;
        push(m[2], m.index);
    }

    // 2. i18n.t('key') / this.t('key') — common real-world aliases
    const aliasRe = /(?:i18n\.t|this\.t)\(\s*(['"])([^'"\n]+)\1/g;
    while ((m = aliasRe.exec(source)) !== null) {
        push(m[2], m.index);
    }

    // 3. <Trans i18nKey="key" /> — react-i18next Trans component
    const transRe = /<Trans\b[^>]*\bi18nKey\s*=\s*['"]([^'"]+)['"]/g;
    while ((m = transRe.exec(source)) !== null) {
        push(m[1], m.index);
    }

    // 4. <FormattedMessage id="key" /> — react-intl
    const formattedMsgRe = /<FormattedMessage\b[^>]*\bid\s*=\s*['"]([^'"]+)['"]/g;
    while ((m = formattedMsgRe.exec(source)) !== null) {
        push(m[1], m.index);
    }

    // 5. intl.formatMessage({ id: 'key' }) — react-intl
    const formatMsgRe = /formatMessage\(\s*\{[^}]*\bid\s*:\s*(['"])([^'"]+)\1/g;
    while ((m = formatMsgRe.exec(source)) !== null) {
        push(m[2], m.index);
    }

    // 6. this.props.t('key') — withTranslation HOC (legacy)
    const propsTRe = /props\.t\(\s*(['"])([^'"]+)\1/g;
    while ((m = propsTRe.exec(source)) !== null) {
        push(m[2], m.index);
    }

    // 7. t`Hello world` — tagged template i18n pattern
    const tagRe = /(?<!\.)\bt\s*`\s*([^`]+)\s*`/g;
    while ((m = tagRe.exec(source)) !== null) {
        push(m[1], m.index);
    }

    // 8. defineMessages / id extraction — react-intl (basic heuristic)
    const defineMsgRe = /id\s*:\s*(['"])([^'"]+)\1/g;
    while ((m = defineMsgRe.exec(source)) !== null) {
        push(m[2], m.index);
    }

    return results;
}

// ── Hardcoded text ────────────────────────────────────────────────────────────

export function extractRawTextNodes(source: string, config: SentryConfig): FileIssue[] {
    const cleaned = stripNonTextBlocks(source);
    const results: FileIssue[] = [];

    // JSX text nodes between tags
    const re = />\s*([^<>{\n][^<>{}]*)\s*</g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(cleaned)) !== null) {
        const text = m[1].replace(/\s+/g, " ").trim();

        if (!text) continue;

        // reduce noise (numbers, braces, junk)
        if (text.length < 2 || /^[0-9]+$/.test(text) || /^[{}()[\]]+$/.test(text)) continue;

        if (text.startsWith("{") || text.startsWith("//")) continue;
        if (isIgnoredText(text, config)) continue;

        results.push({
            file: "",
            line: getLine(source, m.index),
            text,
        });
    }

    return results;
}

// ── Attributes ───────────────────────────────────────────────────────────────

export function extractRawAttributes(
    source: string,
    errorAttrs: Set<string>,
    warnAttrs: Set<string>,
    config: SentryConfig
): { issue: FileIssue; level: "error" | "warning" }[] {
    const results: { issue: FileIssue; level: "error" | "warning" }[] = [];

    // JSX attributes: attr="value" but not attr={...}
    const re = /(?<![:\@])([\w-]+)="([^"{}]+)"/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(source)) !== null) {
        const attr = m[1];
        const value = m[2].trim();

        const isError = errorAttrs.has(attr);
        const isWarning = warnAttrs.has(attr);

        if (!isError && !isWarning) continue;
        if (isIgnoredText(value, config)) continue;

        results.push({
            issue: {
                file: "",
                line: getLine(source, m.index),
                text: `${attr}="${value}"`,
            },
            level: isError ? "error" : "warning",
        });
    }

    return results;
}
