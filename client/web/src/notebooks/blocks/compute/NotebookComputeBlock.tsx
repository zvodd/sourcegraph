/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-var-requires */
import classNames from 'classnames'
import React, { useRef } from 'react'

import { ThemeProps } from '@sourcegraph/shared/src/theme'

import { BlockProps, ComputeBlock } from '../..'
import { NotebookBlockMenu } from '../menu/NotebookBlockMenu'
import { useCommonBlockMenuActions } from '../menu/useCommonBlockMenuActions'
import blockStyles from '../NotebookBlock.module.scss'
import { useBlockSelection } from '../useBlockSelection'
import { useBlockShortcuts } from '../useBlockShortcuts'

// eslint-disable-next-line import/extensions
// import { Elm } from './component/compute.js'
import { Elm } from './component/src/Main.elm'
import styles from './NotebookComputeBlock.module.scss'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElmComponent = require('react-elm-components')

interface ComputeBlockProps extends BlockProps, ComputeBlock, ThemeProps {
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

export const NotebookComputeBlock: React.FunctionComponent<ComputeBlockProps> = ({
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
    const isInputFocused = false
    const blockElement = useRef<HTMLDivElement>(null)

    const { onSelect } = useBlockSelection({
        id,
        blockElement: blockElement.current,
        isSelected,
        isInputFocused,
        onSelectBlock,
        ...props,
    })

    const { onKeyDown } = useBlockShortcuts({
        id,
        isMacPlatform,
        onEnterBlock: () => {},
        ...props,
        onRunBlock: () => {},
    })

    const modifierKeyLabel = isMacPlatform ? '⌘' : 'Ctrl'
    const commonMenuActions = useCommonBlockMenuActions({
        modifierKeyLabel,
        isInputFocused,
        isReadOnly,
        isMacPlatform,
        ...props,
    })

    const blockMenu = isSelected && !isReadOnly && <NotebookBlockMenu id={id} actions={commonMenuActions} />

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
                <div className="elm">
                    <ElmComponent src={Elm.Main} ports={setupPorts} flags={null} />
                </div>
            </div>
            {blockMenu}
        </div>
    )
}
