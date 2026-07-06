import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export interface SentryConfig {
    localeDir: string;
    scanDir: string;
    locales: string[];
    sourceLocale: string;
    ignoreKeys: string[];
    ignoreRawText: string[];
    textAttributes: string[];
    warnAttributes: string[];
}

export interface LocaleMap {
    [locale: string]: Record<string, string>;
}

export interface Issue {
    key: string;
    locale?: string;
    msg?: string;
    missingIn?: string[];
}

export interface FileIssue {
    file: string;
    line: number;
    key?: string;
    text?: string;
    missingIn?: string[];
}

const CONFIG_FILE = "i18n-sentry.config.json";

const EXAMPLE_CONFIG: SentryConfig = {
    localeDir: "./src/ui/i18n/locales",
    scanDir: "./src/ui",
    locales: ["de", "en"],
    sourceLocale: "de",
    ignoreKeys: [],
    ignoreRawText: [],
    textAttributes: [],
    warnAttributes: [],
};

export function loadConfig(): SentryConfig {
    const configPath = resolve(process.cwd(), CONFIG_FILE);

    if (!existsSync(configPath)) {
        console.error(`\n  Config file not found: ${CONFIG_FILE}`);
        console.error(`    Create a ${CONFIG_FILE} in your project root.\n`);
        console.error(`    Example:`);
        console.error(JSON.stringify(EXAMPLE_CONFIG, null, 4));
        process.exit(1);
    }

    const raw = JSON.parse(readFileSync(configPath, "utf8"));

    return {
        localeDir: raw.localeDir,
        scanDir: raw.scanDir,
        locales: raw.locales ?? ["de", "en"],
        sourceLocale: raw.sourceLocale ?? raw.locales?.[0] ?? "de",
        ignoreKeys: raw.ignoreKeys ?? [],
        ignoreRawText: raw.ignoreRawText ?? [],
        textAttributes: raw.textAttributes ?? [],
        warnAttributes: raw.warnAttributes ?? [],
    };
}

// ── Extractor Interface ───────────────────────────────────────────────────────

export interface Extractor {
    extractI18nKeys(source: string): { key: string; line: number }[];
    extractRawTextNodes(source: string, config: SentryConfig): FileIssue[];
    extractRawAttributes?(
        source: string,
        errorAttrs: Set<string>,
        warnAttrs: Set<string>,
        config: SentryConfig
    ): { issue: FileIssue; level: "error" | "warning" }[];
}
