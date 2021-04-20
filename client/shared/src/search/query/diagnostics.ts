import * as Monaco from 'monaco-editor'

import { SearchPatternType } from '../../graphql-operations'

import { toMonacoRange } from './decoratedToken'
import { validateFilter } from './filters'
import { Predicate, scanPredicate } from './predicates'
import { scanSearchQuery } from './scanner'
import { CharacterRange, Filter, Token } from './token'

const validContainsBody = (
    tokens: Token[],
    predicate: Predicate,
    range: CharacterRange
): Monaco.editor.IMarkerData[] => {
    const fileIndex = tokens.findIndex(token => token.type === 'filter' && token.field.value === 'file')
    if (fileIndex !== -1) {
        tokens.splice(fileIndex, 1)
    }
    const contentIndex = tokens.findIndex(token => token.type === 'filter' && token.field.value === 'content')
    if (contentIndex !== -1) {
        tokens.splice(contentIndex, 1)
    }
    const offset = predicate.path.join('.').length + 1
    const length = predicate.parameters.length - 2
    if (tokens.filter(value => value.type !== 'whitespace').length > 0) {
        console.log(`Emit diagnostic: ${JSON.stringify(tokens.filter(value => value.type !== 'whitespace'))}`)
        return [
            {
                severity: Monaco.MarkerSeverity.Error,
                message: 'Unrecognized predicate argument. Expecting file:pattern, content:pattern, or both.',
                ...toMonacoRange({ start: range.start + offset, end: range.start + offset + length }),
            },
        ]
    }
    return []
}

export const predicateDiagnostics = (token: Filter): Monaco.editor.IMarkerData[] => {
    const { field, value } = token
    const predicate = scanPredicate(field.value, value?.value || '')
    if (predicate && token.value) {
        const result = scanSearchQuery(predicate.parameters.slice(1, -1), false, SearchPatternType.regexp)
        if (result.type === 'error') {
            return []
        }
        const check = validContainsBody([...result.term], predicate, token.value.range)
        console.log(`check: ${JSON.stringify(check)}`)
        return check
    }
    return []
}

export const filterDiagnostics = (token: Filter): Monaco.editor.IMarkerData[] => {
    const { field, value } = token
    const validationResult = validateFilter(field.value, value)
    if (validationResult.valid) {
        return []
    }
    return [
        {
            severity: Monaco.MarkerSeverity.Error,
            message: validationResult.reason,
            ...toMonacoRange(field.range),
        },
    ]
}

/**
 * Returns the diagnostics for a scanned search query to be displayed in the Monaco query input.
 */
export function getDiagnostics(tokens: Token[], patternType: SearchPatternType): Monaco.editor.IMarkerData[] {
    const diagnostics: Monaco.editor.IMarkerData[] = []
    for (const token of tokens) {
        if (token.type === 'filter') {
            diagnostics.push(...filterDiagnostics(token))
            diagnostics.push(...predicateDiagnostics(token))
        } else if (token.type === 'literal' && token.quoted) {
            if (patternType === SearchPatternType.literal) {
                diagnostics.push({
                    severity: Monaco.MarkerSeverity.Warning,
                    message:
                        'Your search is interpreted literally and contains quotes. Did you mean to search for quotes?',
                    ...toMonacoRange(token.range),
                })
            }
        }
    }
    return diagnostics
}
