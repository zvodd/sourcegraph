import * as Monaco from 'monaco-editor'

import { toMonacoRange } from './decoratedToken'
import { Token } from './token'

/**
 * Returns the hover result for a hovered search token in the Monaco query input.
 */
export const getActions = (
    tokens: Token[],
    position: Monaco.Range,
    context: Monaco.languages.CodeActionContext,
    model: Monaco.editor.ITextModel
): Monaco.languages.CodeActionList => {
    console.log(`position: ${JSON.stringify(position)}`)
    /*
    const diagnostics: Monaco.editor.IMarkerData[] = []
    diagnostics.push({
        severity: Monaco.MarkerSeverity.Error,
        message: 'butter is not cake',
        ...toMonacoRange(tokens[0].range),
    })
    */
    console.log(`actions baby: markers ${JSON.stringify(context.markers)} readonly ${JSON.stringify(context.only)}`)
    const actions: Monaco.languages.CodeAction[] = []
    for (const marker of context.markers) {
        actions.push(
            {
                title: 'Fix',
                diagnostics: [marker],
                edit: {
                    edits: [
                        {
                            resource: model.uri,
                            edit: {
                                range: new Monaco.Range(1, 1, 1, 9),
                                text: '"Hello world!"',
                            },
                        },
                    ],
                },
                kind: 'quickfix',
            },
            {
                title: 'Derp',
                diagnostics: [marker],
                edit: {
                    edits: [
                        {
                            resource: model.uri,
                            edit: {
                                range: new Monaco.Range(1, 1, 1, 9),
                                text: '"Hello world!"',
                            },
                        },
                    ],
                },
                kind: 'quickfix',
            }
        )
    }
    console.log(`Built action: ${JSON.stringify(actions)}`)
    return { actions, dispose: () => null }
}
