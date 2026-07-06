import { bold, cyan, green, red, yellow } from "../utils/colors.js";
import type { FileIssue, Issue } from "./config.js";
export { bold, cyan, dim, green, red, yellow } from "../utils/colors.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByFile(items: FileIssue[]): Map<string, FileIssue[]> {
    const map = new Map<string, FileIssue[]>();
    for (const item of items) {
        if (!map.has(item.file)) map.set(item.file, []);
        map.get(item.file)!.push(item);
    }
    return map;
}

const HR = "─".repeat(80);

// ── Sections ──────────────────────────────────────────────────────────────────

export function printFileSection(
    title: string,
    items: FileIssue[],
    colorFn: (s: string) => string,
    renderItem: (item: FileIssue) => string
): void {
    if (items.length === 0) return;
    console.log(`\n${bold(colorFn(title))}`);
    console.log(HR);
    for (const [file, fileItems] of groupByFile(items)) {
        console.log(`\n${cyan(file)}`);
        for (const item of fileItems) {
            console.log(`  ${yellow("line " + String(item.line).padEnd(4))}  ${renderItem(item)}`);
        }
    }
}

export function printSimpleSection(
    title: string,
    items: Issue[],
    colorFn: (s: string) => string,
    renderItem: (item: Issue) => string
): void {
    if (items.length === 0) return;
    console.log(`\n${bold(colorFn(title))}`);
    console.log(HR);
    for (const item of items) {
        console.log(`  ${renderItem(item)}`);
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface SummaryInput {
    missingKeys: FileIssue[];
    hardcodedErrors: FileIssue[];
    hardcodedWarnings: FileIssue[];
    localeSyncIssues: Issue[];
    unusedKeys: Issue[];
    invalidKeys: Issue[];
    namespaceConflicts: Issue[];
    placeholderMismatches: Issue[];
    icuMismatches: Issue[];
}

export function printSummary(s: SummaryInput): void {
    console.log("\n" + HR);

    const errorCount =
        s.missingKeys.length +
        s.hardcodedErrors.length +
        s.localeSyncIssues.length +
        s.unusedKeys.length +
        s.invalidKeys.length +
        s.namespaceConflicts.length +
        s.placeholderMismatches.length +
        s.icuMismatches.length;

    const warningCount = s.hardcodedWarnings.length;

    if (errorCount === 0 && warningCount === 0) {
        console.log(green("✓  No i18n issues found!"));
    } else {
        const parts: string[] = [];
        if (errorCount > 0) parts.push(red(`${errorCount} error(s)`));
        if (warningCount > 0) parts.push(yellow(`${warningCount} warning(s)`));
        console.log(parts.join("  "));
    }

    console.log();
}

export function hasErrors(s: SummaryInput): boolean {
    return (
        s.missingKeys.length > 0 ||
        s.hardcodedErrors.length > 0 ||
        s.localeSyncIssues.length > 0 ||
        s.unusedKeys.length > 0 ||
        s.invalidKeys.length > 0 ||
        s.namespaceConflicts.length > 0 ||
        s.placeholderMismatches.length > 0 ||
        s.icuMismatches.length > 0
    );
}
