#!/usr/bin/env node
// i18n-sentry – i18n-scan.ts
// Scans Vue/TS/JS files and locale JSON files for i18n issues.
//
//   ERROR   → t('key') used in code but key missing in locale files
//   ERROR   → key exists in source locale but missing in other locales
//   ERROR   → key exists in other locales but missing in source locale
//   ERROR   → key defined in locale files but never used in code
//   ERROR   → invalid ICU message syntax in locale files
//   ERROR   → placeholder mismatch between locales ({user} vs {name})
//   ERROR   → ICU structure mismatch between locales (plural vs simple)
//   ERROR   → namespace conflict (key used as both object and string)
//   WARNING → hardcoded visible text in templates or text attributes
//   WARNING → hardcoded accessibility text (aria-label, title, etc.)

import { extname, resolve } from 'path'
import { existsSync } from 'fs'
import { readFile } from '../utils/files.js'
import { loadConfig }                   from '../core/config.js'
import { loadLocales }                  from '../core/locales.js'
import { collectFiles }                 from '../utils/files.js'
import { isIgnoredKey }                 from '../core/filters.js'
import { checkMissingKeys }             from '../core/checks/missing-keys.js'
import { checkUnusedKeys }              from '../core/checks/unused-keys.js'
import { checkLocaleSync }              from '../core/checks/locale-sync.js'
import { checkInvalidKeys }             from '../core/checks/invalid-keys.js'
import { checkPlaceholderMismatch }     from '../core/checks/placeholder.js'
import { checkIcuStructureMismatch }    from '../core/checks/icu-structure.js'
import { checkNamespaceConflicts }      from '../core/checks/namespace.js'
import * as vueExtractor                from '../extractors/vue.js'
import * as angularExtractor            from '../extractors/angular.js'
import * as reactExtractor              from '../extractors/react.js'
import * as svelteExtractor             from '../extractors/svelte.js'
import {
  red, yellow, cyan, green, bold,
  printFileSection, printSimpleSection,
  printSummary, hasErrors,
  type SummaryInput
} from '../core/reporter.js'
import type { FileIssue, Extractor } from '../core/config.js'

// ── Framework detection ───────────────────────────────────────────────────────

type Framework = 'vue' | 'react' | 'angular' | 'svelte'

const FRAMEWORK_EXTENSIONS: Record<Framework, string[]> = {
  vue:     ['.vue', '.ts', '.js'],
  react:   ['.tsx', '.jsx', '.ts', '.js'],
  angular: ['.html', '.ts'],
  svelte:  ['.svelte', '.ts', '.js'],
}

const TEMPLATE_EXTENSIONS: Record<Framework, string[]> = {
  vue:     ['.vue'],
  react:   ['.tsx', '.jsx'],  // .ts files contain logic only, not JSX templates
  angular: ['.html'],         // .ts component files contain no inline template
  svelte:  ['.svelte'],
}

// Files that contain BOTH logic and template (mixed files)
// These need both key extraction AND hardcoded text scanning
const MIXED_EXTENSIONS: Record<Framework, string[]> = {
  vue:     [],          // .vue already in TEMPLATE_EXTENSIONS
  react:   [],          // .tsx/.jsx already in TEMPLATE_EXTENSIONS
  angular: [],          // Angular separates .ts and .html
  svelte:  [],          // .svelte already in TEMPLATE_EXTENSIONS
}

function getExtractor(framework: Framework): Extractor {
  switch (framework) {
    case 'angular': return angularExtractor
    case 'react':   return reactExtractor
    case 'svelte':  return svelteExtractor
    default:        return vueExtractor
  }
}

function detectFramework(): Framework {
  const pkgPath = resolve(process.cwd(), 'package.json')
  if (!existsSync(pkgPath)) return 'vue'

  const pkg = JSON.parse(readFile(pkgPath))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  if (deps['@angular/core'])  return 'angular'
  if (deps['react'])          return 'react'
  if (deps['svelte'])         return 'svelte'
  return 'vue'
}

// ── Attribute sets ────────────────────────────────────────────────────────────

function buildAttributeSets(config: ReturnType<typeof loadConfig>) {
  const errorAttrs = new Set([
    'placeholder', 'label', 'tooltip', 'hint',
    'noDataText', 'emptyText', 'errorText', 'helperText',
    'description', 'caption', 'legend', 'summary', 'alt',
    ...config.textAttributes
  ])

  const warnAttrs = new Set([
    'aria-label', 'aria-description', 'title',
    ...config.warnAttributes
  ])

  return { errorAttrs, warnAttrs }
}

// ── File scanning ─────────────────────────────────────────────────────────────

