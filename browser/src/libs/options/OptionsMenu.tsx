/* eslint rxjs/no-async-subscribe: warn */
/* eslint @typescript-eslint/no-misused-promises: warn */
import React, { useCallback, useState, useMemo } from 'react'
import { upperFirst, lowerCase } from 'lodash'
import { Observable, from } from 'rxjs'
import { getExtensionVersion } from '../../shared/util/context'
import { ServerURLForm, SourcegraphURLWithStatus } from './ServerURLForm'
import { useObservable } from '../../../../shared/src/util/useObservable'
import SettingsOutlineIcon from 'mdi-react/SettingsOutlineIcon'
import { Toggle } from '../../../../shared/src/components/Toggle'
import { catchError } from 'rxjs/operators'

interface CurrentTabStatus {
    host: string
    protocol: string
    hasPermissions: boolean
}

export interface OptionsMenuProps {
    observeIsDisabled: () => Observable<boolean | undefined>
    toggleExtensionDisabled: (isActivated: boolean) => Promise<void>
    observeSourcegraphURL: () => Observable<SourcegraphURLWithStatus>
    persistSourcegraphURL: (url: string) => void
    fetchCurrentTabStatus: () => Promise<CurrentTabStatus>
    requestPermissions: (url: string) => void
    observeFeatureFlags: () => Observable<{ [featureFlag: string]: boolean } | undefined>
    toggleFeatureFlag: (key: string) => void
}

const buildRequestPermissionsHandler = (
    { protocol, host }: NonNullable<CurrentTabStatus>,
    requestPermissions: OptionsMenuProps['requestPermissions']
) => (event: React.MouseEvent) => {
    event.preventDefault()
    requestPermissions(`${protocol}//${host}`)
}

const buildFeatureFlagToggleHandler = (key: string, handler: OptionsMenuProps['toggleFeatureFlag']) => () =>
    handler(key)

const PERMISSIONS_PROTOCOL_BLACKLIST = ['chrome:', 'about:']

export const OptionsMenu: React.FunctionComponent<OptionsMenuProps> = ({
    observeFeatureFlags,
    fetchCurrentTabStatus,
    observeIsDisabled,
    toggleExtensionDisabled,
    observeSourcegraphURL,
    persistSourcegraphURL,
    requestPermissions,
    toggleFeatureFlag,
}) => {
    const version = getExtensionVersion()
    const isFullPage = !new URLSearchParams(window.location.search).get('popup')
    const [settingsOpen, setSettingsOpen] = useState<boolean>()
    const toggleSettingsOpen = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            setSettingsOpen(!settingsOpen)
        },
        [settingsOpen]
    )
    const sourcegraphURLAndStatus = useObservable(useMemo(() => observeSourcegraphURL(), [observeSourcegraphURL]))
    console.log(sourcegraphURLAndStatus)
    const currentTabStatus = useObservable(
        useMemo(() => from(fetchCurrentTabStatus()).pipe(catchError(err => [undefined])), [fetchCurrentTabStatus])
    )
    const isDisabled = useObservable(useMemo(() => observeIsDisabled(), [observeIsDisabled]))
    const featureFlags = useObservable(useMemo(() => observeFeatureFlags(), [observeFeatureFlags]))
    if (!sourcegraphURLAndStatus) {
        return null
    }
    return (
        <div className={`options-menu ${isFullPage ? 'options-menu--full' : ''}`}>
            <div className="options-menu__section options-header">
                <div>
                    <img src="img/sourcegraph-logo.svg" className="options-header__logo" />
                    <div className="options-header__version">v{version}</div>
                </div>
                <div className="options-header__right">
                    <button
                        type="button"
                        className="options-header__settings btn btn-icon"
                        onClick={toggleSettingsOpen}
                    >
                        <SettingsOutlineIcon className="icon-inline" />
                    </button>
                    <Toggle
                        value={!isDisabled}
                        onToggle={toggleExtensionDisabled}
                        title={isDisabled ? 'Toggle to enable extension' : 'Toggle to disable extension'}
                    />
                </div>
            </div>
            <ServerURLForm
                sourcegraphURLAndStatus={sourcegraphURLAndStatus}
                persistSourcegraphURL={persistSourcegraphURL}
                requestPermissions={requestPermissions}
                className="options-menu__section"
            />
            {status === 'connected' &&
                currentTabStatus &&
                !currentTabStatus.hasPermissions &&
                !PERMISSIONS_PROTOCOL_BLACKLIST.includes(currentTabStatus.protocol) && (
                    <div className="options-menu__section">
                        <div className="alert alert-info">
                            <p>
                                The Sourcegraph browser extension adds hover tooltips to code views on code hosts such
                                as GitHub, GitLab, Bitbucket Server and Phabricator.
                            </p>
                            <p>
                                You must grant permissions to enable Sourcegraph on{' '}
                                <strong>{currentTabStatus.host}</strong>.
                            </p>
                            <button
                                type="button"
                                className="btn btn-light request-permissions__test"
                                onClick={buildRequestPermissionsHandler(currentTabStatus, requestPermissions)}
                            >
                                Grant permissions
                            </button>
                        </div>
                    </div>
                )}
            <div className="options-menu__section">
                <p>
                    Learn more about privacy concerns, troubleshooting and extension features{' '}
                    <a href="https://docs.sourcegraph.com/integration/browser_extension" target="blank">
                        here
                    </a>
                    .
                </p>
                <p>
                    Search open source software at{' '}
                    <a href="https://sourcegraph.com/search" target="blank">
                        sourcegraph.com/search
                    </a>
                    .
                </p>
            </div>
            {settingsOpen && featureFlags && (
                <div className="options-menu__section">
                    <label>Configuration</label>
                    <div>
                        {Object.entries(featureFlags).map(([key, value]) => (
                            <div className="form-check" key={key}>
                                <label className="form-check-label">
                                    <input
                                        id={key}
                                        onChange={buildFeatureFlagToggleHandler(key, toggleFeatureFlag)}
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={value}
                                    />{' '}
                                    {upperFirst(lowerCase(key))}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
