#!/usr/bin/env node
// Sorts configured locale JSON files alphabetically (nested, recursive)
// Only sorts the configured locale files — never touches other JSON files

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { bold, cyan, green, red } from "../utils/colors.js";

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_FILE = "i18n-sentry.config.json";

function loadConfig() {
    const configPath = resolve(process.cwd(), CONFIG_FILE);
    if (!existsSync(configPath)) {
        console.error(`${red("X")}  Config file not found: ${CONFIG_FILE}`);
        process.exit(1);
    }
    return JSON.parse(readFileSync(configPath, "utf8"));
}

const config = loadConfig();
const LOCALES: string[] = config.locales ?? ["de", "en"];

// ── Sort ──────────────────────────────────────────────────────────────────────

function sortJson(obj: unknown): unknown {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return obj;
    return Object.keys(obj as Record<string, unknown>)
        .sort((a, b) => a.localeCompare(b))
        .reduce((acc: Record<string, unknown>, key) => {
            acc[key] = sortJson((obj as Record<string, unknown>)[key]);
            return acc;
        }, {});
}

function sortLocaleFile(localePath: string): boolean {
    const raw = readFileSync(localePath, "utf8");
    const parsed = JSON.parse(raw);
    const sorted = sortJson(parsed);
    const output = JSON.stringify(sorted, null, 2) + "\n";

    if (raw === output) {
        console.log(`  ${cyan(localePath)}  already sorted`);
        return false;
    }

    writeFileSync(localePath, output, "utf8");
    console.log(`  ${green("✓")} ${cyan(localePath)}  sorted`);
    return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
    console.log(`\n${bold("i18n-sentry")} – sort locales\n`);

    let changed = 0;
    for (const locale of LOCALES) {
        const path = resolve(process.cwd(), `${config.localeDir}/${locale}.json`);
        if (!existsSync(path)) {
            console.error(red(`X  Locale file not found: ${path}`));
            process.exit(1);
        }
        if (sortLocaleFile(path)) changed++;
    }

    console.log(`\n${changed} file(s) updated\n`);
}

main();
