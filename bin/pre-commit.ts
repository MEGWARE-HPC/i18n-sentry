#!/usr/bin/env node
// Pre-commit hook: sorts locale files and runs i18n scan
// Does NOT block commits on errors — only warns

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { yellow, green, bold, dim } from '../utils/colors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd: string): { success: boolean; output: string; error: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' })
    return { success: true, output, error: '' }
  } catch (err: any) {
    return { success: false, output: err.stdout ?? '', error: err.stderr ?? '' }
  }
}

function findSentryBin(): string | null {
  const candidates = [
    resolve(process.cwd(), 'i18n-sentry/bin'),
    resolve(process.cwd(), '.i18n-sentry/bin'),
    resolve(process.cwd(), 'scripts/i18n-sentry/bin'),
    __dirname,
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function stepSortLocales(binDir: string) {
  console.log(dim('  → sorting locale files...'))
  const result = run(`npx tsx "${binDir}/sort-locales.ts"`)

  if (result.success) {
    run('git add -u')
    console.log(green('  ✓ locale files sorted and staged'))
  } else {
    console.log(yellow('could not sort locale files'))
    if (result.error) console.log(dim('    ' + result.error.trim()))
  }
}

function stepI18nScan(binDir: string) {
  console.log(dim('  → running i18n scan...'))
  const result = run(`npx tsx "${binDir}/i18n-scan.ts"`)

  if (result.success) {
    console.log(green('  ✓ no i18n errors found'))
  } else {
    console.log(yellow('\n i18n issues found — please fix before merging:\n'))
    for (const line of result.output.split('\n')) {
      console.log('  ' + line)
    }
    if (result.error) console.log(dim('\n  ' + result.error.trim()))
    console.log(yellow('\n Commit will proceed — but these issues should be resolved.\n'))
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n${bold('i18n-sentry')} pre-commit\n`)

  const binDir = findSentryBin()
  if (!binDir) {
    console.log(yellow('i18n-sentry not found — skipping i18n checks'))
    process.exit(0)
  }

  stepSortLocales(binDir)
  stepI18nScan(binDir)
  process.exit(0)
}

main()
