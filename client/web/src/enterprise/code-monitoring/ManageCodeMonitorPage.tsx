import React, { useCallback, useMemo, useState } from 'react'
import * as H from 'history'
import { CodeMonitoringProps } from '.'
import { authenticatedUser, AuthenticatedUser } from '../../auth'
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

    const [initialMonitor, setInitialMonitor] = useState<CodeMonitorFields>({
        description: '',
        query: '',
        actions: [{ recipient: props.authenticatedUser.id, enabled: true }],
        enabled: true,
    })

    const [hasDifference, setHasDifference] = useState(false)

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
                        setInitialMonitor({
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

    // const onNameChange = useCallback(
    //     (description: string): void =>
    //         setCodeMonitorState(codeMonitor => {
    //             if (description !== initialMonitor.description) {
    //                 setHasDifference(true)
    //             }
    //             return { ...codeMonitor, description }
    //         }),
    //     [initialMonitor]
    // )

    // const onQueryChange = useCallback(
    //     (query: string): void =>
    //         setCodeMonitorState(codeMonitor => {
    //             if (query !== initialMonitor.query) {
    //                 setHasDifference(true)
    //             }
    //             return { ...codeMonitor, query }
    //         }),
    //     [initialMonitor]
    // )

    // const onEnabledChange = useCallback(
    //     (enabled: boolean): void =>
    //         setCodeMonitorState(codeMonitor => {
    //             if (enabled !== initialMonitor.enabled) {
    //                 setHasDifference(true)
    //             }
    //             return { ...codeMonitor, enabled }
    //         }),
    //     [initialMonitor]
    // )

    // const onActionsChange = useCallback(
    //     (actions: Action[]): void =>
    //         setCodeMonitorState(codeMonitor => {
    //             if (actions !== initialMonitor.actions) {
    //                 setHasDifference(true)
    //             }
    //             return { ...codeMonitor, actions }
    //         }),
    //     [initialMonitor]
    // )

    // const [createRequest, updatedCodeMonitorOrError] = useEventObservable(
    //     useCallback(
    //         (submit: Observable<React.FormEvent<HTMLFormElement>>) =>
    //             submit.pipe(
    //                 tap(event => event.preventDefault()),
    //                 mergeMap(() =>
    //                     updateCodeMonitor(
    //                         {
    //                             id: props.match.params.id,
    //                             update: {
    //                                 namespace: props.authenticatedUser.id,
    //                                 description: codeMonitorState.description,
    //                                 enabled: codeMonitorState.enabled,
    //                             },
    //                         },
    //                         { id: props.match.params.id, update: { query: codeMonitorState.query } },
    //                         codeMonitorState.actions.map(action => ({
    //                             email: {
    //                                 id: props.match.params.id,
    //                                 update: {
    //                                     enabled: action.enabled,
    //                                     priority: MonitorEmailPriority.NORMAL,
    //                                     recipients: [props.authenticatedUser.id],
    //                                     header: '',
    //                                 },
    //                             },
    //                         }))
    //                     ).pipe(
    //                         map(codeMonitor => ({
    //                             description: codeMonitor.description,
    //                             query: codeMonitor.trigger?.query,
    //                             // TODO: this is hardcoded while we can only send emails to the owner of the code monitor.
    //                             actions: [{ recipient: props.authenticatedUser.id, enabled: true }],
    //                             enabled: codeMonitor.enabled,
    //                         })),
    //                         startWith(LOADING),
    //                         catchError(error => [asError(error)])
    //                     )
    //                 )
    //             ),
    //         [props.authenticatedUser, codeMonitorState, props.match.params.id]
    //     )
    // )

    const updateMonitorRequest = useCallback(
        (codeMonitor: CodeMonitorFields): Observable<Partial<CodeMonitorFields>> =>
            updateCodeMonitor(
                {
                    id: props.match.params.id,
                    update: {
                        namespace: props.authenticatedUser.id,
                        description: codeMonitor.description,
                        enabled: codeMonitor.enabled,
                    },
                },
                { id: props.match.params.id, update: { query: codeMonitor.query } },
                codeMonitor.actions.map(action => ({
                    email: {
                        id: action.recipient,
                        update: {
                            enabled: action.enabled,
                            priority: MonitorEmailPriority.NORMAL,
                            recipients: [props.authenticatedUser.id],
                            header: '',
                        },
                    },
                }))
            ).pipe(
                map(monitor => ({
                    ...monitor,
                    actions: [
                        {
                            recipient: props.authenticatedUser.id,
                            enabled: true,
                        },
                    ],
                }))
            ),
        [props.authenticatedUser.id, props.match.params.id]
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
                <>
                    <CodeMonitorForm
                        {...props}
                        onSubmit={updateMonitorRequest}
                        codeMonitor={codeMonitorState}
                        codeMonitorOrError={updatedCodeMonitorOrError}
                    />
                    <div className="flex my-4">
                        <button
                            type="submit"
                            disabled={!hasDifference}
                            className="btn btn-primary mr-2 test-submit-monitor"
                        >
                            Save
                        </button>
                        <button type="button" className="btn btn-outline-secondary">
                            {/* TODO: this should link somewhere */}
                            Cancel
                        </button>
                    </div>
                    {isErrorLike(codeMonitorOrError) && (
                        <div className="alert alert-danger">Failed to create monitor: {codeMonitorOrError.message}</div>
                    )}
                </>
            )}
        </div>
    )
}
