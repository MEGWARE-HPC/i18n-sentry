import { parseIcuMessage } from '../icu-parser.js'
import type { SentryConfig, LocaleMap, Issue } from '../config.js'
import { isIgnoredKey } from '../filters.js'

export function checkInvalidKeys(locales: LocaleMap, config: SentryConfig): Issue[] {
  const issues: Issue[] = []

  for (const locale of config.locales) {
    for (const [key, value] of Object.entries(locales[locale])) {
      if (isIgnoredKey(key, config)) continue
      if (typeof value !== 'string') continue

      const { errors } = parseIcuMessage(value)
      for (const msg of errors) {
        issues.push({ key, locale: `${locale}.json`, msg })
      }
    }
  }

  return issues
}
