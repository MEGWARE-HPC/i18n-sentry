import { getIcuType } from '../icu-parser.js'
import type { SentryConfig, LocaleMap, Issue } from '../config.js'
import { isIgnoredKey } from '../filters.js'

export function checkIcuStructureMismatch(locales: LocaleMap, config: SentryConfig): Issue[] {
  const issues: Issue[] = []
  const otherLocales = config.locales.filter(l => l !== config.sourceLocale)

  for (const key of Object.keys(locales[config.sourceLocale])) {
    if (isIgnoredKey(key, config)) continue

    const sourceVal = locales[config.sourceLocale][key]
    if (typeof sourceVal !== 'string') continue

    const sourceType = getIcuType(sourceVal)

    for (const locale of otherLocales) {
      const targetVal = locales[locale][key]
      if (typeof targetVal !== 'string') continue

      const targetType = getIcuType(targetVal)

      if (sourceType !== targetType) {
        issues.push({
          key,
          locale: `${locale}.json`,
          msg: `ICU type mismatch: source is "${sourceType}", target is "${targetType}"`
        })
      }
    }
  }

  return issues
}
