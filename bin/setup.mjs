#!/usr/bin/env node
// i18n-sentry – setup.mjs
// Interactive setup script for new projects
// Run: node i18n-sentry/bin/setup.mjs

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { resolve, relative } from 'path'
import { createInterface } from 'readline'
import { execSync } from 'child_process'

// ── Colors ────────────────────────────────────────────────────────────────────

const red    = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`
const green  = (s) => `\x1b[32m${s}\x1b[0m`
const bold   = (s) => `\x1b[1m${s}\x1b[0m`
const dim    = (s) => `\x1b[2m${s}\x1b[0m`

// ── Readline ──────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question, defaultValue) {
  return new Promise(resolve => {
    const hint = defaultValue ? dim(` (${defaultValue})`) : ''
    rl.question(`${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultValue || '')
    })
  })
}

function askYesNo(question, defaultYes = true) {
  return new Promise(resolve => {
    const hint = defaultYes ? '[Y/n]' : '[y/N]'
    rl.question(`${question} ${dim(hint)}: `, answer => {
      const a = answer.trim().toLowerCase()
      if (!a) resolve(defaultYes)
      else resolve(a === 'y' || a === 'yes')
    })
  })
}

function askChoice(question, choices) {
  return new Promise(resolve => {
    console.log(`\n${question}`)
    choices.forEach((c, i) => console.log(`  ${cyan(i + 1 + '.')} ${c.label}  ${dim(c.hint ?? '')}`))
    rl.question(`\nChoice: `, answer => {
      const idx = parseInt(answer.trim()) - 1
      resolve(choices[idx] ?? choices[0])
    })
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, silent = false) {
  try {
    execSync(cmd, { stdio: silent ? 'pipe' : 'inherit' })
    return true
  } catch {
    return false
  }
}

function detectFramework() {
  // Search in root and common subdirectories
  const candidates = [
    'package.json',
    'src/ui/package.json',
    'src/app/package.json',
    'src/package.json',
    'app/package.json',
    'frontend/package.json',
    'client/package.json',
  ]

  for (const candidate of candidates) {
    const pkgPath = resolve(process.cwd(), candidate)
    if (!existsSync(pkgPath)) continue
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps['@angular/core'])       return 'angular'
      if (deps['react'])               return 'react'
      if (deps['svelte'])              return 'svelte'
      if (deps['nuxt'])                return 'vue'
      if (deps['vue'])                 return 'vue'
      if (deps['@nuxtjs/i18n'])        return 'vue'
      if (deps['vue-i18n'])            return 'vue'
    } catch {}
  }

  return null
}

function detectLocaleDir() {
  const candidates = [
    './src/ui/i18n/locales',
    './src/i18n/locales',
    './src/locales',
    './public/i18n',
    './public/locales',
    './locales',
    './i18n',
  ]
  for (const c of candidates) {
    if (existsSync(resolve(process.cwd(), c))) return c
  }
  return null
}

function detectScanDir() {
  const candidates = ['./src/ui', './src/app', './src']
  for (const c of candidates) {
    if (existsSync(resolve(process.cwd(), c))) return c
  }
  return './src'
}

function detectLocales(localeDir) {
  const path = resolve(process.cwd(), localeDir)
  if (!existsSync(path)) return ['de', 'en']
  try {
    const entries = readdirSync(path)
    const jsonFiles = entries.filter(e => e.endsWith('.json')).map(e => e.replace('.json', ''))
    if (jsonFiles.length > 0) return jsonFiles
    const dirs = entries.filter(e => { try { return statSync(resolve(path, e)).isDirectory() } catch { return false } })
    if (dirs.length > 0) return dirs
  } catch {}
  return ['de', 'en']
}

// ── Steps ─────────────────────────────────────────────────────────────────────

async function stepWelcome() {
  console.log(`
${bold(cyan('┌─────────────────────────────────────┐'))}
${bold(cyan('│        i18n-sentry  setup           │'))}
${bold(cyan('└─────────────────────────────────────┘'))}

Welcome! This script will configure i18n-sentry for your project.
It will create ${cyan('i18n-sentry.config.json')} in your project root
and optionally install a pre-commit hook.

Project root: ${dim(process.cwd())}
`)
}

async function stepFramework() {
  const detected = detectFramework()
  if (detected) {
    console.log(`\n${green('✓')} Detected framework: ${cyan(detected)}`)
    const confirm = await askYesNo(`Use ${cyan(detected)}?`)
    if (confirm) return detected
  }

  const choice = await askChoice('Which framework are you using?', [
    { label: 'Vue / Nuxt',  hint: 'vue-i18n, @nuxtjs/i18n', value: 'vue' },
    { label: 'React',       hint: 'react-i18next, react-intl', value: 'react' },
    { label: 'Angular',     hint: 'ngx-translate', value: 'angular' },
    { label: 'Svelte',      hint: 'svelte-i18n, typesafe-i18n', value: 'svelte' },
  ])
  return choice.value
}

async function stepLocaleDir() {
  const detected = detectLocaleDir()
  if (detected) {
    console.log(`\n${green('✓')} Found locale directory: ${cyan(detected)}`)
    const confirm = await askYesNo(`Use ${cyan(detected)}?`)
    if (confirm) return detected
  }
  return await ask('\nPath to locale files directory', './src/i18n/locales')
}

async function stepScanDir() {
  const detected = detectScanDir()
  console.log(`\n${green('✓')} Suggested scan directory: ${cyan(detected)}`)
  const confirm = await askYesNo(`Scan ${cyan(detected)} for i18n usage?`)
  if (confirm) return detected
  return await ask('Path to scan directory', './src')
}

async function stepLocales(localeDir) {
  console.log(`\nWhich locales does your project use?`)
  console.log(dim('  Enter locale codes separated by commas (e.g. de,en,fr)'))

  // Try to auto-detect
  const path = resolve(process.cwd(), localeDir)
  let detected = []
  if (existsSync(path)) {
    try {
      const entries = readdirSync(path)
      const jsonFiles = entries.filter(e => e.endsWith('.json')).map(e => e.replace('.json', ''))
      const dirs = entries.filter(e => { try { return statSync(resolve(path, e)).isDirectory() } catch { return false } })
      detected = jsonFiles.length > 0 ? jsonFiles : dirs
    } catch {}
  }

  const defaultLocales = detected.length > 0 ? detected.join(',') : 'de,en'
  if (detected.length > 0) {
    console.log(`${green('✓')} Detected locales: ${cyan(detected.join(', '))}`)
  }

  const input = await ask('Locales', defaultLocales)
  return input.split(',').map(l => l.trim()).filter(Boolean)
}

async function stepSourceLocale(locales) {
  console.log(`\nWhich is your ${bold('source')} locale? ${dim('(the reference language)')}`)
  locales.forEach((l, i) => console.log(`  ${cyan(i + 1 + '.')} ${l}`))
  const input = await ask('Choice', '1')
  const idx = parseInt(input) - 1
  return locales[Math.max(0, Math.min(idx, locales.length - 1))]
}

async function stepIgnoreKeys() {
  console.log(`\nAre there any key patterns to ignore? ${dim('(e.g. notifications.ticket.*)')}`)
  const input = await ask('Ignore keys (comma-separated, leave empty to skip)', '')
  if (!input) return []
  return input.split(',').map(k => k.trim()).filter(Boolean)
}

async function stepIgnoreText() {
  console.log(`\nAny text values to ignore in template checks? ${dim('(e.g. brand names like MEGWARE)')}`)
  const input = await ask('Ignore text (comma-separated, leave empty to skip)', '')
  if (!input) return []
  return input.split(',').map(t => t.trim()).filter(Boolean)
}

async function stepInstallTsx() {
  console.log(`\n${bold('tsx')} is required to run i18n-sentry TypeScript files directly.`)
  const hasTsx = run('npx tsx --version', true)
  if (hasTsx) {
    console.log(`${green('✓')} tsx is already available`)
    return false
  }
  return await askYesNo(`Install tsx as dev dependency?`)
}

async function stepInstallHook() {
  return await askYesNo(`\nInstall pre-commit hook? ${dim('(warns about i18n issues, never blocks commits)')}`)
}

async function stepAddScript() {
  return await askYesNo(`\nAdd ${cyan('lint:i18n')} script to package.json?`)
}


async function stepPackageJsonLocation() {
  const rootPkg = existsSync(resolve(process.cwd(), 'package.json'))

  const subDirs = ['src/ui', 'src/app', 'app', 'frontend', 'client']
  const subPkgs = subDirs.filter(d => existsSync(resolve(process.cwd(), d, 'package.json')))

  if (!rootPkg && subPkgs.length === 0) {
    console.log(yellow('No package.json found — skipping script addition'))
    return null
  }

  const choices = []

  if (rootPkg) {
    choices.push({
      label: `Root  ${dim('./package.json')}`,
      value: '.',
      script: 'npx tsx i18n-sentry/bin/i18n-scan.ts'
    })
  }

  for (const d of subPkgs) {
    const depth = d.split('/').length
    const backToRoot = Array(depth).fill('..').join('/')
    choices.push({
      label: `${d}  ${dim('./' + d + '/package.json')}`,
      value: d,
      script: `cd ${backToRoot} && npx tsx i18n-sentry/bin/i18n-scan.ts`
    })
  }

  if (choices.length === 1) {
    console.log(`\n${green('✓')} Found package.json at: ${cyan(choices[0].value === '.' ? 'root' : choices[0].value)}`)
    const confirm = await askYesNo(`Add lint:i18n script there?`)
    return confirm ? choices[0] : null
  }

  const choice = await askChoice(
    'Which package.json should get the lint:i18n script?',
    choices
  )
  return choice
}

// ── Writers ───────────────────────────────────────────────────────────────────

function writeConfig(cfg) {
  const configPath = resolve(process.cwd(), 'i18n-sentry.config.json')
  writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  console.log(`\n${green('✓')} Created ${cyan('i18n-sentry.config.json')}`)
}

function addPackageScript(location) {
  const pkgPath = resolve(process.cwd(), location.value, 'package.json')
  if (!existsSync(pkgPath)) {
    console.log(yellow('package.json not found — skipping script addition'))
    return
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.scripts = pkg.scripts ?? {}
  pkg.scripts['lint:i18n'] = location.script
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log(`${green('✓')} Added ${cyan('lint:i18n')} script to ${cyan(location.value === '.' ? 'package.json' : location.value + '/package.json')}`)
  console.log(`  ${dim('Command: ' + location.script)}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await stepWelcome()

  // Check if already configured
  if (existsSync(resolve(process.cwd(), 'i18n-sentry.config.json'))) {
    const overwrite = await askYesNo(`\n${yellow('X')} i18n-sentry.config.json already exists. Overwrite?`, false)
    if (!overwrite) {
      console.log(dim('\nSetup cancelled.'))
      rl.close()
      return
    }
  }

  const framework   = await stepFramework()
  const localeDir   = await stepLocaleDir()
  const scanDir     = await stepScanDir()
  const locales     = await stepLocales(localeDir)
  const sourceLocale = await stepSourceLocale(locales)
  const ignoreKeys  = await stepIgnoreKeys()
  const ignoreText  = await stepIgnoreText()
  const installTsx   = await stepInstallTsx()
  const installHook  = await stepInstallHook()
  const addScript    = await stepAddScript()
  const scriptLocation = addScript ? await stepPackageJsonLocation() : null

  // ── Apply ──────────────────────────────────────────────────────────────────

  console.log(`\n${bold('Applying configuration...')}\n`)

  // Write config
  writeConfig({
    localeDir,
    scanDir,
    locales,
    sourceLocale,
    ignoreKeys,
    ignoreRawText: ignoreText,
    textAttributes: [],
    warnAttributes: [],
  })

  // Install tsx
  if (installTsx) {
    console.log(`\n${dim('Installing tsx...')}`)
    const ok = run('npm install --save-dev tsx')
    if (ok) console.log(`${green('✓')} tsx installed`)
    else console.log(yellow('tsx installation failed — install manually: npm i -D tsx'))
  }

  // Install hook
  if (installHook) {
    const ok = run('node i18n-sentry/bin/install-hook.mjs', false)
    if (!ok) console.log(yellow('Hook installation failed — run manually: node i18n-sentry/bin/install-hook.mjs'))
  }

  // Add package.json script
  if (addScript && scriptLocation) {
    addPackageScript(scriptLocation)
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  console.log(`
${bold(green('✅  Setup complete!'))}

Run your first scan:
  ${cyan('npx tsx i18n-sentry/bin/i18n-scan.ts')}
${addScript ? `\nOr use the npm script:\n  ${cyan('npm run lint:i18n')}` : ''}
`)

  rl.close()
}

main().catch(err => {
  console.error(red('Setup failed:'), err)
  rl.close()
  process.exit(1)
})
