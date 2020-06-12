import AlertCircleIcon from 'mdi-react/AlertCircleIcon'
import MapSearchIcon from 'mdi-react/MapSearchIcon'
import React, { useEffect, useCallback } from 'react'
import { Route, RouteComponentProps, Switch } from 'react-router'
import { Observable, merge, of } from 'rxjs'
import { catchError, map, startWith, switchMap, switchMapTo } from 'rxjs/operators'
import { extensionIDsFromSettings } from '../../../shared/src/extensions/extension'
import { queryConfiguredRegistryExtensions } from '../../../shared/src/extensions/helpers'
import { gql } from '../../../shared/src/graphql/graphql'
import * as GQL from '../../../shared/src/graphql/schema'
import { PlatformContextProps } from '../../../shared/src/platform/context'
import { gqlToCascade, SettingsCascadeProps } from '../../../shared/src/settings/settings'
import { asError, createAggregateError, ErrorLike, isErrorLike } from '../../../shared/src/util/errors'
import { queryGraphQL } from '../backend/graphql'
import { HeroPage } from '../components/HeroPage'
import { ThemeProps } from '../../../shared/src/theme'
import { eventLogger } from '../tracking/eventLogger'
import { mergeSettingsSchemas } from './configuration'
import { SettingsPage } from './SettingsPage'
import { ErrorMessage } from '../components/alerts'
import * as H from 'history'
import { useEventObservable } from '../../../shared/src/util/useObservable'

const NotFoundPage: React.FunctionComponent = () => <HeroPage icon={MapSearchIcon} title="404: Not Found" />

/** Props shared by SettingsArea and its sub-pages. */
interface SettingsAreaPageCommonProps extends PlatformContextProps, SettingsCascadeProps, ThemeProps {
    /** The subject whose settings to edit. */
    subject: Pick<GQL.SettingsSubject, '__typename' | 'id'>

    /**
     * The currently authenticated user, NOT (necessarily) the user who is the subject of the page.
     */
    authenticatedUser: GQL.IUser | null
}

interface SettingsData {
    subjects: GQL.ISettingsCascade['subjects']
    settingsJSONSchema: { $id: string }
}

/** Properties passed to all pages in the settings area. */
export interface SettingsAreaPageProps extends SettingsAreaPageCommonProps {
    /** The settings data, or null if the subject has no settings yet. */
    data: SettingsData

    /** Called when the page updates the subject's settings. */
    onUpdate: () => void
}

interface Props extends SettingsAreaPageCommonProps, RouteComponentProps<{}> {
    className?: string
    extraHeader?: JSX.Element
    history: H.History
}

/**
 * A settings area with a top-level JSON editor and sub-pages for editing nested settings values.
 */
export const SettingsArea: React.FunctionComponent<Props> = props => {
    useEffect(() => {
        eventLogger.logViewEvent(`Settings${props.subject.__typename}`)
    }, [props.subject])

    const [nextRefreshRequest, dataOrError] = useEventObservable(
        useCallback(
            (refreshRequests: Observable<void>): Observable<SettingsData | ErrorLike | undefined> =>
                refreshRequests.pipe(
                    startWith<void>(undefined),
                    switchMapTo(
                        merge(
                            of(undefined),
                            fetchSettingsCascade(props.subject.id).pipe(
                                switchMap(cascade =>
                                    queryConfiguredRegistryExtensions(
                                        props.platformContext,
                                        extensionIDsFromSettings(gqlToCascade(cascade))
                                    ).pipe(
                                        catchError(error => {
                                            console.warn(
                                                'Unable to get extension settings JSON Schemas for settings editor.',
                                                {
                                                    error,
                                                }
                                            )
                                            return [null]
                                        }),
                                        map(configuredExtensions => ({
                                            subjects: cascade.subjects,
                                            settingsJSONSchema: {
                                                $id: 'mergedSettings.schema.json#',
                                                ...(configuredExtensions
                                                    ? mergeSettingsSchemas(configuredExtensions)
                                                    : null),
                                            },
                                        }))
                                    )
                                )
                            )
                        )
                    ),
                    catchError(error => [asError(error)])
                ),
            [props.platformContext, props.subject.id]
        )
    )

    const onUpdate = useCallback((): void => nextRefreshRequest(), [nextRefreshRequest])

    if (dataOrError === undefined) {
        return null // loading
    }
    if (isErrorLike(dataOrError)) {
        return (
            <HeroPage
                icon={AlertCircleIcon}
                title="Error"
                subtitle={<ErrorMessage error={dataOrError} history={props.history} />}
            />
        )
    }

    let term: string
    switch (props.subject.__typename) {
        case 'User':
            term = 'User'
            break
        case 'Org':
            term = 'Organization'
            break
        case 'Site':
            term = 'Global'
            break
        case 'DefaultSettings':
            term = 'Default settings'
            break
        default:
            term = 'Unknown'
            break
    }

    const transferProps: SettingsAreaPageProps = {
        data: dataOrError,
        subject: props.subject,
        authenticatedUser: props.authenticatedUser,
        onUpdate,
        isLightTheme: props.isLightTheme,
        platformContext: props.platformContext,
        settingsCascade: props.settingsCascade,
    }

    return (
        <div className={`h-100 d-flex flex-column ${props.className || ''}`}>
            <h2>{term} settings</h2>
            {props.extraHeader}
            <Switch>
                {/* eslint-disable react/jsx-no-bind */}
                <Route
                    path={props.match.url}
                    key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                    exact={true}
                    render={routeComponentProps => <SettingsPage {...routeComponentProps} {...transferProps} />}
                />
                <Route key="hardcoded-key" component={NotFoundPage} />
                {/* eslint-enable react/jsx-no-bind */}
            </Switch>
        </div>
    )
}

function fetchSettingsCascade(subject: GQL.ID): Observable<Pick<GQL.ISettingsCascade, 'subjects'>> {
    return queryGraphQL(
        gql`
            query SettingsCascade($subject: ID!) {
                settingsSubject(id: $subject) {
                    settingsCascade {
                        subjects {
                            latestSettings {
                                id
                                contents
                            }
                        }
                    }
                }
            }
        `,
        { subject }
    ).pipe(
        map(({ data, errors }) => {
            if (!data || !data.settingsSubject) {
                throw createAggregateError(errors)
            }
            return data.settingsSubject.settingsCascade
        })
    )
}
