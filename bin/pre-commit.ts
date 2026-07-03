#!/usr/bin/env node
// Pre-commit hook: sorts locale files and runs i18n scan
// Does NOT block commits on errors — only warns
 
import { execSync } from 'child_process'
import { yellow, green, bold, dim } from '../utils/colors.js'
 
// ── Helpers ───────────────────────────────────────────────────────────────────
 
function run(cmd: string): { success: boolean; output: string; error: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' })
    return { success: true, output, error: '' }
  } catch (err: any) {
    return { success: false, output: err.stdout ?? '', error: err.stderr ?? '' }
  }
}
 
// ── Steps ─────────────────────────────────────────────────────────────────────
 
function stepSortLocales() {
  console.log(dim('  → sorting locale files...'))
  const result = run('npx i18n-sentry sort')
 
  if (result.success) {
    run('git add -u')
    console.log(green('  ✓ locale files sorted and staged'))
  } else {
    console.log(yellow('could not sort locale files'))
    if (result.error) console.log(dim('    ' + result.error.trim()))
  }
}
 
function stepI18nScan() {
  console.log(dim('  → running i18n scan...'))
  const result = run('npx i18n-sentry scan')
 
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
 
  stepSortLocales()
  stepI18nScan()
  process.exit(0)
}
 
main()