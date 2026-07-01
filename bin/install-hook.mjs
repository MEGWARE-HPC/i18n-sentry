#!/usr/bin/env node

import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── ANSI Colors ───────────────────────────────────────────────────────────────

const green  = (s) => `\x1b[32m${s}\x1b[0m`
const red    = (s) => `\x1b[31m${s}\x1b[0m`
const bold   = (s) => `\x1b[1m${s}\x1b[0m`
const dim    = (s) => `\x1b[2m${s}\x1b[0m`

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n${bold('i18n-sentry')} – install hook\n`)

  // Walk up from cwd to find .git directory
  let dir = process.cwd()
  let gitDir = null
  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, '.git')
    if (existsSync(candidate)) {
      gitDir = candidate
      break
    }
    dir = resolve(dir, '..')
  }

  if (!gitDir) {
    console.error(red('Could not find .git directory (searched up 5 levels)'))
    process.exit(1)
  }

  const hooksDir  = resolve(gitDir, 'hooks')
  const hookFile  = resolve(hooksDir, 'pre-commit')

  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true })

  const hookContent = `#!/bin/sh
# i18n-sentry pre-commit hook
# Auto-installed by i18n-sentry/bin/install-hook.mjs
node "$(git rev-parse --show-toplevel)/i18n-sentry/bin/pre-commit.mjs"
`

  writeFileSync(hookFile, hookContent, 'utf8')
  chmodSync(hookFile, '755')

  console.log(green(`✓ Pre-commit hook installed at: ${hookFile}`))
  console.log(dim('  The hook will warn about i18n issues but never block commits.\n'))
}

main()
