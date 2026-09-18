import { parse as parseSFC } from "@vue/compiler-sfc";
import * as ts from "typescript";
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

// ── Script Block (AST Mode) ──────────────────────────────────────────────────

interface ScriptBlockInfo {
  content: string;
  lang: string;
  /** 1-based line number in the ENTIRE .vue file where the content starts */
  startLine: number;
}

function extractScriptBlock(source: string): ScriptBlockInfo | null {
  // @vue/compiler-sfc doesn't always handle template parse errors gracefully -
  // we only care about the script/script setup block here, so
  // ignoreEmptyAttrValue etc. don't matter.
  const { descriptor } = parseSFC(source);
  const block = descriptor.scriptSetup ?? descriptor.script;
  if (!block) return null;

  return {
    content: block.content,
    lang: block.lang ?? "js",
    startLine: block.loc.start.line,
  };
}

/** "toast.success(...)" -> "toast.success"; "t(...)" -> "t" */
function getCallPath(expr: ts.LeftHandSideExpression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) {
    if (ts.isIdentifier(expr.expression)) {
      return `${expr.expression.text}.${expr.name.text}`;
    }
    if (ts.isPropertyAccessExpression(expr.expression)) {
      const parentPath = getCallPath(expr.expression);
      return parentPath ? `${parentPath}.${expr.name.text}` : null;
    }
  }
  return null;
}

// dot-path functions whose string args are NEVER treated as hardcoded (they're
// already translated) - e.g. t("key"), $t("key"). Intentionally not configurable,
// these are the standard i18n calls already handled by extractI18nKeys().
const TRANSLATION_CALL_NAMES = new Set(["t", "$t", "i18n.t", "i18n.$t"]);

/**
 * Extra filter ONLY for the script context (unlike template text, enum
 * values and property keys show up here as strings, e.g. "in_progress" or
 * "caseNumber" - that's not UI text).
 * isIgnoredText() from core/filters.ts is still applied on top of this.
 */
function looksLikeScriptIdentifier(value: string): boolean {
  const trimmed = value.trim();
  // snake_case / kebab-case / single lowercase word, e.g. "in_progress", "open"
  if (/^[a-z][a-z0-9]*([_-][a-z0-9]+)*$/.test(trimmed)) return true;
  // lowerCamelCase with no spaces, e.g. "caseNumber", "userId"
  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && /[A-Z]/.test(trimmed)) return true;
  return false;
}

// ── Resolvable string values (literal, template literal, const alias) ───────

type ResolvedValue =
  | { kind: "literal"; text: string }
  | { kind: "template"; display: string; literalOnly: string };

/**
 * Splits a template literal WITH interpolation (e.g. `Status: ${status}`)
 * into a display variant (placeholders shown as {name}) and a plain
 * text-only variant (just the literal parts, no placeholders) for the
 * ignore/identifier heuristics.
 */
function getTemplateExpressionText(node: ts.TemplateExpression): {
  display: string;
  literalOnly: string;
} {
  const displayParts: string[] = [node.head.text];
  const literalParts: string[] = [node.head.text];

  for (const span of node.templateSpans) {
    const label = ts.isIdentifier(span.expression) ? span.expression.text : "value";
    displayParts.push(`{${label}}`);
    displayParts.push(span.literal.text);
    literalParts.push(span.literal.text);
  }

  return { display: displayParts.join(""), literalOnly: literalParts.join("") };
}

/**
 * Collects every `const NAME = "..."` / `const NAME = \`...\`` declaration in
 * the whole script block, so calls like `toast.error(msg)` can be resolved
 * when `msg` is one of these constants.
 * Intentionally `const` only (never `let`), since a `let` could be
 * reassigned later, which would invalidate the "this is its value"
 * assumption. Intentionally flat across the whole file (no scope/shadowing
 * tracking) - a simple, robust approximation rather than full data-flow
 * analysis.
 */
