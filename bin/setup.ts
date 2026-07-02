#!/usr/bin/env node
// Interactive setup script for new projects
// Run: npx tsx i18n-sentry/bin/setup.ts

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve } from 'path'
import { createInterface } from 'readline'
import { execSync } from 'child_process'
import { red, yellow, cyan, green, bold, dim } from '../utils/colors.js'

// ── Readline ──────────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string, defaultValue?: string): Promise<string> {
  return new Promise(res => {
    const hint = defaultValue ? dim(` (${defaultValue})`) : ''
    rl.question(`${question}${hint}: `, answer => {
      res(answer.trim() || defaultValue || '')
    })
  })
}

function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  return new Promise(res => {
    const hint = defaultYes ? '[Y/n]' : '[y/N]'
    rl.question(`${question} ${dim(hint)}: `, answer => {
      const a = answer.trim().toLowerCase()
      if (!a) res(defaultYes)
      else res(a === 'y' || a === 'yes')
    })
  })
}

interface Choice { label: string; hint?: string; value: string; script?: string }

function askChoice(question: string, choices: Choice[]): Promise<Choice> {
  return new Promise(res => {
    console.log(`\n${question}`)
    choices.forEach((c, i) => console.log(`  ${cyan(String(i + 1) + '.')} ${c.label}  ${dim(c.hint ?? '')}`))
    rl.question(`\nChoice: `, answer => {
      const idx = parseInt(answer.trim()) - 1
      res(choices[idx] ?? choices[0])
    })
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd: string, silent = false): boolean {
  try {
    execSync(cmd, { stdio: silent ? 'pipe' : 'inherit' })
    return true
  } catch { return false }
}

function detectFramework(): string | null {
  const candidates = [
    'package.json', 'src/ui/package.json', 'src/app/package.json',
    'src/package.json', 'app/package.json', 'frontend/package.json', 'client/package.json',
  ]
  for (const candidate of candidates) {
    const pkgPath = resolve(process.cwd(), candidate)
    if (!existsSync(pkgPath)) continue
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps['@angular/core'])  return 'angular'
      if (deps['react'])          return 'react'
      if (deps['svelte'])         return 'svelte'
      if (deps['nuxt'] || deps['@nuxtjs/i18n'] || deps['vue-i18n']) return 'vue'
      if (deps['vue'])            return 'vue'
    } catch {}
  }
  return null
}

function detectLocaleDir(): string | null {
  const candidates = [
    './src/ui/i18n/locales', './src/i18n/locales', './src/locales',
    './public/i18n', './public/locales', './locales', './i18n',
  ]
  for (const c of candidates) {
    if (existsSync(resolve(process.cwd(), c))) return c
  }
  return null
}

