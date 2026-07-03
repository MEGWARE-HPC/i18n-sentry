#!/usr/bin/env node
// Usage:
//   npx i18n-sentry            → scan (default)
//   npx i18n-sentry scan
//   npx i18n-sentry setup
//   npx i18n-sentry sort
//   npx i18n-sentry install-hook
//   npx i18n-sentry pre-commit

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// load version from package.json
let version = '0.0.0'
try {
  const pkgPath = resolve(__dirname, '../../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  version = pkg.version ?? version
} catch {}

// Maps command name → compiled sibling file (relative to dist/bin/cli.js)
const commands: Record<string, string> = {
  scan: './i18n-scan.js',
  setup: './setup.js',
  sort: './sort-locales.js',
  'install-hook': './install-hook.js',
  'pre-commit': './pre-commit.js',
}

function printHelp() {
  console.log(`
i18n-sentry v${version}

Usage:
  npx i18n-sentry              Run scan (default)
  npx i18n-sentry scan         Run scan
  npx i18n-sentry setup        Interactive setup
  npx i18n-sentry sort         Sort locale files
  npx i18n-sentry install-hook Install git hook

Options:
  --help, -h       Show help
  --version, -v    Show version
`)
}

async function main() {
  const rawArgs = process.argv.slice(2)
  const first = rawArgs[0]

  // HELP / VERSION
  if (first === '--help' || first === '-h') {
    printHelp()
    process.exit(0)
  }

  if (first === '--version' || first === '-v') {
    console.log(version)
    process.exit(0)
  }

  // command detection
  const isCommand = first && !first.startsWith('-') && first in commands
  const cmd = isCommand ? first : 'scan'
  const forwardedArgs = isCommand ? rawArgs.slice(1) : rawArgs

  if (first && !isCommand && !first.startsWith('-')) {
    console.error(`Unknown command: "${first}"`)
    console.error(`Available commands: ${Object.keys(commands).join(', ')}`)
    process.exit(1)
  }

  const target = commands[cmd]

  // Re-expose forwarded args as if the target file were invoked directly,
  // in case any of the target scripts reads process.argv itself.
  process.argv = [process.argv[0], process.argv[1], ...forwardedArgs]

  try {
    await import(resolve(__dirname, target))
  } catch (err) {
    console.error(`Failed to run "${cmd}":`, err)
    process.exit(1)
  }
}

main()