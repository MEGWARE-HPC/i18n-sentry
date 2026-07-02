#!/usr/bin/env node

// Does NOT block commits on errors — only warns

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

// ── ANSI Colors ───────────────────────────────────────────────────────────────

const red    = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const green  = (s) => `\x1b[32m${s}\x1b[0m`
const bold   = (s) => `\x1b[1m${s}\x1b[0m`
const dim    = (s) => `\x1b[2m${s}\x1b[0m`

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, options = {}) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...options })
    return { success: true, output }
  } catch (err) {
    return { success: false, output: err.stdout ?? '', error: err.stderr ?? '' }
  }
}

function findsentryBin() {
  // Support both: direct install and git submodule
  const candidates = [
    resolve(process.cwd(), 'i18n-sentry/bin'),
    resolve(process.cwd(), '.i18n-sentry/bin'),
    resolve(process.cwd(), 'scripts/i18n-sentry/bin'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function stepSortLocales(binDir) {
  console.log(dim('  → sorting locale files...'))
  const result = run(`node ${binDir}/sort-locales.mjs`)

  if (result.success) {
    // Stage sorted files so they are included in the commit
    run('git add -u')
    console.log(green(' ✓ locale files sorted and staged'))
  } else {
    console.log(yellow('could not sort locale files'))
    console.log(dim(result.error))
  }
}

function stepI18nScan(binDir) {
  console.log(dim('  → running i18n scan...'))
  const result = run(`node ${binDir}/i18n-scan.mjs`)

  if (result.success) {
    console.log(green(' ✓ no i18n errors found'))
  } else {
    console.log(yellow('\n i18n issues found — please  run <npx tsx i18n-sentry/bin/i18n-scan.ts> before merging:\n'))
    // Print the scan output indented
    const lines = result.output.split('\n')
    for (const line of lines) {
      console.log('  ' + line)
    }
    console.log(yellow('\n  Commit will proceed — but these issues should be resolved.\n'))
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n${bold('i18n-sentry')} pre-commit\n`)

  const binDir = findsentryBin()
  if (!binDir) {
    console.log(yellow('i18n-sentry not found — skipping i18n checks'))
    console.log(dim('    Expected at: i18n-sentry/bin, .i18n-sentry/bin, or scripts/i18n-sentry/bin'))
    process.exit(0)
  }

  stepSortLocales(binDir)
  stepI18nScan(binDir)

  // Always exit 0 — never block the commit
  process.exit(0)
}

main()
