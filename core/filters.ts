import type { SentryConfig } from "./config.js";

const IGNORE_TEXT_PATTERNS = [/^[·•\-–—\/\\|x×+*#@%^&()[\]{}<>!?,.:;"'`~=_]$/, /^\s*$/, /^.$/, /^\d+$/, /^v-/];

const BASE_IGNORE_TEXT = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "Normal"]);

const NON_I18N_CALLS = new Set([
    "emit",
    "import",
    "querySelector",
    "querySelectorAll",
    "createElement",
    "getContext",
    "getElementById",
    "getElementsByClassName",
    "getAttribute",
    "setAttribute",
    "addEventListener",
    "removeEventListener",
    "appendChild",
    "insertBefore",
    "removeChild",
    "replaceChild",
]);

export function isIgnoredKey(key: string, config: SentryConfig): boolean {
    return config.ignoreKeys.some((pattern) => {
        if (pattern.endsWith(".*")) {
            const prefix = pattern.slice(0, -2);
            return key === prefix || key.startsWith(prefix + ".");
        }
        return key === pattern;
    });
}

export function isIgnoredText(text: string, config: SentryConfig): boolean {
    const ignoreExact = new Set([...BASE_IGNORE_TEXT, ...config.ignoreRawText]);
    if (ignoreExact.has(text)) return true;
    if (IGNORE_TEXT_PATTERNS.some((r) => r.test(text))) return true;
    if (!/[a-zA-ZäöüÄÖÜß]/.test(text)) return true;
    if (text.length <= 2) return true;
    return false;
}

export function isValidI18nKey(key: string, precedingWord?: string): boolean {
    if (precedingWord && NON_I18N_CALLS.has(precedingWord)) return false;
    if (key.includes(":")) return false;
    if (key.includes("/")) return false;
    if (key.includes("@")) return false;
    if (key.length <= 2) return false;
    if (/^[a-z0-9-]+$/.test(key) && !key.includes(".")) return false;
    return true;
}
