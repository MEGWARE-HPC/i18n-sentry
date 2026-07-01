# i18n-sentry

A lightweight, framework-aware i18n quality checker for Vue, React, Angular and Svelte projects. Detects missing keys, hardcoded strings, invalid ICU syntax, and more — designed to be embedded as a **git submodule** and shared across multiple projects.

> **Status:** v0.1 – Vue/Nuxt and React (react-i18next, react-intl) are production-ready. Angular (ngx-translate) and Svelte are supported. Angular Localize (XLIFF) is planned for v0.2.

---

## What it checks

| Level | Check |
|-------|-------|
| ❌ Error | `t('key')` used in code but key missing in locale files |
| ❌ Error | Key exists in source locale but missing in other locales |
| ❌ Error | Key exists in other locales but missing in source locale |
| ❌ Error | Key defined in locale files but never used in code |
| ❌ Error | Invalid ICU message syntax (unbalanced braces, empty placeholders, unescaped `@`) |
| ❌ Error | Placeholder mismatch between locales (`{user}` in de vs `{name}` in en) |
| ❌ Error | ICU structure mismatch between locales (`plural` vs `simple`) |
| ❌ Error | Namespace conflict (key used as both object and string) |
| ❌ Error | Hardcoded visible text in templates |
| ❌ Error | Hardcoded text in visible props (`placeholder`, `noDataText`, `alt`, etc.) |
| ⚠️ Warning | Hardcoded accessibility text (`aria-label`, `title`, etc.) |

---

## Framework support

| Framework | Key extraction | Hardcoded text | Status |
|-----------|---------------|----------------|--------|
| Vue / Nuxt (vue-i18n) | `t('key')`, `$t('key')` | `<template>` scanning | ✅ Production-ready |
| React (react-i18next) | `t('key')`, `useTranslation` | JSX scanning | ✅ Production-ready |
| React (react-intl) | `<FormattedMessage>`, `intl.formatMessage` | JSX scanning | ✅ Production-ready |
| Angular (ngx-translate) | `\| translate`, `.instant()`, `.get()` | Template scanning | ✅ Supported |
| Svelte (svelte-i18n) | `$t('key')`, `t('key')` | Template scanning | ✅ Supported |
| Svelte (typesafe-i18n) | `$LL.key()` | Template scanning | ✅ Supported |
| Angular Localize (XLIFF) | `i18n="@@key"` | XLIFF parsing | 🔜 Planned v0.2 |

---

## Setup

### 1. Add as git submodule

```bash
git submodule add ../i18n-sentry.git i18n-sentry
git submodule update --init
```

### 2. Install dependencies

```bash
cd i18n-sentry && npm install && cd ..
```

### 3. Run interactive setup

```bash
node i18n-sentry/bin/setup.mjs
```

The setup script will:
- Auto-detect your framework (`vue`, `react`, `angular`, `svelte`) from `package.json`
- Auto-detect your locale directory and scan directory
- Auto-detect your locale languages from existing files
- Ask whether to install `tsx` (required to run the TypeScript scanner)
- Ask whether to install the pre-commit hook
- Ask whether to add a `lint:i18n` script to `package.json`
- Write `i18n-sentry.config.json` to your project root

#### Manual config (alternative to setup script)

If you prefer to configure manually, copy the example config:

```bash
cp i18n-sentry/i18n-sentry.config.example.json i18n-sentry.config.json
```

Edit `i18n-sentry.config.json`:

```json
{
  "localeDir": "./src/ui/i18n/locales",
  "scanDir": "./src/ui",
  "locales": ["de", "en"],
  "sourceLocale": "de",
  "ignoreKeys": [
    "some.key.*"
  ],
  "ignoreRawText": [
    "MyBrand"
  ],
  "textAttributes": [],
  "warnAttributes": []
}
```

Then install the pre-commit hook manually:

```bash
node i18n-sentry/bin/install-hook.mjs
```

The hook runs on every commit, warns about i18n issues, sorts locale files alphabetically, and **never blocks commits**.

---

## Usage

### Run manually

```bash
node i18n-sentry/bin/i18n-scan.ts   # requires tsx
# or
npx tsx i18n-sentry/bin/i18n-scan.ts
```

### Sort locale files

```bash
npx tsx i18n-sentry/bin/sort-locales.mjs
```

### Add to package.json

```json
"scripts": {
  "lint:i18n": "cd ../.. && npx tsx i18n-sentry/bin/i18n-scan.ts"
}
```

---

## Config reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `localeDir` | `string` | — | Path to locale files or directories (required) |
| `scanDir` | `string` | — | Directory to scan for source files (required) |
| `locales` | `string[]` | `["de", "en"]` | Locale identifiers to check |
| `sourceLocale` | `string` | first in `locales` | The reference/source locale |
| `ignoreKeys` | `string[]` | `[]` | Keys to ignore — supports `*` wildcard suffix |
| `ignoreRawText` | `string[]` | `[]` | Exact text values to ignore in template checks |
| `textAttributes` | `string[]` | `[]` | Additional props to flag as hardcoded text errors |
| `warnAttributes` | `string[]` | `[]` | Additional props to flag as hardcoded text warnings |

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

## Updating the submodule

```bash
git submodule update --remote i18n-sentry
git add i18n-sentry
git commit -m "chore: update i18n-sentry submodule"
```

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

### Future / community

- **AST-based extraction** — replace regex heuristics with Babel (React), TypeScript Compiler API, or Angular template parser for higher accuracy
- **Confidence scoring** — flag uncertain matches separately from strong matches
- **Normalized i18n IR** — unified intermediate representation across frameworks
- **VS Code extension** — inline warnings in editor
- **CI reporter formats** — JSON, SARIF, GitHub Actions annotations

---

## Architecture

```
i18n-sentry/
├── bin/
│   ├── i18n-scan.ts          ← Main entrypoint, framework detection, orchestration
│   ├── sort-locales.mjs      ← Sorts locale JSON files alphabetically
│   ├── install-hook.mjs      ← Installs pre-commit hook
│   ├── pre-commit.mjs        ← Pre-commit hook runner
│   └── setup.mjs             ← interactive installation process
│   
├── core/
│   ├── config.ts             ← Config loading, shared types, Extractor interface
│   ├── locales.ts            ← Locale loading, JSON flattening, nested dir support
│   ├── filters.ts            ← Key and text filtering logic
│   ├── icu-parser.ts         ← ICU message parser (top-level brace tracking)
│   ├── reporter.ts           ← Terminal output formatting
│   └── checks/
│       ├── missing-keys.ts   ← t('key') vs locale files
│       ├── unused-keys.ts    ← locale keys vs source files
│       ├── locale-sync.ts    ← de.json vs en.json bidirectional
│       ├── invalid-keys.ts   ← ICU syntax validation
│       ├── placeholder.ts    ← {var} mismatch between locales
│       ├── icu-structure.ts  ← plural/select type mismatch
│       └── namespace.ts      ← object/string key conflicts
├── extractors/
│   ├── vue.ts                ← Vue/Nuxt template + t() extraction
│   ├── react.ts              ← JSX + react-i18next + react-intl
│   ├── angular.ts            ← ngx-translate pipe + service methods
│   └── svelte.ts             ← svelte-i18n + typesafe-i18n + paraglide
└── utils/
    └── files.ts              ← File system helpers
```