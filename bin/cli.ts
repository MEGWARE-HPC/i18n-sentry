#!/usr/bin/env node
// Usage:
//   npx i18n-sentry            → scan (default)
//   npx i18n-sentry scan
//   npx i18n-sentry setup
//   npx i18n-sentry sort
//   npx i18n-sentry install-hook
//   npx i18n-sentry pre-commit  (internal, called by the git hook itself)
 
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
 
const __dirname = dirname(fileURLToPath(import.meta.url))
 
// Maps command name → compiled sibling file (relative to dist/bin/cli.js).
// Adjust the right-hand filenames here if your compiled output names differ.
const commands: Record<string, string> = {
  scan: './i18n-scan.js',
  setup: './setup.js',
  sort: './sort-locales.js',
  'install-hook': './install-hook.js',
  'pre-commit': './pre-commit.js',
}
 
async function main() {
  const rawArgs = process.argv.slice(2)
  const first = rawArgs[0]
 
  // No args, or first arg looks like a flag (e.g. `--foo`) → default to scan.
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