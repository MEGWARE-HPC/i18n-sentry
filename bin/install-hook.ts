#!/usr/bin/env node
// Installs the pre-commit hook into the host project's .git/hooks/

import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { green, red, bold, dim } from '../utils/colors.js'

function main() {
  console.log(`\n${bold('i18n-sentry')} – install hook\n`)

  // Walk up from cwd to find .git directory
  let dir = process.cwd()
  let gitDir: string | null = null

  for (let i = 0; i < 5; i++) {
    const candidate = resolve(dir, '.git')
    if (existsSync(candidate)) {
      gitDir = candidate
      break
    }
    dir = resolve(dir, '..')
  }

  if (!gitDir) {
    console.error(red('X  Could not find .git directory (searched up 5 levels)'))
    process.exit(1)
  }

  const hooksDir = resolve(gitDir, 'hooks')
  const hookFile = resolve(hooksDir, 'pre-commit')

  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true })

  const hookContent = `#!/bin/sh
# i18n-sentry pre-commit hook
# Auto-installed by i18n-sentry/bin/install-hook.ts
npx tsx "$(git rev-parse --show-toplevel)/i18n-sentry/bin/pre-commit.ts"
`

  writeFileSync(hookFile, hookContent, 'utf8')
  chmodSync(hookFile, '755')

  console.log(green(`✓ Pre-commit hook installed at: ${hookFile}`))
  console.log(dim('  The hook will warn about i18n issues but never block commits.\n'))
}

main()