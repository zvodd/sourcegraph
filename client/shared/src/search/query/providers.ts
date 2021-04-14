import * as Monaco from 'monaco-editor'
import { Observable, fromEventPattern, of, asyncScheduler, from, asapScheduler } from 'rxjs'
import { map, first, takeUntil, publishReplay, refCount, switchMap, debounceTime, share, observeOn } from 'rxjs/operators'

import { SearchPatternType } from '../../graphql-operations'
import { SearchSuggestion } from '../suggestions'

import { getCompletionItems } from './completion'
import { getMonacoTokens } from './decoratedToken'
import { getDiagnostics } from './diagnostics'
import { getHoverResult } from './hover'
import { scanSearchQuery } from './scanner'

interface SearchFieldProviders {
    tokens: Monaco.languages.TokensProvider
    hover: Monaco.languages.HoverProvider
    completion: Monaco.languages.CompletionItemProvider
    diagnostics: Observable<Monaco.editor.IMarkerData[]>
}

/**
 * A dummy scanner state, required for the token provider.
 */
const SCANNER_STATE: Monaco.languages.IState = {
    clone: () => ({ ...SCANNER_STATE }),
    equals: () => false,
}

const printable = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
const latin1Alpha = 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ'

let completionCalls = 0

/**
 * Returns the providers used by the Monaco query input to provide syntax highlighting,
 * hovers, completions and diagnostics for the Sourcegraph search syntax.
 */
export function getProviders(
    searchQueries: Observable<string>,
    fetchSuggestions: (input: string) => Observable<SearchSuggestion[]>,
    options: {
        patternType: SearchPatternType
        globbing: boolean
        enableSmartQuery: boolean
        interpretComments?: boolean
    }
): SearchFieldProviders {
    const scannedQueries = searchQueries.pipe(
        map(rawQuery => {
            const scanned = scanSearchQuery(rawQuery, options.interpretComments ?? false, options.patternType)
            return { rawQuery, scanned }
        }),
        publishReplay(1),
        refCount()
    )

    const debouncedDynamicSuggestions = searchQueries.pipe(debounceTime(300), switchMap(fetchSuggestions), share())

    return {
        tokens: {
            getInitialState: () => SCANNER_STATE,
            tokenize: line => {
                const result = scanSearchQuery(line, options.interpretComments ?? false, options.patternType)
                if (result.type === 'success') {
                    return {
                        tokens: getMonacoTokens(result.term, options.enableSmartQuery),
                        endState: SCANNER_STATE,
                    }
                }
                return { endState: SCANNER_STATE, tokens: [] }
            },
        },
        hover: {
            provideHover: (textModel, position, token) =>
                scannedQueries
                    .pipe(
                        first(),
                        map(({ scanned }) =>
                            scanned.type === 'error'
                                ? null
                                : getHoverResult(scanned.term, position, options.enableSmartQuery)
                        ),
                        takeUntil(fromEventPattern(handler => token.onCancellationRequested(handler)))
                    )
                    .toPromise(),
        },
        completion: {
            // An explicit list of trigger characters is needed for the Monaco editor to show completions.
            triggerCharacters: [...printable, ...latin1Alpha],
            provideCompletionItems: async (textModel, position, context, token) => {
                const call = ++completionCalls
                console.log(`${call} provider called`)
                const { scanned } = await scannedQueries.pipe(first()).toPromise()
                if (scanned.type === 'error') {
                    return null
                }
                const completions = await getCompletionItems(
                    scanned.term,
                    position,
                    debouncedDynamicSuggestions,
                    options.globbing
                    )
                // Yield to event loop before checking if cancellation token is cancelled
                // (assuming cancellation is async)
                await new Promise(resolve => setTimeout(resolve, 0))
                if (token.isCancellationRequested) {
                    console.log(`${call} provider cancelled`)
                    return undefined
                }
                console.log(`${call} provider returning`, completions)
                return completions

            }
        },
        diagnostics: scannedQueries.pipe(
            map(({ scanned }) => (scanned.type === 'success' ? getDiagnostics(scanned.term, options.patternType) : []))
        ),
    }
}