function detectScanDir(): string {
  for (const c of ['./src/ui', './src/app', './src']) {
    if (existsSync(resolve(process.cwd(), c))) return c
  }
  return './src'
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

async function stepFramework(): Promise<string> {
  const detected = detectFramework()
  if (detected) {
    console.log(`\n${green('✓')} Detected framework: ${cyan(detected)}`)
    if (await askYesNo(`Use ${cyan(detected)}?`)) return detected
  }
  const choice = await askChoice('Which framework are you using?', [
    { label: 'Vue / Nuxt',  hint: 'vue-i18n, @nuxtjs/i18n', value: 'vue' },
    { label: 'React',       hint: 'react-i18next, react-intl', value: 'react' },
    { label: 'Angular',     hint: 'ngx-translate', value: 'angular' },
    { label: 'Svelte',      hint: 'svelte-i18n, typesafe-i18n', value: 'svelte' },
  ])
  return choice.value
}

async function stepLocaleDir(): Promise<string> {
  const detected = detectLocaleDir()
  if (detected) {
    console.log(`\n${green('✓')} Found locale directory: ${cyan(detected)}`)
    if (await askYesNo(`Use ${cyan(detected)}?`)) return detected
  }
  return await ask('\nPath to locale files directory', './src/i18n/locales')
}

async function stepScanDir(): Promise<string> {
  const detected = detectScanDir()
  console.log(`\n${green('✓')} Suggested scan directory: ${cyan(detected)}`)
  if (await askYesNo(`Scan ${cyan(detected)} for i18n usage?`)) return detected
  return await ask('Path to scan directory', './src')
}

async function stepLocales(localeDir: string): Promise<string[]> {
  console.log(`\nWhich locales does your project use?`)
  console.log(dim('  Enter locale codes separated by commas (e.g. de,en,fr)'))

  let detected: string[] = []
  const path = resolve(process.cwd(), localeDir)
  if (existsSync(path)) {
    try {
      const entries = readdirSync(path)
      const jsonFiles = entries.filter(e => e.endsWith('.json')).map(e => e.replace('.json', ''))
      const dirs = entries.filter(e => { try { return statSync(resolve(path, e)).isDirectory() } catch { return false } })
      detected = jsonFiles.length > 0 ? jsonFiles : dirs
    } catch {}
  }

  const defaultLocales = detected.length > 0 ? detected.join(',') : 'de,en'
  if (detected.length > 0) console.log(`${green('✓')} Detected locales: ${cyan(detected.join(', '))}`)

  const input = await ask('Locales', defaultLocales)
  return input.split(',').map(l => l.trim()).filter(Boolean)
}

async function stepSourceLocale(locales: string[]): Promise<string> {
  console.log(`\nWhich is your ${bold('source')} locale? ${dim('(the reference language)')}`)
  locales.forEach((l, i) => console.log(`  ${cyan(String(i + 1) + '.')} ${l}`))
  const input = await ask('Choice', '1')
  const idx = parseInt(input) - 1
  return locales[Math.max(0, Math.min(idx, locales.length - 1))]
}

async function stepIgnoreKeys(): Promise<string[]> {
  console.log(`\nAre there any key patterns to ignore? ${dim('(e.g. notifications.ticket.*)')}`)
  const input = await ask('Ignore keys (comma-separated, leave empty to skip)', '')
  if (!input) return []
  return input.split(',').map(k => k.trim()).filter(Boolean)
}

async function stepIgnoreText(): Promise<string[]> {
  console.log(`\nAny text values to ignore in template checks? ${dim('(e.g. brand names)')}`)
  const input = await ask('Ignore text (comma-separated, leave empty to skip)', '')
  if (!input) return []
  return input.split(',').map(t => t.trim()).filter(Boolean)
}

async function stepInstallTsx(): Promise<boolean> {
  console.log(`\n${bold('tsx')} is required to run i18n-sentry TypeScript files directly.`)
  if (run('npx tsx --version', true)) {
    console.log(`${green('✓')} tsx is already available`)
    return false
  }
  return await askYesNo(`Install tsx as dev dependency?`)
}

async function stepInstallHook(): Promise<boolean> {
  return await askYesNo(`\nInstall pre-commit hook? ${dim('(warns about i18n issues, never blocks commits)')}`)
}

async function stepAddScript(): Promise<boolean> {
  return await askYesNo(`\nAdd ${cyan('lint:i18n')} script to package.json?`)
}

async function stepPackageJsonLocation(): Promise<Choice | null> {
  const rootPkg = existsSync(resolve(process.cwd(), 'package.json'))
  const subDirs = ['src/ui', 'src/app', 'app', 'frontend', 'client']
  const subPkgs = subDirs.filter(d => existsSync(resolve(process.cwd(), d, 'package.json')))

  if (!rootPkg && subPkgs.length === 0) {
    console.log(yellow('! No package.json found — skipping script addition'))
    return null
  }

  const choices: Choice[] = []

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

  return await askChoice('Which package.json should get the lint:i18n script?', choices)
}

// ── Writers ───────────────────────────────────────────────────────────────────

function writeConfig(cfg: object) {
  const configPath = resolve(process.cwd(), 'i18n-sentry.config.json')
  writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  console.log(`\n${green('✓')} Created ${cyan('i18n-sentry.config.json')}`)
}

function addPackageScript(location: Choice) {
  const pkgPath = resolve(process.cwd(), location.value, 'package.json')
  if (!existsSync(pkgPath)) {
    console.log(yellow(' ! package.json not found — skipping'))
    return
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.scripts = pkg.scripts ?? {}
  if (location.script) {
    pkg.scripts['lint:i18n'] = location.script
}
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log(`${green('✓')} Added ${cyan('lint:i18n')} to ${cyan(location.value === '.' ? 'package.json' : location.value + '/package.json')}`)
  console.log(`  ${dim('Command: ' + location.script)}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await stepWelcome()

  if (existsSync(resolve(process.cwd(), 'i18n-sentry.config.json'))) {
    const overwrite = await askYesNo(`\n${yellow('!')} i18n-sentry.config.json already exists. Overwrite?`, false)
    if (!overwrite) {
      console.log(dim('\nSetup cancelled.'))
      rl.close()
      return
    }
  }

  const framework      = await stepFramework()
  const localeDir      = await stepLocaleDir()
  const scanDir        = await stepScanDir()
  const locales        = await stepLocales(localeDir)
  const sourceLocale   = await stepSourceLocale(locales)
  const ignoreKeys     = await stepIgnoreKeys()
  const ignoreText     = await stepIgnoreText()
  const installTsx     = await stepInstallTsx()
  const installHook    = await stepInstallHook()
  const addScript      = await stepAddScript()
  const scriptLocation = addScript ? await stepPackageJsonLocation() : null

  console.log(`\n${bold('Applying configuration...')}\n`)

  writeConfig({ localeDir, scanDir, locales, sourceLocale, ignoreKeys, ignoreRawText: ignoreText, textAttributes: [], warnAttributes: [] })

  if (installTsx) {
    console.log(dim('\nInstalling tsx...'))
    if (run('npm install --save-dev tsx')) console.log(`${green('✓')} tsx installed`)
    else console.log(yellow('! tsx installation failed — run: npm i -D tsx'))
  }

  if (installHook) {
    const ok = run(`npx tsx "${resolve(process.cwd(), 'i18n-sentry/bin/install-hook.ts')}"`)
    if (!ok) console.log(yellow('! Hook installation failed — run manually'))
  }

  if (addScript && scriptLocation) addPackageScript(scriptLocation)

  console.log(`
${bold(green(' ✓ Setup complete!'))}

Run your first scan:
  ${cyan('npx tsx i18n-sentry/bin/i18n-scan.ts')}
${addScript ? `\nOr:\n  ${cyan('npm run lint:i18n')}` : ''}
`)

  rl.close()
}

main().catch(err => {
  console.error(red('Setup failed:'), err)
  rl.close()
  process.exit(1)
})
