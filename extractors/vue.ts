import type { FileIssue, SentryConfig } from "../core/config.js";
import { isIgnoredText, isValidI18nKey } from "../core/filters.js";
import { getLine } from "../utils/files.js";

// ── Template Block ────────────────────────────────────────────────────────────

interface TemplateBlock {
    content: string;
    offset: number;
}

function extractTemplateBlock(source: string): TemplateBlock | null {
    // Find the outermost <template> by tracking open/close depth
    let firstOpen = -1;
    let depth = 0;
    let pos = 0;

    const openRe = /<template[\s>]/g;
    const closeRe = /<\/template>/g;

    while (pos < source.length) {
        openRe.lastIndex = pos;
        closeRe.lastIndex = pos;

        const nextOpen = openRe.exec(source);
        const nextClose = closeRe.exec(source);

        if (!nextOpen && !nextClose) break;

        const openIdx = nextOpen ? nextOpen.index : Infinity;
        const closeIdx = nextClose ? nextClose.index : Infinity;

        if (openIdx < closeIdx) {
            if (depth === 0) firstOpen = openIdx;
            depth++;
            pos = openIdx + 1;
        } else {
            depth--;
            if (depth === 0 && firstOpen !== -1) {
                const tagEnd = source.indexOf(">", firstOpen) + 1;
                const content = source.substring(tagEnd, nextClose!.index);
                return { content, offset: tagEnd };
            }
            pos = closeIdx + 1;
        }
    }

    return null;
}

// ── Extractors ────────────────────────────────────────────────────────────────

export function extractI18nKeys(source: string): { key: string; line: number }[] {
    const results: { key: string; line: number }[] = [];
    const re = /(?<![a-zA-Z0-9_])\$?t\(\s*(['"])([^'"\n]+)\1/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(source)) !== null) {
        const key = m[2];
        const before = source.substring(0, m.index).trimEnd();
        const prevWord = (before.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/) || [])[1];
        if (isValidI18nKey(key, prevWord)) {
            results.push({ key, line: getLine(source, m.index) });
        }
    }

    return results;
}

export function extractRawTextNodes(source: string, config: SentryConfig): FileIssue[] {
    const results: FileIssue[] = [];
    const block = extractTemplateBlock(source);
    if (!block) return results;

    const re = />([^<>{]+)</g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(block.content)) !== null) {
        const text = m[1].trim();
        if (!text) continue;
        if (text.startsWith("{{") || text.startsWith("//")) continue;
        if (text.includes("{") || text.includes("}")) continue;
        if (isIgnoredText(text, config)) continue;
        results.push({ file: "", line: getLine(source, block.offset + m.index), text });
    }

    return results;
}

export function extractRawAttributes(
    source: string,
    errorAttrs: Set<string>,
    warnAttrs: Set<string>,
    config: SentryConfig
): { issue: FileIssue; level: "error" | "warning" }[] {
    const results: { issue: FileIssue; level: "error" | "warning" }[] = [];
    const block = extractTemplateBlock(source);
    if (!block) return results;

    const re = /(?<![:\@])([\w-]+)="([^"{}]+)"/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(block.content)) !== null) {
        const attr = m[1];
        const value = m[2].trim();

        const isError = errorAttrs.has(attr);
        const isWarning = warnAttrs.has(attr);
        if (!isError && !isWarning) continue;
        if (isIgnoredText(value, config)) continue;

        results.push({
            issue: { file: "", line: getLine(source, block.offset + m.index), text: `${attr}="${value}"` },
            level: isError ? "error" : "warning",
        });
    }

    return results;
}
