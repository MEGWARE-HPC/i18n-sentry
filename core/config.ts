import { existsSync, readFileSync, readdirSync, statSync } from "fs";
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

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".nuxt", ".output"]);

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

// ── Config Discovery ──────────────────────────────────────────────────────────

function findConfigPath(): string | null {
    // 1. Check root first
    const rootPath = resolve(process.cwd(), CONFIG_FILE);
    if (existsSync(rootPath)) return rootPath;

    // 2. Search subdirectories automatically (up to 2 levels deep)
    try {
        for (const entry of readdirSync(process.cwd())) {
            if (SKIP_DIRS.has(entry)) continue;
            const entryPath = resolve(process.cwd(), entry);
            try {
                if (!statSync(entryPath).isDirectory()) continue;
            } catch {
                continue;
            }

            const configPath = resolve(entryPath, CONFIG_FILE);
            if (existsSync(configPath)) return configPath;

            // One level deeper
            try {
                for (const sub of readdirSync(entryPath)) {
                    if (SKIP_DIRS.has(sub)) continue;
                    const subPath = resolve(entryPath, sub);
                    try {
                        if (!statSync(subPath).isDirectory()) continue;
                    } catch {
                        continue;
                    }

                    const subConfig = resolve(subPath, CONFIG_FILE);
                    if (existsSync(subConfig)) return subConfig;
                }
            } catch {}
        }
    } catch {}

    return null;
}

export function loadConfig(): SentryConfig {
    const configPath = findConfigPath();

    if (!configPath) {
        console.error(`\nX  Config file not found: ${CONFIG_FILE}`);
        console.error(`    Run setup to create one:\n`);
        console.error(`    npx i18n-sentry-setup\n`);
        console.error(`    Or create it manually:\n`);
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
