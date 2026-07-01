// Angular extractor
// Supports ngx-translate patterns:
//   {{ 'key' | translate }}
//   {{ "key" | translate:{...} }}
//   <div [translate]="'key'"></div>
//   <div translate="key"></div>
//   this.translate.instant('key')
//   this.translate.get('key')
//   this.translate.stream('key')
//   this.translate.translate('key')  (v18 signal API)
//   translate('key')                 (v18 standalone)

import { getLine } from '../utils/files.js'
import { isIgnoredText, isValidI18nKey } from '../core/filters.js'
import type { SentryConfig, FileIssue } from '../core/config.js'

/** Strip <style> and <script> blocks before scanning for text */
function stripNonTextBlocks(source: string): string {
  return source
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
}

// ── Key Extractors ────────────────────────────────────────────────────────────

/** Extract all translation keys from Angular templates and TS files */
export function extractI18nKeys(source: string): { key: string; line: number }[] {
  const results: { key: string; line: number }[] = []
  const seen = new Set<string>()

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

  // 1. Pipe:
  //    {{ 'key' | translate }}
  //    {{ "key" | translate:{...} }}
  const pipeRe = /(['"])([^'"`]+)\1\s*\|\s*translate\b/g

  while ((m = pipeRe.exec(source)) !== null) {
    push(m[2], m.index)
  }

  // 2. Directive binding:
  //    [translate]="'key'"
  //    [translate]="\"key\""
  const directiveBindingRe =
    /\[translate\]\s*=\s*["']\s*(['"])([^'"]+)\1\s*["']/g

  while ((m = directiveBindingRe.exec(source)) !== null) {
    push(m[2], m.index)
  }

  // 3. Directive attribute:
  //    <div translate="key">
  const directiveAttrRe = /\btranslate\s*=\s*["']([^"'{}]+)["']/g

  while ((m = directiveAttrRe.exec(source)) !== null) {
    push(m[1], m.index)
  }

  // 4. Service methods:
  //    .instant('key')
  //    .get('key')
  //    .stream('key')
  //    .translate('key')
  const serviceRe =
    /\.(?:instant|get|stream|translate)\(\s*(['"])([^'"]+)\1/g

  while ((m = serviceRe.exec(source)) !== null) {
    push(m[2], m.index)
  }

  // 5. Standalone translate() function (ngx-translate v18)
  //    translate('key')
  const standaloneFnRe =
    /(?<![.\w$])translate\(\s*(['"])([^'"]+)\1/g

  while ((m = standaloneFnRe.exec(source)) !== null) {
    push(m[2], m.index)
  }

  // 6. Array syntax:
  //    translate.get(['a.b', 'c.d'])
  //    translate.instant(["a", "b"])
  const arrayMethodRe =
    /\.(?:instant|get|stream|translate)\(\s*\[([\s\S]*?)\]/g

  while ((m = arrayMethodRe.exec(source)) !== null) {
    const arrayContent = m[1]

    const keyRe = /(['"])([^'"]+)\1/g
    let keyMatch: RegExpExecArray | null

    while ((keyMatch = keyRe.exec(arrayContent)) !== null) {
      push(keyMatch[2], m.index + keyMatch.index)
    }
  }

  return results
}

/** Extract hardcoded strings from Angular HTML templates */
export function extractRawTextNodes(
  source: string,
  config: SentryConfig
): FileIssue[] {
  const cleaned = stripNonTextBlocks(source)
  const results: FileIssue[] = []

  // Text between tags — skip Angular expressions {{ }}
  const re = />([^<>]+)</g

  let m: RegExpExecArray | null

  while ((m = re.exec(cleaned)) !== null) {
    const text = m[1].trim()

    if (!text) continue

    // Angular interpolations
    if (text.includes('{{')) continue

    // Comments / pseudo text
    if (text.startsWith('//')) continue

    if (isIgnoredText(text, config)) continue

    results.push({
      file: '',
      line: getLine(source, m.index),
      text
    })
  }

  return results
}

/** Extract hardcoded attribute values from Angular templates */
export function extractRawAttributes(
  source: string,
  errorAttrs: Set<string>,
  warnAttrs: Set<string>,
  config: SentryConfig
): { issue: FileIssue; level: 'error' | 'warning' }[] {
  const results: {
    issue: FileIssue
    level: 'error' | 'warning'
  }[] = []

  // attr="value"
  // Skip Angular bindings:
  //   [attr]="..."
  //   *ngIf="..."
  //   (click)="..."
  //   #ref="..."
  const re =
    /(?<![\[\*\(#])([\w-]+)\s*=\s*"([^"{}]+)"/g

  let m: RegExpExecArray | null

  while ((m = re.exec(source)) !== null) {
    const attr = m[1]
    const value = m[2].trim()

    const isError = errorAttrs.has(attr)
    const isWarning = warnAttrs.has(attr)

    if (!isError && !isWarning) continue
    if (!value) continue
    if (isIgnoredText(value, config)) continue

    results.push({
      issue: {
        file: '',
        line: getLine(source, m.index),
        text: `${attr}="${value}"`
      },
      level: isError ? 'error' : 'warning'
    })
  }

  return results
}