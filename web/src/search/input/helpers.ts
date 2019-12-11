import { FiltersToTypeAndValue } from '../../../../shared/src/search/interactive/util'

export function generateFiltersQuery(filtersInQuery: FiltersToTypeAndValue): string {
    const fieldKeys = Object.keys(filtersInQuery)
    const individualTokens: string[] = []
    fieldKeys
        .filter(key => filtersInQuery[key].value.trim().length > 0)
        .map(key => individualTokens.push(`${filtersInQuery[key].type}:${filtersInQuery[key].value}`))

    return individualTokens.join(' ')
}
