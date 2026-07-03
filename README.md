# i18n-sentry

A lightweight, framework-aware i18n quality checker for Vue, React, Angular and Svelte projects. Detects missing keys, hardcoded strings, invalid ICU syntax, and more.

> **Status:** v0.1 – Vue/Nuxt and React (react-i18next, react-intl) are production-ready. Angular (ngx-translate) and Svelte are supported. Angular Localize (XLIFF) is planned for v0.2.

> **Limitation:** Keys must be statically analyzable via regex. Dynamically generated keys (e.g., `t(variable)`, `t(condition ? 'key1' : 'key2')`) are not supported yet. Use `ignoreKeys` to exclude patterns until AST-based extraction is implemented.

---

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
| Warning | Hardcoded accessibility text (`aria-label`, `title`, etc.) |

---

## Framework support

| Framework | Key extraction | Hardcoded text | Status |
|-----------|---------------|----------------|--------|
| Vue / Nuxt (vue-i18n) | `t('key')`, `$t('key')` | `<template>` scanning | Production-ready |
| React (react-i18next) | `t('key')`, `useTranslation()`, `i18n.t()`, `<Trans i18nKey>`, tagged templates | JSX scanning | Production-ready |
| React (react-intl) | `<FormattedMessage id>`, `intl.formatMessage()`, `defineMessages()` | JSX scanning | Production-ready |
| Angular (ngx-translate) | `\| translate`, `.instant()`, `.get()` | Template scanning | Supported |
| Svelte (svelte-i18n) | `$t('key')`, `t('key')` | Template scanning | Supported |
| Svelte (typesafe-i18n) | `$LL.key()` | Template scanning | Supported |
| Angular Localize (XLIFF) | `i18n="@@key"` | XLIFF parsing | Planned v0.2 |

---

## Setup

### 1. Install as npm package

```bash
npm install i18n-sentry
```

### 2. Run interactive setup

```bash
npx i18n-sentry setup
```

The setup script will:
- Auto-detect your framework (`vue`, `react`, `angular`, `svelte`) from `package.json`
- Auto-detect your locale directory and scan directory
- Auto-detect your locale languages from existing files
- Ask whether to install `tsx` (required to run the TypeScript-based CLI)
- Ask whether to install the pre-commit hook
- Ask whether to add a `lint:i18n` script to `package.json`
- Write `i18n-sentry.config.json` to your project root


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

### Future roadmap

- **AST-based extraction** — replace regex heuristics with Babel (React), TypeScript Compiler API, or Angular template parser for higher accuracy
- **Confidence scoring** — flag uncertain matches separately from strong matches
- **Normalized i18n IR** — unified intermediate representation across frameworks
- **VS Code extension** — inline warnings in editor
- **CI reporter formats** — JSON, SARIF, GitHub Actions annotations
- **Dynamic key resolution** — advanced patterns for `t(variable)` and conditional key access

---

## Feedback & Contributing

This project is newly released and actively being improved. We welcome your feedback, bug reports, and contributions!

- Found a bug? [Open an issue](https://github.com/your-org/i18n-sentry/issues)
- Have a feature request? [Start a discussion](https://github.com/your-org/i18n-sentry/discussions)
- Want to contribute? Pull requests are welcome!

Your input helps make i18n-sentry better for the community.