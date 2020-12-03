import React, { useCallback, useMemo, useState } from 'react'
import * as H from 'history'
import { CodeMonitoringProps } from '.'
import { AuthenticatedUser } from '../../auth'
import { BreadcrumbSetters, BreadcrumbsProps } from '../../components/Breadcrumbs'
import { fetchCodeMonitor, updateCodeMonitor } from './backend'
import { RouteComponentProps } from 'react-router'
import { MonitorEmailPriority, Scalars } from '../../../../shared/src/graphql-operations'
import { catchError, map, mergeMap, startWith, tap } from 'rxjs/operators'
import { useEventObservable, useObservable } from '../../../../shared/src/util/useObservable'
import { asError, isErrorLike } from '../../../../shared/src/util/errors'
import { PageHeader } from '../../components/PageHeader'
import { PageTitle } from '../../components/PageTitle'
import { Form } from 'reactstrap'
import { Action, CodeMonitorFields, CodeMonitorForm } from './CodeMonitorForm'
import { Observable } from 'rxjs'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'

export interface ManageCodeMonitorPageProps
    extends RouteComponentProps<{ id: Scalars['ID'] }>,
        BreadcrumbsProps,
        BreadcrumbSetters,
        CodeMonitoringProps {
    authenticatedUser: AuthenticatedUser
    location: H.Location
    history: H.History
}

export const ManageCodeMonitorPage: React.FunctionComponent<ManageCodeMonitorPageProps> = props => {
    const LOADING = 'loading' as const

    const [codeMonitorState, setCodeMonitorState] = useState<CodeMonitorFields>({
        description: '',
        query: '',
        actions: [{ recipient: props.authenticatedUser.id, enabled: true }],
        enabled: true,
    })

    const codeMonitorOrError = useObservable(
        useMemo(
            () =>
                fetchCodeMonitor(props.match.params.id).pipe(
                    tap(monitor => {
                        setCodeMonitorState({
                            description: monitor.node?.description || '',
                            query: monitor.node?.trigger?.query || '',
                            actions: [{ recipient: props.authenticatedUser.id, enabled: true }],
                            enabled: monitor.node?.enabled || true,
                        })
                    }),
                    startWith(LOADING),
                    catchError(error => [asError(error)])
                ),
            [props.match.params.id, props.authenticatedUser.id]
        )
    )

    props.useBreadcrumb(
        useMemo(
            () => ({
                key: 'Manage Code Monitor',
                element: <>Manage code monitor</>,
            }),
            []
        )
    )

    const onNameChange = useCallback(
        (description: string): void => setCodeMonitorState(codeMonitor => ({ ...codeMonitor, description })),
        []
    )
    const onQueryChange = useCallback(
        (query: string): void => setCodeMonitorState(codeMonitor => ({ ...codeMonitor, query })),
        []
    )
    const onEnabledChange = useCallback(
        (enabled: boolean): void => setCodeMonitorState(codeMonitor => ({ ...codeMonitor, enabled })),
        []
    )
    const onActionsChange = useCallback(
        (actions: Action[]): void => setCodeMonitorState(codeMonitor => ({ ...codeMonitor, actions })),
        []
    )

    const [createRequest, updatedCodeMonitorOrError] = useEventObservable(
        useCallback(
            (submit: Observable<React.FormEvent<HTMLFormElement>>) =>
                submit.pipe(
                    tap(event => event.preventDefault()),
                    mergeMap(() =>
                        updateCodeMonitor(
                            {
                                id: props.match.params.id,
                                update: {
                                    namespace: props.authenticatedUser.id,
                                    description: codeMonitorState.description,
                                    enabled: codeMonitorState.enabled,
                                },
                            },
                            { id: props.match.params.id, update: { query: codeMonitorState.query } },
                            codeMonitorState.actions.map(action => ({
                                email: {
                                    id: props.match.params.id,
                                    update: {
                                        enabled: action.enabled,
                                        priority: MonitorEmailPriority.NORMAL,
                                        recipients: [props.authenticatedUser.id],
                                        header: '',
                                    },
                                },
                            }))
                        ).pipe(
                            map(codeMonitor => ({
                                description: codeMonitor.description,
                                query: codeMonitor.trigger?.query,
                                // TODO: this is hardcoded while we can only send emails to the owner of the code monitor.
                                actions: [{ recipient: props.authenticatedUser.id, enabled: true }],
                                enabled: codeMonitor.enabled,
                            })),
                            startWith(LOADING),
                            catchError(error => [asError(error)])
                        )
                    )
                ),
            [props.authenticatedUser, codeMonitorState, props.match.params.id]
        )
    )

    return (
        <div>
            <PageTitle title="Manage code monitor" />
            <PageHeader title="Manage code monitor" />
            Code monitors watch your code for specific triggers and run actions in response.{' '}
            <a href="" target="_blank" rel="noopener">
                {/* TODO: populate link */}
                Learn more
            </a>
            {codeMonitorOrError === 'loading' && <LoadingSpinner className="icon-inline" />}
            {codeMonitorOrError && !isErrorLike(codeMonitorOrError) && codeMonitorOrError !== 'loading' && (
                <Form className="my-4" onSubmit={createRequest}>
                    <CodeMonitorForm
                        {...props}
                        onNameChange={onNameChange}
                        onQueryChange={onQueryChange}
                        onEnabledChange={onEnabledChange}
                        onActionsChange={onActionsChange}
                        codeMonitor={codeMonitorState}
                        codeMonitorOrError={updatedCodeMonitorOrError}
                    />
                </Form>
            )}
        </div>
    )
}
