// ICU message parser for vue-i18n compatible syntax
// Supports: {variable}, {count, plural, ...}, {count, select, ...}, {'@'}, {'|'} escapes

export type IcuElementType = "text" | "variable" | "plural" | "select" | "escaped";

export interface IcuElement {
    type: IcuElementType;
    raw: string;
    variable?: string;
    content?: string;
}

export interface ParseResult {
    elements: IcuElement[];
    variables: string[];
    icuType: "simple" | "plural" | "select" | "selectordinal";
    errors: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripEscapes(input: string): string {
    return input.replace(/\{'.+?'\}/g, "");
}

function extractVariableName(inner: string): string {
    return inner.trim().split(/\s*,\s*/)[0];
}

/**
 * Extract only top-level {} blocks.
 * Correctly handles nested braces in ICU plural/select:
 *   "{count, plural, one {# Item} other {# Items}}" → one block, not three
 */
function extractTopLevelBlocks(input: string): string[] {
    const blocks: string[] = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        if (c === "{") {
            if (depth === 0) start = i;
            depth++;
        } else if (c === "}") {
            depth--;
            if (depth === 0 && start !== -1) {
                blocks.push(input.slice(start, i + 1));
                start = -1;
            }
        }
    }

    return blocks;
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseIcuMessage(value: string): ParseResult {
    const elements: IcuElement[] = [];
    const variables: string[] = [];
    const errors: string[] = [];
    let icuType: ParseResult["icuType"] = "simple";

    const stripped = stripEscapes(value);

    // Validate balanced braces
    let depth = 0;
    for (const char of stripped) {
        if (char === "{") depth++;
        else if (char === "}") depth--;
        if (depth < 0) {
            errors.push(`Unexpected closing } in: "${value}"`);
            break;
        }
    }
    if (depth > 0) {
        errors.push(`Unclosed { in: "${value}"`);
    }

    // Check for empty placeholders — only top-level {}
    if (extractTopLevelBlocks(stripped).some((b) => b === "{}")) {
        errors.push(`Empty placeholder {} in: "${value}"`);
    }

    // Check for unescaped @
    const strippedLinked = stripped.replace(/@:[\w.]+/g, "");
    if (strippedLinked.includes("@")) {
        errors.push(`Unescaped @ — use {'@'} instead in: "${value}"`);
    }

    // Extract top-level blocks only — avoids breaking on nested ICU braces
    for (const raw of extractTopLevelBlocks(stripped)) {
        const inner = raw.slice(1, -1).trim();
        const varName = extractVariableName(inner);

        // Detect ICU plural
        if (/^[\w]+\s*,\s*plural/.test(inner)) {
            icuType = "plural";
            elements.push({ type: "plural", raw, variable: varName });
            variables.push(varName);
            continue;
        }

        // Detect ICU select / selectordinal
        if (/^[\w]+\s*,\s*select(?:ordinal)?/.test(inner)) {
            icuType = inner.includes("selectordinal") ? "selectordinal" : "select";
            elements.push({ type: "select", raw, variable: varName });
            variables.push(varName);
            continue;
        }

        // @:key is a linked message — valid
        if (inner.startsWith("@:")) continue;

        // Validate simple placeholder name (alphanumeric + underscore only)
        if (!/^[\w]+$/.test(varName)) {
            errors.push(`Invalid placeholder name "{${varName}}" in: "${value}"`);
            continue;
        }

        elements.push({ type: "variable", raw, variable: varName });
        variables.push(varName);
    }

    return { elements, variables: [...new Set(variables)], icuType, errors };
}

// ── Comparison helpers ────────────────────────────────────────────────────────

export function getVariables(value: string): Set<string> {
    return new Set(parseIcuMessage(value).variables);
}

export function getIcuType(value: string): ParseResult["icuType"] {
    return parseIcuMessage(value).icuType;
}
