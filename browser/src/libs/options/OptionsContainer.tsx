/* eslint rxjs/no-async-subscribe: warn */
/* eslint @typescript-eslint/no-misused-promises: warn */
import * as React from 'react'
import { Observable, of, Subject, Subscription } from 'rxjs'
import { catchError, distinctUntilChanged, filter, map, share, switchMap, concatMap } from 'rxjs/operators'
import { ErrorLike, isErrorLike, asError } from '../../../../shared/src/util/errors'
import { getExtensionVersion } from '../../shared/util/context'
import { OptionsHeader, OptionsHeaderProps } from './OptionsHeader'
import { ServerURLForm, ServerURLFormProps, ConnectionErrors } from './ServerURLForm'
import { OptionsMenuProps } from './OptionsMenu'

import { failedWithHTTPStatus } from '../../../../shared/src/backend/fetch'

export interface OptionsContainerProps {
    sourcegraphURL: string
    isActivated: boolean
    ensureValidSite: (url: string) => Observable<any>
    fetchCurrentTabStatus: () => Promise<OptionsMenuProps['currentTabStatus']>
    hasPermissions: (url: string) => Promise<boolean>
    requestPermissions: (url: string) => void
    setSourcegraphURL: (url: string) => Promise<void>
    toggleExtensionDisabled: (isActivated: boolean) => Promise<void>
    toggleFeatureFlag: (key: string) => void
    featureFlags: { key: string; value: boolean }[]
}

interface OptionsContainerState
    extends Pick<
            OptionsMenuProps,
            | 'status'
            | 'sourcegraphURL'
            | 'connectionError'
            | 'isSettingsOpen'
            | 'isActivated'
            | 'urlHasPermissions'
            | 'currentTabStatus'
        >,
        Pick<ServerURLFormProps, Exclude<keyof ServerURLFormProps, 'value' | 'onChange' | 'onSubmit'>> {
    sourcegraphURL: ServerURLFormProps['value']
    onURLChange: ServerURLFormProps['onChange']
    onURLSubmit: ServerURLFormProps['onSubmit']

    isSettingsOpen?: boolean
    isActivated: boolean
    toggleFeatureFlag: (key: string) => void
    featureFlags?: { key: string; value: boolean }[]
    currentTabStatus?: {
        host: string
        protocol: string
        hasPermissions: boolean
    }
}

const PERMISSIONS_PROTOCOL_BLACKLIST = ['chrome:', 'about:']

export class OptionsContainer extends React.Component<OptionsContainerProps, OptionsContainerState> {
    private version = getExtensionVersion()

    private urlUpdates = new Subject<string>()

    private activationClicks = new Subject<boolean>()

    private subscriptions = new Subscription()

    constructor(props: OptionsContainerProps) {
        super(props)

        this.state = {
            status: 'connecting',
            sourcegraphURL: props.sourcegraphURL,
            isActivated: props.isActivated,
            urlHasPermissions: false,
            connectionError: undefined,
            isSettingsOpen: false,
        }

        const fetchingSite: Observable<string | ErrorLike> = this.urlUpdates.pipe(
            distinctUntilChanged(),
            map(url => url.replace(/\/$/, '')),
            filter(maybeURL => {
                let validURL = false
                try {
                    validURL = !!new URL(maybeURL)
                } catch (e) {
                    validURL = false
                }

                return validURL
            }),
            switchMap(url => {
                this.setState({ status: 'connecting', connectionError: undefined })
                return this.props.ensureValidSite(url).pipe(
                    map(() => url),
                    catchError(err => of(asError(err)))
                )
            }),
            catchError(err => of(asError(err))),
            share()
        )

        this.subscriptions.add(
            fetchingSite.subscribe(async res => {
                let url = ''

                if (isErrorLike(res)) {
                    this.setState({
                        status: 'error',
                        connectionError: failedWithHTTPStatus(res, 401)
                            ? ConnectionErrors.AuthError
                            : ConnectionErrors.UnableToConnect,
                    })
                    url = this.state.sourcegraphURL
                } else {
                    this.setState({ status: 'connected' })
                    url = res
                }

                const urlHasPermissions = await props.hasPermissions(url)
                this.setState({ urlHasPermissions })

                await props.setSourcegraphURL(url)
            })
        )

        props
            .fetchCurrentTabStatus()
            .then(currentTabStatus => this.setState(state => ({ ...state, currentTabStatus })))
            .catch(err => {
                console.error('Error fetching current tab status', err)
            })
    }

    public componentDidMount(): void {
        this.urlUpdates.next(this.state.sourcegraphURL)
        this.subscriptions.add(
            this.activationClicks
                .pipe(concatMap(isActivated => this.props.toggleExtensionDisabled(isActivated)))
                .subscribe()
        )
    }

    public componentDidUpdate(): void {
        this.urlUpdates.next(this.props.sourcegraphURL)
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): React.ReactNode {
        return (
            <div className={`options-menu ${isFullPage() ? 'options-menu--full' : ''}`}>
                <OptionsHeader {...props} isActivated={isActivated} className="options-menu__section" />
                <ServerURLForm
                    {...props}
                    value={sourcegraphURL}
                    onChange={onURLChange}
                    onSubmit={onURLSubmit}
                    status={status}
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
                                    The Sourcegraph browser extension adds hover tooltips to code views on code hosts
                                    such as GitHub, GitLab, Bitbucket Server and Phabricator.
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
                {isSettingsOpen && featureFlags && (
                    <div className="options-menu__section">
                        <label>Configuration</label>
                        <div>
                            {featureFlags.map(({ key, value }) => (
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

    private handleURLChange = (value: string): void => {
        this.setState({ sourcegraphURL: value })
    }

    private handleURLSubmit = async (): Promise<void> => {
        await this.props.setSourcegraphURL(this.state.sourcegraphURL)
    }

    private handleSettingsClick = (): void => {
        this.setState(state => ({
            isSettingsOpen: !state.isSettingsOpen,
        }))
    }

    private handleToggleActivationClick = (value: boolean): void => this.activationClicks.next(value)
}
