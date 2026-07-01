import type { SentryConfig, LocaleMap, FileIssue } from '../config.js'
import { isIgnoredKey } from '../filters.js'

export function checkMissingKeys(
  keys: { key: string; line: number }[],
  file: string,
  locales: LocaleMap,
  config: SentryConfig
): FileIssue[] {
  const issues: FileIssue[] = []

  for (const { key, line } of keys) {
    if (isIgnoredKey(key, config)) continue
    const missingIn = config.locales.filter(locale => !locales[locale]?.[key])
    if (missingIn.length > 0) {
      issues.push({ file, line, key, missingIn })
    }
  }

  return issues
}
