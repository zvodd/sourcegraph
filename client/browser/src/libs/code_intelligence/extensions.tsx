import * as React from 'react'
import { render } from 'react-dom'
import { ContributableMenu } from '../../../../../shared/src/api/protocol'
import { CommandListPopoverButton } from '../../../../../shared/src/commandPalette/CommandList'
import { Notifications } from '../../../../../shared/src/notifications/Notifications'

import * as H from 'history'
import {
    createController as createExtensionsController,
    ExtensionsControllerProps,
} from '../../../../../shared/src/extensions/controller'
import { PlatformContextProps } from '../../../../../shared/src/platform/context'
import { TelemetryContext } from '../../../../../shared/src/telemetry/telemetryContext'
import { createPlatformContext } from '../../platform/context'
import { GlobalDebug } from '../../shared/components/GlobalDebug'
import { ShortcutProvider } from '../../shared/components/ShortcutProvider'
import { eventLogger } from '../../shared/util/context'
import { getGlobalDebugMount } from '../github/extensions'
import { CodeHost } from './code_intelligence'

/**
 * Initializes extensions for a page. It creates the {@link PlatformContext} and extensions controller.
 *
 * If the "Use extensions" feature flag is enabled (or always for Sourcegraph.com), it injects the command palette.
 * If extensions are not supported by the associated Sourcegraph instance, the extensions controller will behave as
 * though no individual extensions are enabled, which makes it effectively a noop.
 */
export function initializeExtensions({
    getCommandPaletteMount,
    urlToFile,
}: Pick<CodeHost, 'getCommandPaletteMount' | 'urlToFile'>): PlatformContextProps & ExtensionsControllerProps {
    const platformContext = createPlatformContext({ urlToFile })
    const extensionsController = createExtensionsController(platformContext)
    const history = H.createBrowserHistory()

    if (getCommandPaletteMount) {
        render(
            <ShortcutProvider>
                <TelemetryContext.Provider value={eventLogger}>
                    <CommandListPopoverButton
                        extensionsController={extensionsController}
                        menu={ContributableMenu.CommandPalette}
                        platformContext={platformContext}
                        location={history.location}
                    />
                    <Notifications extensionsController={extensionsController} />
                </TelemetryContext.Provider>
            </ShortcutProvider>,
            getCommandPaletteMount()
        )
    }

    render(
        <GlobalDebug
            extensionsController={extensionsController}
            location={history.location}
            platformContext={platformContext}
        />,
        getGlobalDebugMount()
    )

    return { platformContext, extensionsController }
}