function collectStringConstants(sourceFile: ts.SourceFile): Map<string, ResolvedValue> {
  const map = new Map<string, ResolvedValue>();

  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node) && (node.declarationList.flags & ts.NodeFlags.Const) !== 0) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;

        if (ts.isStringLiteralLike(decl.initializer)) {
          map.set(decl.name.text, { kind: "literal", text: decl.initializer.text });
        } else if (ts.isTemplateExpression(decl.initializer)) {
          const { display, literalOnly } = getTemplateExpressionText(decl.initializer);
          map.set(decl.name.text, { kind: "template", display, literalOnly });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return map;
}

/**
 * AST-based scanner for the <script setup>/<script> block.
 * Finds hardcoded strings in configured contexts:
 *  - Property values of keys from config.scriptScanProperties
 *    (e.g. { label: "Offen" })
 *  - Arguments of configured function calls from config.scriptScanFunctions
 *    (e.g. toast.success("..."), h("p", "..."), createTextColumn(..., "..."))
 * Also resolves template literals with interpolation (`Status: ${x}`) and
 * simple `const` alias variables (see collectStringConstants).
 *
 * Known, intentionally uncovered edge cases (see README):
 *  - renamed/destructured imports (`import { toast as notify }`)
 *  - getters/methods with a string return (`{ get label() { return "..." } }`)
 *  - `let` variables (only `const` is resolved)
 */
export function extractScriptStrings(source: string, config: SentryConfig): FileIssue[] {
  const results: FileIssue[] = [];

  const scanFnEntries = Object.entries(config.scriptScanFunctions ?? {});
  const scanProps = config.scriptScanProperties ?? [];
  if (scanFnEntries.length === 0 && scanProps.length === 0) return results;

  const block = extractScriptBlock(source);
  if (!block) return results;

  const scanFunctions = new Map(scanFnEntries);
  const scanProperties = new Set(scanProps);

  const isTS = block.lang === "ts" || block.lang === "tsx";
  const sourceFile = ts.createSourceFile(
    isTS ? "component.tsx" : "component.jsx",
    block.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const lineOffset = block.startLine - 1;
  const stringConstants = collectStringConstants(sourceFile);

  function shouldReport(checkText: string): boolean {
    if (looksLikeScriptIdentifier(checkText)) return false;
    if (isIgnoredText(checkText, config)) return false;
    return true;
  }

  /** Resolves an argument/property value to a string value, if possible. */
  function resolveValue(node: ts.Expression): ResolvedValue | null {
    if (ts.isStringLiteralLike(node)) return { kind: "literal", text: node.text };
    if (ts.isTemplateExpression(node)) {
      const { display, literalOnly } = getTemplateExpressionText(node);
      return { kind: "template", display, literalOnly };
    }
    if (ts.isIdentifier(node)) return stringConstants.get(node.text) ?? null;
    return null;
  }

  function report(value: ResolvedValue | null, pos: number) {
    if (!value) return;
    const checkText = value.kind === "literal" ? value.text : value.literalOnly;
    if (!shouldReport(checkText)) return;
    const displayText = value.kind === "literal" ? value.text : value.display;
    const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
    results.push({ file: "", line: line + lineOffset, text: displayText });
  }

  function visit(node: ts.Node) {
    // { label: "Offen" } / { label: `Status: ${x}` } / { label: msg }
    if (ts.isPropertyAssignment(node)) {
      const key =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (key && scanProperties.has(key)) {
        report(resolveValue(node.initializer), node.initializer.getStart(sourceFile));
      }
    }

    // toast.success("..."), h("p", "..."), createTextColumn(..., "...")
    if (ts.isCallExpression(node)) {
      const callPath = getCallPath(node.expression);
      if (callPath && !TRANSLATION_CALL_NAMES.has(callPath) && scanFunctions.has(callPath)) {
        const spec = scanFunctions.get(callPath)!;
        const indices = spec === "all" ? node.arguments.map((_, i) => i) : spec;
        for (const i of indices) {
          const arg = node.arguments[i];
          if (!arg) continue;
          report(resolveValue(arg), arg.getStart(sourceFile));
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
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

  if (block) {
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
  }

  // AST mode: hardcoded strings in the <script setup>/<script> block
  results.push(...extractScriptStrings(source, config));

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