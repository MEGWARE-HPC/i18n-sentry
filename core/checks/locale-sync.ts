import type { SentryConfig, LocaleMap, Issue } from '../config.js'
import { isIgnoredKey } from '../filters.js'

export function checkLocaleSync(locales: LocaleMap, config: SentryConfig): Issue[] {
  const issues: Issue[] = []
  const otherLocales = config.locales.filter(l => l !== config.sourceLocale)

  // Source → others
  for (const key of Object.keys(locales[config.sourceLocale])) {
    if (isIgnoredKey(key, config)) continue
    const missingIn = otherLocales
      .filter(locale => !(key in locales[locale]))
      .map(l => `${l}.json`)
    if (missingIn.length > 0) {
      issues.push({ key, missingIn })
    }
  }

  // Others → source
  for (const locale of otherLocales) {
    for (const key of Object.keys(locales[locale])) {
      if (isIgnoredKey(key, config)) continue
      if (!(key in locales[config.sourceLocale])) {
        issues.push({ key, missingIn: [`${config.sourceLocale}.json`] })
      }
    }
  }

  return issues
}
