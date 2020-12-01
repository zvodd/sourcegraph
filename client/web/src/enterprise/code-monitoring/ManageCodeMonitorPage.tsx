import React, { useEffect, useMemo } from 'react'
import * as H from 'history'
import { CodeMonitoringProps } from '.'
import { AuthenticatedUser } from '../../auth'
import { BreadcrumbSetters, BreadcrumbsProps } from '../../components/Breadcrumbs'
import { fetchCodeMonitor } from './backend'
import { RouteComponentProps } from 'react-router'
import { Scalars } from '../../../../shared/src/graphql-operations'
import { catchError, map, startWith, switchMap } from 'rxjs/operators'
import { useObservable } from '../../../../shared/src/util/useObservable'
import { asError, isErrorLike } from '../../../../shared/src/util/errors'

export interface ManageCodeMonitorPageProps
    extends RouteComponentProps<{ id: Scalars['ID'] }>,
        BreadcrumbsProps,
        BreadcrumbSetters,
        CodeMonitoringProps {
    authenticatedUser: AuthenticatedUser
    location: H.Location
    history: H.History
}

const LOADING = 'loading'

export const ManageCodeMonitorPage: React.FunctionComponent<ManageCodeMonitorPageProps> = props => {
    // const id = useMemo(() => props.match.params.id, [props])

    const codeMonitorsOrError = useObservable(
        useMemo(
            () =>
                fetchCodeMonitor(props.match.params.id).pipe(
                    startWith(LOADING),
                    catchError(error => [asError(error)])
                ),
            [props.match.params.id]
        )
    )

    return (
        <div>
            {codeMonitorsOrError === LOADING && <div>Loading</div>}
            {codeMonitorsOrError && codeMonitorsOrError !== LOADING && !isErrorLike(codeMonitorsOrError) && (
                <>
                    <div>{codeMonitorsOrError.node?.description}</div>
                    <div>{codeMonitorsOrError.node?.owner.namespaceName}</div>
                    <div>{codeMonitorsOrError.node?.trigger?.query}</div>
                </>
            )}
        </div>
    )
}
