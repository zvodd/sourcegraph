import React, { useCallback, useMemo, useState } from 'react'
import * as H from 'history'
import { CodeMonitoringProps } from '.'
import { AuthenticatedUser } from '../../auth'
import { BreadcrumbSetters, BreadcrumbsProps } from '../../components/Breadcrumbs'
import { fetchCodeMonitor, updateCodeMonitor } from './backend'
import { RouteComponentProps } from 'react-router'
import { MonitorEmailPriority, Scalars } from '../../../../shared/src/graphql-operations'
import { catchError, startWith, tap } from 'rxjs/operators'
import { useObservable } from '../../../../shared/src/util/useObservable'
import { asError, isErrorLike } from '../../../../shared/src/util/errors'
import { PageHeader } from '../../components/PageHeader'
import { PageTitle } from '../../components/PageTitle'
import { CodeMonitorForm } from './CodeMonitorForm'
import { Observable } from 'rxjs'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import { CodeMonitorFields } from '../../graphql-operations'

export interface ManageCodeMonitorPageProps
    extends RouteComponentProps<{ id: Scalars['ID'] }>,
        BreadcrumbsProps,
        BreadcrumbSetters,
        CodeMonitoringProps {
    authenticatedUser: AuthenticatedUser
    location: H.Location
    history: H.History
}

// id: string
//     description: string
//     enabled: boolean
//     trigger: Maybe<{ query: string }>
//     actions: { nodes: Array<{ enabled: boolean; recipients: { nodes: Array<{ id: string } | { id: string }> } }> }

export const ManageCodeMonitorPage: React.FunctionComponent<ManageCodeMonitorPageProps> = props => {
    const LOADING = 'loading' as const

    const [codeMonitorState, setCodeMonitorState] = useState<CodeMonitorFields>({
        id: '',
        description: '',
        enabled: true,
        trigger: null,
        actions: { nodes: [{ id: '', enabled: true, recipients: { nodes: [{ id: props.authenticatedUser.id }] } }] },
    })

    // const [initial, setInitialMonitor] = useState<CodeMonitorFields>({
    //     id: '',
    //     description: '',
    //     enabled: true,
    //     trigger: null,
    //     actions: { nodes: [{ id: '', enabled: true, recipients: { nodes: [{ id: props.authenticatedUser.id }] } }] },
    // })

    // const [hasDifference, setHasDifference] = useState(false)

    const codeMonitorOrError = useObservable(
        useMemo(
            () =>
                fetchCodeMonitor(props.match.params.id).pipe(
                    tap(monitor => {
                        if (monitor?.node !== null) {
                            setCodeMonitorState(monitor.node)
                            // setInitialMonitor(monitor.node)
                        }
                    }),
                    startWith(LOADING),
                    catchError(error => [asError(error)])
                ),
            [props.match.params.id]
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
                { id: codeMonitor.trigger?.id || '', update: { query: codeMonitor.trigger?.query || '' } },
                codeMonitor.actions.nodes.map(action => ({
                    email: {
                        id: action.id,
                        update: {
                            enabled: action.enabled,
                            priority: MonitorEmailPriority.NORMAL,
                            recipients: [props.authenticatedUser.id],
                            header: '',
                        },
                    },
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
                    <CodeMonitorForm {...props} onSubmit={updateMonitorRequest} codeMonitor={codeMonitorState} />
                </>
            )}
        </div>
    )
}
