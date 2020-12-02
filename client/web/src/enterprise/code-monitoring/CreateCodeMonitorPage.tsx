import * as H from 'history'
import VideoInputAntennaIcon from 'mdi-react/VideoInputAntennaIcon'
import React, { useCallback, useMemo, useState } from 'react'
import { Form } from '../../../../branded/src/components/Form'
import { AuthenticatedUser } from '../../auth'
import { BreadcrumbSetters, BreadcrumbsProps } from '../../components/Breadcrumbs'
import { PageHeader } from '../../components/PageHeader'
import { PageTitle } from '../../components/PageTitle'
import { useEventObservable } from '../../../../shared/src/util/useObservable'
import { createCodeMonitor } from './backend'
import { MonitorEmailPriority } from '../../../../shared/src/graphql/schema'
import { Observable } from 'rxjs'
import { catchError, mergeMap, startWith, tap } from 'rxjs/operators'
import { asError } from '../../../../shared/src/util/errors'
import { CodeMonitorForm } from './CodeMonitorForm'

export interface CreateCodeMonitorPageProps extends BreadcrumbsProps, BreadcrumbSetters {
    location: H.Location
    authenticatedUser: AuthenticatedUser
}

export interface FormCompletionSteps {
    triggerCompleted: boolean
    actionCompleted: boolean
}

export interface Action {
    recipient: string
    enabled: boolean
}
export interface CodeMonitorFields {
    description: string
    query: string
    enabled: boolean
    action?: Action
}

export const CreateCodeMonitorPage: React.FunctionComponent<CreateCodeMonitorPageProps> = props => {
    props.useBreadcrumb(
        useMemo(
            () => ({
                key: 'Create Code Monitor',
                element: <>Create new code monitor</>,
            }),
            []
        )
    )

    const LOADING = 'loading' as const

    const [codeMonitor, setCodeMonitor] = useState<CodeMonitorFields>({
        description: '',
        query: '',
        action: undefined,
        enabled: true,
    })

    const onNameChange = useCallback(
        (description: string): void => setCodeMonitor(codeMonitor => ({ ...codeMonitor, description })),
        []
    )
    const onQueryChange = useCallback(
        (query: string): void => setCodeMonitor(codeMonitor => ({ ...codeMonitor, query })),
        []
    )
    const onEnabledChange = useCallback(
        (enabled: boolean): void => setCodeMonitor(codeMonitor => ({ ...codeMonitor, enabled })),
        []
    )
    const onActionChange = useCallback(
        (action: Action): void => setCodeMonitor(codeMonitor => ({ ...codeMonitor, action })),
        []
    )

    const [createRequest, codeMonitorOrError] = useEventObservable(
        useCallback(
            (submit: Observable<React.FormEvent<HTMLFormElement>>) =>
                submit.pipe(
                    tap(event => event.preventDefault()),
                    mergeMap(() =>
                        createCodeMonitor({
                            monitor: {
                                namespace: props.authenticatedUser.id,
                                description: codeMonitor.description,
                                enabled: codeMonitor.enabled,
                            },
                            trigger: { query: codeMonitor.query },
                            actions: [
                                {
                                    email: {
                                        enabled: codeMonitor.action.enabled,
                                        priority: MonitorEmailPriority.NORMAL,
                                        recipients: [props.authenticatedUser.id],
                                        header: '',
                                    },
                                },
                            ],
                        }).pipe(
                            startWith(LOADING),
                            catchError(error => [asError(error)])
                        )
                    )
                ),
            [props.authenticatedUser, codeMonitor]
        )
    )

    return (
        <div className="container mt-3 web-content">
            <PageTitle title="Create new code monitor" />
            <PageHeader title="Create new code monitor" icon={VideoInputAntennaIcon} />
            Code monitors watch your code for specific triggers and run actions in response.{' '}
            <a href="" target="_blank" rel="noopener">
                {/* TODO: populate link */}
                Learn more
            </a>
            <Form className="my-4" onSubmit={createRequest}>
                <CodeMonitorForm
                    {...props}
                    onNameChange={onNameChange}
                    onQueryChange={onQueryChange}
                    onEnabledChange={onEnabledChange}
                    onActionChange={onActionChange}
                    codeMonitor={codeMonitor}
                    codeMonitorOrError={codeMonitorOrError}
                />
            </Form>
        </div>
    )
}
