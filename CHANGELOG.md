# Changelog

## [0.2.0] - 2026-09-21

### Added

- **AST mode for Vue** (`extractScriptStrings()` in `extractors/vue.ts`): scans `<script setup>`/`<script>` blocks for hardcoded strings that the template-only scanner can't see — object properties (e.g. `{ label: "Offen" }`) and specific function call arguments (e.g. `toast.success("...")`, `h("p", "...")`), configured via two new config fields, `scriptScanFunctions` and `scriptScanProperties`
- AST mode also resolves template literals with interpolation (`` `Status: ${x}` ``, reported as `Status: {x}`) and `const` alias variables (`const msg = "..."` used later as `toast.error(msg)`)
- Setup wizard: new step to configure AST mode for Vue projects, with `toast.*` and `h()` suggested as defaults

### Changed

- `@vue/compiler-sfc` and `typescript` are now runtime `dependencies` (previously `typescript` was a `devDependency`) — required for AST mode to work when the package is installed by end users

### Known limitations

- AST mode does not resolve renamed/destructured imports (`import { toast as notify }`), `let` variables, or getters/methods with a string return — see the README's "AST mode" section for details

## [0.1.3] - 2026-07-08

### Fixed

- Improved Windows compatibility
- Improved i18n source path detection
- Improved Angular control flow syntax detection (`@if`, `@else`, `@for`)

## [0.1.2] - 2026-07-03

### Added

- Initial public release
- Vue / Nuxt support
- React (react-i18next) support
- React Intl support
- Angular (ngx-translate) support
- Svelte support
- Missing key detection
- Unused key detection
- Locale synchronization
- ICU validation
- Placeholder validation
- Namespace conflict detection
- Hardcoded text detection
- Interactive setup wizard
- Pre-commit hook
- Locale sorting