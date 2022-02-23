/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-var-requires */
import classNames from 'classnames'
import PencilIcon from 'mdi-react/PencilIcon'
import PlayCircleOutlineIcon from 'mdi-react/PlayCircleOutlineIcon'
import * as Monaco from 'monaco-editor'
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'

import { ThemeProps } from '@sourcegraph/shared/src/theme'

// eslint-disable-next-line import/extensions
// import Main from './compute.js'
import blockStyles from './SearchNotebookBlock.module.scss'
import { BlockMenuAction, SearchNotebookBlockMenu } from './SearchNotebookBlockMenu'
import styles from './SearchNotebookComputeBlock.module.scss'
// eslint-disable-next-line import/extensions
// import COMPUTE from './compute.js'
// eslint-disable-next-line import/extensions
import { App } from './computeModule.js'

// import Main from './todomvc.js'
import { useBlockSelection } from './useBlockSelection'
import { useBlockShortcuts } from './useBlockShortcuts'
import { useCommonBlockMenuActions } from './useCommonBlockMenuActions'

import { BlockProps, ComputeBlock } from '.'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
// eslint-disable-next-line @typescript-eslint/no-var-requires
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Elm = require('react-elm-components')

interface SearchNotebookComputeBlockProps extends BlockProps, ComputeBlock, ThemeProps {
    isMacPlatform: boolean
}

function setupPorts(ports: {
    receiveEvent: {
        send: (argument0: {
            data: any // Can't be null according to spec
            eventType: any
            id: any
        }) => void
    }
    openStream: { subscribe: (argument0: (args: any) => void) => void }
}) {
    let sources: { [key: string]: EventSource } = {}

    function sendEventToElm(event: any) {
        console.log(`Full Event: ${JSON.stringify(event)}`)
        console.log(`Event: ${JSON.stringify(event.type)} : ${JSON.stringify(event.data)}`)
        ports.receiveEvent.send({
            data: event.data, // Can't be null according to spec
            eventType: event.type || null,
            id: event.id || null,
        })
    }

    function newEventSource(address: string) {
        sources[address] = new EventSource(address)
        return sources[address]
    }

    function deleteAllEventSources() {
        for (const [key] of Object.entries(sources)) {
            deleteEventSource(key)
        }
    }

    function deleteEventSource(address: string) {
        sources[address].close()
        delete sources[address]
    }

    ports.openStream.subscribe((args: any[]) => {
        deleteAllEventSources() // Pre-emptively close any open streams if we receive a request to open a new stream before seeing 'done'.
        console.log(`JS Port openStream. Args: ${JSON.stringify(args[0])}`)
        const address = args[0] // We could listen on a specific event and get args[1] from the Elm app. No need for this right now.

        const eventSource = newEventSource(address)
        eventSource.addEventListener('error', (error: any) => {
            console.log(`EventSource failed: ${JSON.stringify(error)}`)
        })
        eventSource.addEventListener('results', sendEventToElm)
        eventSource.addEventListener('alert', sendEventToElm)
        eventSource.addEventListener('error', sendEventToElm)
        eventSource.addEventListener('done', (event: any) => {
            console.log('Done')
            deleteEventSource(address)
            // Note: 'done:true' is sent in progress too. But we want a 'done' for the entire stream in case we don't see it.
            sendEventToElm({ type: 'done', data: '' })
        })
    })
}

export const SearchNotebookComputeBlock: React.FunctionComponent<SearchNotebookComputeBlockProps> = ({
    id,
    input,
    output,
    isSelected,
    isLightTheme,
    isMacPlatform,
    isReadOnly,
    onRunBlock,
    onSelectBlock,
    ...props
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editor, setEditor] = useState<Monaco.editor.IStandaloneCodeEditor>()
    const blockElement = useRef<HTMLDivElement>(null)

    const runBlock = useCallback(
        (id: string) => {
            onRunBlock(id)
            setIsEditing(false)
        },
        [onRunBlock, setIsEditing]
    )

    /*
    const { isInputFocused } = useMonacoBlockInput({
        editor,
        id,
        ...props,
        onSelectBlock,
        onRunBlock: runBlock,
    })
    */
    const isInputFocused = false

    const onDoubleClick = useCallback(() => {
        if (isReadOnly) {
            return
        }
        if (!isEditing) {
            setIsEditing(true)
            onSelectBlock(id)
        }
    }, [id, isReadOnly, isEditing, setIsEditing, onSelectBlock])

    // setTimeout turns on editing mode in a separate run-loop which prevents adding a newline at the start of the input
    const onEnterBlock = useCallback(() => {
        if (isReadOnly) {
            return
        }
        setTimeout(() => setIsEditing(true), 0)
    }, [isReadOnly, setIsEditing])

    const { onSelect } = useBlockSelection({
        id,
        blockElement: blockElement.current,
        isSelected,
        isInputFocused,
        onSelectBlock,
        ...props,
    })

    const { onKeyDown } = useBlockShortcuts({ id, isMacPlatform, onEnterBlock, ...props, onRunBlock: runBlock })

    useEffect(() => {
        if (isEditing) {
            editor?.focus()
        }
    }, [isEditing, editor])

    const modifierKeyLabel = isMacPlatform ? '⌘' : 'Ctrl'
    const commonMenuActions = useCommonBlockMenuActions({
        modifierKeyLabel,
        isInputFocused,
        isReadOnly,
        isMacPlatform,
        ...props,
    })
    const menuActions = useMemo(() => {
        const action: BlockMenuAction[] = [
            isEditing
                ? {
                      type: 'button',
                      label: 'Render',
                      icon: <PlayCircleOutlineIcon className="icon-inline" />,
                      onClick: runBlock,
                      keyboardShortcutLabel: `${modifierKeyLabel} + ↵`,
                  }
                : {
                      type: 'button',
                      label: 'Edit',
                      icon: <PencilIcon className="icon-inline" />,
                      onClick: onEnterBlock,
                      keyboardShortcutLabel: '↵',
                  },
        ]
        return action.concat(commonMenuActions)
    }, [isEditing, modifierKeyLabel, runBlock, onEnterBlock, commonMenuActions])

    const blockMenu = isSelected && !isReadOnly && <SearchNotebookBlockMenu id={id} actions={menuActions} />

    return (
        <div className={classNames('block-wrapper', blockStyles.blockWrapper)} data-block-id={id}>
            {/* See the explanation for the disable above. */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
                className={classNames(
                    blockStyles.block,
                    styles.input,
                    (isInputFocused || isSelected) && blockStyles.selected
                )}
                onClick={onSelect}
                onFocus={onSelect}
                onKeyDown={onKeyDown}
                // A tabIndex is necessary to make the block focusable.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                aria-label="Notebook compute block"
                ref={blockElement}
            >
                <div className={blockStyles.monacoWrapper}>
                    {/*
                    <MonacoEditor
                        language="markdown"
                        value={input}
                        height="auto"
                        isLightTheme={isLightTheme}
                        editorWillMount={noop}
                        onEditorCreated={setEditor}
                        options={MONACO_BLOCK_INPUT_OPTIONS}
                        border={false}
                    />
                    */}
                </div>
                <div className="elm">
                    <Elm src={App.Main} ports={setupPorts} flags={null} />
                </div>
            </div>
            {blockMenu}
        </div>
    )
}
