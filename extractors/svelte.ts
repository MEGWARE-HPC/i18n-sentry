// Svelte extractor
// Supports:
//   svelte-i18n:
//     $_('key')
//     _('key')
//   typesafe-i18n:
//     $LL.namespace.key()
//     LL.namespace.key()
//   paraglide:
//     import ... 'paraglide'
//     m.namespace.key()

import { getLine } from '../utils/files.js'
import { isIgnoredText, isValidI18nKey } from '../core/filters.js'
import type { SentryConfig, FileIssue } from '../core/config.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitSvelteFile(source: string): { script: string; template: string } {
  const scriptMatch = source.match(/<script[\s\S]*?<\/script>/gi)
  const styleMatch  = source.match(/<style[\s\S]*?<\/style>/gi)

  let template = source

  if (scriptMatch) {
    for (const block of scriptMatch) {
      template = template.replace(block, '')
    }
  }

  if (styleMatch) {
    for (const block of styleMatch) {
      template = template.replace(block, '')
    }
  }

  return {
    script: (scriptMatch ?? []).join('\n'),
    template
  }
}

// ── Key Extractors ────────────────────────────────────────────────────────────

export function extractI18nKeys(source: string): { key: string; line: number }[] {
  const results: { key: string; line: number }[] = []
  const seen = new Set<string>()

  const { script, template } = splitSvelteFile(source)
  const searchable = `${script}\n${template}`

  function push(key: string, index: number) {
    const normalized = key.trim()
    if (!normalized) return
    if (!isValidI18nKey(normalized)) return

    const unique = `${normalized}@${index}`
    if (seen.has(unique)) return

    seen.add(unique)

    results.push({
      key: normalized,
      line: getLine(source, index)
    })
  }

  let m: RegExpExecArray | null

  // svelte-i18n: $_('key')
  const storeTranslateRe = /\$_\(\s*(['"])([^'"\n]+)\1/g
  while ((m = storeTranslateRe.exec(searchable)) !== null) {
    push(m[2], m.index)
  }

  // svelte-i18n: _('key')
  const directTranslateRe = /(?<!\$)_\(\s*(['"])([^'"\n]+)\1/g
  while ((m = directTranslateRe.exec(searchable)) !== null) {
    push(m[2], m.index)
  }

  // typesafe-i18n: $LL.key() or LL.key()
  const llRe = /\$?LL\.([\w.]+)\(/g
  while ((m = llRe.exec(searchable)) !== null) {
    const key = m[1].replace(/\.$/, '')
    if (isValidI18nKey(key)) push(key, m.index)
  }

  // paraglide: m.key()
  const hasParaglide = searchable.includes('paraglide') && /\bm\./.test(searchable)

  if (hasParaglide) {
    const paraglideRe = /\bm\.([\w.]+)\(/g
    while ((m = paraglideRe.exec(searchable)) !== null) {
      push(m[1], m.index)
    }
  }

  return results
}

// ── Hardcoded text ────────────────────────────────────────────────────────────

export function extractRawTextNodes(
  source: string,
  config: SentryConfig
): FileIssue[] {
  const { template } = splitSvelteFile(source)
  const results: FileIssue[] = []

  const re = />\s*([^<>{}][^<>{}]*)\s*</g
  let m: RegExpExecArray | null

  while ((m = re.exec(template)) !== null) {
    const text = m[1].replace(/\s+/g, ' ').trim()

    if (!text) continue
    if (text.length < 2 || /^[0-9]+$/.test(text) || /^[{}()[\]]+$/.test(text)) continue
    if (text.startsWith('{') || text.startsWith('//')) continue
    if (isIgnoredText(text, config)) continue

    results.push({ file: '', line: getLine(source, m.index), text })
  }

  return results
}

// ── Hardcoded attributes ──────────────────────────────────────────────────────

export function extractRawAttributes(
  source: string,
  errorAttrs: Set<string>,
  warnAttrs: Set<string>,
  config: SentryConfig
): { issue: FileIssue; level: 'error' | 'warning' }[] {
  const { template } = splitSvelteFile(source)
  const results: { issue: FileIssue; level: 'error' | 'warning' }[] = []

  const re = /(?<![:@{])([\w-]+)\s*=\s*(?:"([^"{]+)"|\{\s*"([^"]+)"\s*\})/g
  let m: RegExpExecArray | null

  while ((m = re.exec(template)) !== null) {
    const attr  = m[1]
    const value = (m[2] ?? m[3] ?? '').trim()

    const isError   = errorAttrs.has(attr)
    const isWarning = warnAttrs.has(attr)

    if (!isError && !isWarning) continue
    if (!value) continue
    if (isIgnoredText(value, config)) continue

    results.push({
      issue: { file: '', line: getLine(source, m.index), text: `${attr}="${value}"` },
      level: isError ? 'error' : 'warning'
    })
  }

  return results
}