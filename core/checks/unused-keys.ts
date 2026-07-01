import { readFile } from '../../utils/files.js'
import type { SentryConfig, LocaleMap, Issue } from '../config.js'
import { isIgnoredKey } from '../filters.js'

export function checkUnusedKeys(
  files: string[],
  locales: LocaleMap,
  config: SentryConfig
): Issue[] {
  // Concatenate all sources once for fast string search
  const allSources = files.map(f => readFile(f)).join('\n')
  const unused: Issue[] = []

  for (const key of Object.keys(locales[config.sourceLocale])) {
    if (isIgnoredKey(key, config)) continue
    if (!allSources.includes(key)) {
      unused.push({ key })
    }
  }

  return unused
}
