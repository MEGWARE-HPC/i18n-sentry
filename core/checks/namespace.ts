import { existsSync } from 'fs'
import { resolve } from 'path'
import { readJson } from '../../utils/files.js'
import { detectNamespaceConflicts } from '../locales.js'
import type { SentryConfig, Issue } from '../config.js'

export function checkNamespaceConflicts(config: SentryConfig): Issue[] {
  const issues: Issue[] = []

  for (const locale of config.locales) {
    const path = resolve(process.cwd(), `${config.localeDir}/${locale}.json`)
    if (!existsSync(path)) continue
    const raw = readJson(path)
    issues.push(...detectNamespaceConflicts(raw, locale))
  }

  return issues
}