function scanFiles(
  files: string[],
  locales: ReturnType<typeof loadLocales>,
  config: ReturnType<typeof loadConfig>,
  framework: Framework
) {
  const missingKeys:       FileIssue[] = []
  const hardcodedErrors:   FileIssue[] = []
  const hardcodedWarnings: FileIssue[] = []

  const { errorAttrs, warnAttrs } = buildAttributeSets(config)
  const extractor        = getExtractor(framework)
  const templateExts = new Set(TEMPLATE_EXTENSIONS[framework])

  for (const file of files) {
    const source = readFile(file)
    const ext    = extname(file)

    // Always extract i18n keys regardless of file type
    const keys = extractor.extractI18nKeys(source)
    missingKeys.push(...checkMissingKeys(keys, file, locales, config))

    // Hardcoded text scanning — only for actual template files
    // This avoids false positives from scanning pure logic files (.ts)
    const isTemplate = templateExts.has(ext)
    if (isTemplate) {
      for (const item of extractor.extractRawTextNodes(source, config)) {
        hardcodedErrors.push({ ...item, file })
      }
      if (extractor.extractRawAttributes) {
        for (const { issue, level } of extractor.extractRawAttributes(source, errorAttrs, warnAttrs, config)) {
          const bucket = level === 'error' ? hardcodedErrors : hardcodedWarnings
          bucket.push({ ...issue, file })
        }
      }
    }
  }

  return { missingKeys, hardcodedErrors, hardcodedWarnings }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const config    = loadConfig()
  const locales   = loadLocales(config)
  const framework = detectFramework()
  const files     = collectFiles(config.scanDir, FRAMEWORK_EXTENSIONS[framework])

  console.log(`\n${bold('i18n-sentry')}`)
  console.log(`Framework: ${cyan(framework)}`)
  console.log(`Scanned ${files.length} files in ${config.scanDir}\n`)

  const { missingKeys, hardcodedErrors, hardcodedWarnings } = scanFiles(files, locales, config, framework)

  const summary: SummaryInput = {
    missingKeys,
    hardcodedErrors,
    hardcodedWarnings,
    localeSyncIssues:      checkLocaleSync(locales, config),
    unusedKeys:            checkUnusedKeys(files, locales, config),
    invalidKeys:           checkInvalidKeys(locales, config),
    namespaceConflicts:    checkNamespaceConflicts(config),
    placeholderMismatches: checkPlaceholderMismatch(locales, config),
    icuMismatches:         checkIcuStructureMismatch(locales, config),
  }

  // ── Print results ──────────────────────────────────────────────────────────

  printFileSection(
    `Missing keys in code (${summary.missingKeys.length})`,
    summary.missingKeys,
    red,
    ({ key, missingIn }) => `${red(key!)}  ${yellow('(missing in: ' + missingIn!.join(', ') + ')')}`
  )

  printSimpleSection(
    `Locale sync issues (${summary.localeSyncIssues.length})`,
    summary.localeSyncIssues,
    red,
    ({ key, missingIn }) => `${red(key)}  ${yellow('(missing in: ' + missingIn!.join(', ') + ')')}`
  )

  printSimpleSection(
    `Unused keys (${summary.unusedKeys.length})`,
    summary.unusedKeys,
    red,
    ({ key }) => red(key)
  )

  printSimpleSection(
    `Invalid keys (${summary.invalidKeys.length})`,
    summary.invalidKeys,
    red,
    ({ key, locale, msg }) => `${red(key)}  ${yellow(`[${locale}]`)}  ${msg}`
  )

  printSimpleSection(
    `Namespace conflicts (${summary.namespaceConflicts.length})`,
    summary.namespaceConflicts,
    red,
    ({ key, locale }) => `${red(key)}  ${yellow(`[${locale}]`)}  used as both object and string`
  )

  printSimpleSection(
    `Placeholder mismatches (${summary.placeholderMismatches.length})`,
    summary.placeholderMismatches,
    red,
    ({ key, locale, msg }) => `${red(key)}  ${yellow(`[${locale}]`)}  ${msg}`
  )

  printSimpleSection(
    `ICU structure mismatches (${summary.icuMismatches.length})`,
    summary.icuMismatches,
    red,
    ({ key, locale, msg }) => `${red(key)}  ${yellow(`[${locale}]`)}  ${msg}`
  )

  printFileSection(
    `Hardcoded text – errors (${summary.hardcodedErrors.length})`,
    summary.hardcodedErrors,
    red,
    ({ text }) => red(`"${text}"`)
  )

  printFileSection(
    `Hardcoded text – warnings (${summary.hardcodedWarnings.length})`,
    summary.hardcodedWarnings,
    yellow,
    ({ text }) => yellow(`"${text}"`)
  )

  printSummary(summary)
  process.exit(hasErrors(summary) ? 1 : 0)
}

main()