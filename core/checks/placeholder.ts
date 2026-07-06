import type { Issue, LocaleMap, SentryConfig } from "../config.js";
import { isIgnoredKey } from "../filters.js";
import { getVariables } from "../icu-parser.js";

export function checkPlaceholderMismatch(locales: LocaleMap, config: SentryConfig): Issue[] {
    const issues: Issue[] = [];
    const otherLocales = config.locales.filter((l) => l !== config.sourceLocale);

    for (const key of Object.keys(locales[config.sourceLocale])) {
        if (isIgnoredKey(key, config)) continue;

        const sourceVal = locales[config.sourceLocale][key];
        if (typeof sourceVal !== "string") continue;

        const sourceVars = getVariables(sourceVal);

        for (const locale of otherLocales) {
            const targetVal = locales[locale][key];
            if (typeof targetVal !== "string") continue;

            const targetVars = getVariables(targetVal);

            const missingInTarget = [...sourceVars].filter((v) => !targetVars.has(v));
            const extraInTarget = [...targetVars].filter((v) => !sourceVars.has(v));

            if (missingInTarget.length > 0) {
                issues.push({
                    key,
                    locale: `${locale}.json`,
                    msg: `Missing placeholders: {${missingInTarget.join("}, {")}}`,
                });
            }

            if (extraInTarget.length > 0) {
                issues.push({
                    key,
                    locale: `${locale}.json`,
                    msg: `Extra placeholders not in source: {${extraInTarget.join("}, {")}}`,
                });
            }
        }
    }

    return issues;
}
