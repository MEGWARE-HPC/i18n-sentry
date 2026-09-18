# i18n-sentry

A lightweight, framework-aware i18n quality checker for Vue, React, Angular and Svelte projects. Detects missing keys, hardcoded strings, invalid ICU syntax, and more.


<p align="center"><img width="930" height="1057" alt="showcase" src="https://github.com/user-attachments/assets/4fb2d60c-3748-47e2-bd55-608bf1df8577" />
</p>

## What it checks

| Level | Check |
|-------|-------|
| Error | `t('key')` used in code but key missing in locale files |
| Error | Key exists in source locale but missing in other locales |
| Error | Key exists in other locales but missing in source locale |
| Error | Key defined in locale files but never used in code |
| Error | Invalid ICU message syntax (unbalanced braces, empty placeholders, unescaped `@`) |
| Error | Placeholder mismatch between locales (`{user}` in de vs `{name}` in en) |
| Error | ICU structure mismatch between locales (`plural` vs `simple`) |
| Error | Namespace conflict (key used as both object and string) |
| Error | Hardcoded visible text in templates |
| Error | Hardcoded text in visible props (`placeholder`, `noDataText`, `alt`, etc.) |
| Error | Hardcoded text in `<script setup>` — object properties and known function calls (Vue only, [AST mode](#ast-mode-vue-only)) |
| Warning | Hardcoded accessibility text (`aria-label`, `title`, etc.) |

> **Status:** v0.1.0 – Vue/Nuxt and React (react-i18next, react-intl) are production-ready. Angular (ngx-translate) and Svelte are supported. Angular Localize (XLIFF) is planned for v0.2.0

---

## Framework support

| Framework | Key extraction | Hardcoded text | AST mode (script blocks) | Status |
|-----------|---------------|----------------|---------------------------|--------|
| Vue / Nuxt (vue-i18n) | `t('key')`, `$t('key')` | `<template>` scanning | ✓ `<script setup>` | Production-ready |
| React (react-i18next) | `t('key')`, `useTranslation()`, `i18n.t()`, `<Trans i18nKey>`, tagged templates | JSX scanning | — | Production-ready |
| React (react-intl) | `<FormattedMessage id>`, `intl.formatMessage()`, `defineMessages()` | JSX scanning | — | Production-ready |
| Angular (ngx-translate) | `\| translate`, `.instant()`, `.get()` | Template scanning | — | Supported |
| Svelte (svelte-i18n) | `$t('key')`, `t('key')` | Template scanning | — | Supported |
| Svelte (typesafe-i18n) | `$LL.key()` | Template scanning | — | Supported |
| Angular Localize (XLIFF) | `i18n="@@key"` | XLIFF parsing | — | Planned v0.2 |

> **Limitation:** Keys must be statically analyzable via regex. Dynamically generated keys (e.g., `t(variable)`, `t(condition ? 'key1' : 'key2')`) are not supported yet. Use `ignoreKeys` to exclude patterns until AST-based key extraction is implemented.
---

## Setup

### 1. Install as npm package

```bash
npm install i18n-sentry
```

### 2. Run interactive setup

> **Note:** The examples below use `npx`, but the CLI also works with other package runners such as `bunx`, `pnpm dlx`, and `yarn dlx`.

```bash
npx i18n-sentry setup
```

The setup script will:
- Auto-detect your framework (`vue`, `react`, `angular`, `svelte`) from `package.json`
- Auto-detect your locale directory and scan directory
- Auto-detect your locale languages from existing files
- For Vue projects, offer to configure [AST mode](#ast-mode-vue-only) for `<script setup>` scanning
- Ask whether to install `tsx` (required to run the TypeScript-based CLI)
- Ask whether to install the pre-commit hook
- Ask whether to add a `lint:i18n` script to `package.json`
- Write `i18n-sentry.config.json` to your project root or to the path of your package.json


---

## Usage

### Run manually

```bash
npx i18n-sentry
```
or

```bash
npx i18n-sentry scan
```

### Additional commands
```bash
npx i18n-sentry sort            # sort locale files
npx i18n-sentry install-hook    # install git hook
```
### Help & Version
```bash
npx i18n-sentry --help          # show CLI help
npx i18n-sentry --version       # show version
```
---

## Git hook (optional)

The hook runs on every commit, warns about i18n issues, sorts locale files alphabetically, and **never blocks commits**.

---

## Config reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `localeDir` | `string` | — | Path to locale files or directories (required) |
| `scanDir` | `string` | — | Directory to scan for source files (required) |
| `locales` | `string[]` | `["de", "en"]` | Locale identifiers to check |
| `sourceLocale` | `string` | first in `locales` | The reference/source locale |
| `ignoreKeys` | `string[]` | `[]` | Keys to ignore — supports `*` wildcard suffix. **Use this for dynamic keys** that cannot be statically analyzed (e.g., `t(variable)` or `t(condition ? 'a' : 'b')`) |
| `ignoreRawText` | `string[]` | `[]` | Exact text values to ignore in template checks |
| `textAttributes` | `string[]` | `[]` | Additional props to flag as hardcoded text errors |
| `warnAttributes` | `string[]` | `[]` | Additional props to flag as hardcoded text warnings |
| `scriptScanFunctions` | `Record<string, "all" \| number[]>` | `{}` | Vue only. Dot-path function calls to scan for hardcoded strings in `<script setup>`, e.g. `{ "toast.success": "all" }`. `"all"` scans every string argument; `number[]` scans only those 0-based argument indices. See [AST mode](#ast-mode-vue-only) |
| `scriptScanProperties` | `string[]` | `[]` | Vue only. Object property keys whose string value is scanned in `<script setup>`, e.g. `["label", "title"]`. See [AST mode](#ast-mode-vue-only) |

### Locale directory structures

Both flat and nested structures are supported and auto-detected:

```
# Flat (default)
locales/
├── de.json
└── en.json

# Nested (auto-detected)
locales/
├── de/
│   ├── common.json
│   └── users.json
└── en/
    ├── common.json
    └── users.json
```

---

## AST mode (Vue only)

The regular template scanner only looks inside `<template>`. It can't see hardcoded strings living in the `<script setup>` block — in JS objects, `toast(...)` calls, `h()` render functions, or arguments passed to helper functions:

```vue
<script setup lang="ts">
const repairStates = [
  { value: "open", label: "Offen" },        // not caught by template scanning
]

toast.success("Status aktualisiert")         // not caught by template scanning
h("p", "Dieser Text wird sonst übersehen.")  // not caught by template scanning
</script>
```

AST mode fixes this by parsing `<script setup>` with `@vue/compiler-sfc` + the TypeScript compiler API, and looking for string values in two configurable contexts:

- **Object properties** whose key is listed in `scriptScanProperties` — e.g. `{ label: "Offen" }`
- **Function call arguments** for dot-path calls listed in `scriptScanFunctions`, at specific argument indices (or `"all"`)

In both contexts, the value doesn't have to be a plain string literal — AST mode also resolves:
- **Template literals with interpolation**, e.g. `` toast.success(`Status: ${status} aktualisiert`) `` is reported as `Status: {status} aktualisiert`
- **`const` variables**, e.g. `const msg = "..."` followed by `toast.error(msg)` — the call is reported at the point it's used, with the resolved text

```json
{
  "scriptScanFunctions": {
    "toast.success": "all",
    "toast.error": "all",
    "toast.warning": "all",
    "h": [1, 2],
    "createTextColumn": [2]
  },
  "scriptScanProperties": ["label", "title", "text", "description"]
}
```

Notes:
- `h(tag, children)` and `h(tag, props, children)` are both valid signatures — index `0` is always the tag name, never text, but the actual content sits at index `1` in the first form and index `2` in the second. Scan both (`[1, 2]`, the setup wizard's default) unless you know your codebase only uses one form.
- Calls with mixed technical/display arguments (e.g. `createTextColumn(columnHelper, "caseNumber", "Kennung")`) need explicit argument indices rather than `"all"`, since earlier args are often field keys, not display text.
- Calls to `t()`, `$t()`, `i18n.t()`, `i18n.$t()` are always excluded — those are already-translated keys, handled by the regular key extraction, not by AST mode.
- The setup wizard (`npx i18n-sentry setup`) offers to configure this automatically for Vue projects, with `toast.*` and `h()` as suggested defaults.
- AST mode is opt-in: it only runs when `scriptScanFunctions` or `scriptScanProperties` is non-empty in your config.
- **A single config file wins.** i18n-sentry searches your project root first, then subdirectories up to 2 levels deep, and uses the *first* `i18n-sentry.config.json` it finds — an older config left behind at the root (e.g. from before AST mode existed) silently takes priority over a newer one further down. If AST mode seems to have no effect despite a correct config, check for a stray config file elsewhere in your project (`find . -name "i18n-sentry.config.json" -not -path "*/node_modules/*"`).

### Known limitations

AST mode resolves direct literals, template literals, and `const` aliases — but a few patterns are intentionally not covered, since handling them reliably would need real data-flow or module-resolution analysis rather than a straightforward AST walk:

- **Renamed or destructured imports** — `import { toast as notify } from 'vue-sonner'; notify.success("...")` isn't matched, since `scriptScanFunctions` is matched by the identifier name written in the call, not by where it was imported from.
- **`let` variables** — only `const` declarations are resolved as aliases, since a `let` could be reassigned between declaration and use, making the "this is its value" assumption unsafe.
- **Getters or methods returning a string** — `{ get label() { return "..." } }` is not a plain property assignment and isn't scanned.

If any of these show up often in your codebase, `ignoreRawText` won't help (it only matches exact strings already found) — for now, the workaround is to rewrite the call site to a plain literal or a `const`, or wait for AST mode to grow support for that pattern.

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | No errors (warnings may still be present) |
| `1` | One or more errors found |

---

## Known limitations & roadmap

### v0.2 planned

- **Angular Localize / XLIFF support** — parse `messages.xlf`, extract `<trans-unit id>` as keys, detect missing `<target>` translations, scan templates for `i18n="@@key"` attributes
- **Nested locale file support** — currently merges files using filename as namespace prefix; deeper nesting strategies to be refined
- **Multi-framework monorepo support** — currently detects one framework per project via `package.json`; file-based detection per directory planned
- **AST mode for React/Angular/Svelte** — extend the Vue `<script setup>` AST scanner to JSX (React) and component class bodies (Angular/Svelte)

### Future roadmap

- **AST-based key extraction** — replace the regex-based `t('key')` extraction with Babel (React), TypeScript Compiler API, or Angular template parser for higher accuracy
- **Confidence scoring** — flag uncertain matches separately from strong matches
- **Normalized i18n IR** — unified intermediate representation across frameworks
- **VS Code extension** — inline warnings in editor
- **CI reporter formats** — JSON, SARIF, GitHub Actions annotations
- **Dynamic key resolution** — advanced patterns for `t(variable)` and conditional key access

---

## Feedback & Contributing

This project was developed by [MEGWARE Computer Vertrieb und Service GmbH](https://www.megware.com/) and actively being improved. We welcome your feedback, bug reports, and contributions!

- Found a bug? [Open an issue](https://github.com/MEGWARE-HPC/i18n-sentry/issues)
- Have a feature request? [Start a discussion](https://github.com/MEGWARE-HPC/i18n-sentry/discussions)
- Want to contribute? Pull requests are welcome!

Your input helps make i18n-sentry better for the community.