import { FiltersToTypeAndValue } from './InteractiveModeInput'

export function generateFieldsQuery(fieldValues: FiltersToTypeAndValue): string {
    const fieldKeys = Object.keys(fieldValues)
    const individualTokens: string[] = []
    fieldKeys
        .filter(key => fieldValues[key].value.trim().length > 0)
        .map(key => individualTokens.push(`${fieldValues[key].type}:${fieldValues[key].value}`))

    return individualTokens.join(' ')
}
