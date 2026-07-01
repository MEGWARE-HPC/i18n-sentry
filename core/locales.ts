import { existsSync, readdirSync, statSync } from 'fs'
import { resolve, join, extname } from 'path'
import { readJson } from '../utils/files.js'
import type { SentryConfig, LocaleMap } from './config.js'

// ── Flatten ───────────────────────────────────────────────────────────────────

export function flattenJson(
  obj: Record<string, unknown>,
  prefix = '',
  conflicts: string[] = []
): Record<string, string> {
  return Object.entries(obj).reduce((acc: Record<string, string>, [key, val]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (fullKey in acc) conflicts.push(fullKey)
      Object.assign(acc, flattenJson(val as Record<string, unknown>, fullKey, conflicts))
    } else {
      if (Object.keys(acc).some(k => k.startsWith(fullKey + '.'))) {
        conflicts.push(fullKey)
      }
      acc[fullKey] = String(val)
    }

    return acc
  }, {})
}

export function detectNamespaceConflicts(
  obj: Record<string, unknown>,
  locale: string
): { key: string; locale: string }[] {
  const conflicts: string[] = []
  flattenJson(obj, '', conflicts)
  return [...new Set(conflicts)].map(key => ({ key, locale }))
}

// ── Locale structure detection ────────────────────────────────────────────────

type LocaleStructure = 'flat' | 'nested'

/**
 * Detect whether locales use flat files or nested directories:
 *   flat:   locales/de.json, locales/en.json
 *   nested: locales/de/common.json, locales/de/users.json
 */
function detectStructure(localeDir: string, locales: string[]): LocaleStructure {
  for (const locale of locales) {
    const dirPath  = resolve(process.cwd(), localeDir, locale)
    const filePath = resolve(process.cwd(), `${localeDir}/${locale}.json`)
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) return 'nested'
    if (existsSync(filePath)) return 'flat'
  }
  return 'flat'
}

/** Collect all JSON files in a directory recursively */
function collectJsonFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...collectJsonFiles(full))
    } else if (extname(entry) === '.json') {
      results.push(full)
    }
  }
  return results
}

/** Merge multiple JSON files into one flat record (namespace = filename without .json) */
function mergeJsonFiles(files: string[], baseDir: string): Record<string, string> {
  const merged: Record<string, string> = {}

  for (const file of files) {
    const raw = readJson(file)

    // Build namespace prefix from relative path:
    // locales/de/common.json → "common"
    // locales/de/users/profile.json → "users.profile"
    const relative = file
      .replace(baseDir, '')
      .replace(/^\//, '')
      .replace(/\.json$/, '')
      .replace(/\//g, '.')

    // Use filename as prefix only if there are multiple files
    const prefix = files.length > 1 ? relative : ''
    Object.assign(merged, flattenJson(raw, prefix))
  }

  return merged
}

// ── Load ──────────────────────────────────────────────────────────────────────

export function loadLocales(config: SentryConfig): LocaleMap {
  const result: LocaleMap = {}
  const structure = detectStructure(config.localeDir, config.locales)

  console.log(`Locale structure: ${structure === 'nested' ? 'nested directories' : 'flat files'}`)

  for (const locale of config.locales) {
    if (structure === 'nested') {
      const dirPath = resolve(process.cwd(), config.localeDir, locale)

      if (!existsSync(dirPath)) {
        console.error(`\x1b[31m❌  Locale directory not found: ${dirPath}\x1b[0m`)
        process.exit(1)
      }

      const files = collectJsonFiles(dirPath)
      result[locale] = mergeJsonFiles(files, dirPath)
    } else {
      const filePath = resolve(process.cwd(), `${config.localeDir}/${locale}.json`)

      if (!existsSync(filePath)) {
        console.error(`\x1b[31m❌  Locale file not found: ${filePath}\x1b[0m`)
        process.exit(1)
      }

      result[locale] = flattenJson(readJson(filePath))
    }
  }

  return result
}
