import classnames from 'classnames'
import * as H from 'history'
import { Toggle } from '../../../../../branded/src/components/Toggle'
import { asError, isErrorLike } from '../../../../../shared/src/util/errors'
import { AuthenticatedUser } from '../../../auth'
import { CodeMonitorFields } from '../../../graphql-operations'
import React, { FunctionComponent, useCallback, useState } from 'react'
import { Observable } from 'rxjs'
import { mergeMap, startWith, tap, catchError } from 'rxjs/operators'
import { useEventObservable } from '../../../../../shared/src/util/useObservable'
import { Form } from '../../../../../branded/src/components/Form'
import { FormActionArea } from './FormActionArea'
import { FormTriggerArea } from './FormTriggerArea'

const LOADING = 'loading' as const
interface CodeMonitorFormProps {
    location: H.Location
    authenticatedUser: AuthenticatedUser
    onSubmit: (codeMonitor: CodeMonitorFields) => Observable<Partial<CodeMonitorFields>>
    codeMonitor?: CodeMonitorFields

    submitButtonLabel: string
}

export interface FormCompletionSteps {
    triggerCompleted: boolean
    actionCompleted: boolean
}

export const CodeMonitorForm: FunctionComponent<CodeMonitorFormProps> = props => {
    const [codeMonitorState, setCodeMonitorState] = useState<CodeMonitorFields>(
        props.codeMonitor ?? {
            id: '',
            description: '',
            enabled: true,
            trigger: { id: '', query: '' },
            actions: {
                nodes: [],
            },
        }
    )

    const [formCompletion, setFormCompletion] = useState<FormCompletionSteps>({
        triggerCompleted: codeMonitorState.trigger.query.length > 0,
        actionCompleted: codeMonitorState.actions.nodes.length > 0,
    })

    const setTriggerCompleted = useCallback((completed: boolean) => {
        setFormCompletion(previousState => ({ ...previousState, triggerCompleted: completed }))
    }, [])

    const setActionCompleted = useCallback((completed: boolean) => {
        setFormCompletion(previousState => ({ ...previousState, actionCompleted: completed }))
    }, [])

    const onNameChange = useCallback(
        (description: string): void => setCodeMonitorState(codeMonitor => ({ ...codeMonitor, description })),
        []
    )
    const onQueryChange = useCallback(
        (query: string): void =>
            setCodeMonitorState(codeMonitor => ({ ...codeMonitor, trigger: { ...codeMonitor.trigger, query } })),
        []
    )
    const onEnabledChange = useCallback(
        (enabled: boolean): void => setCodeMonitorState(codeMonitor => ({ ...codeMonitor, enabled })),
        []
    )
    const onActionsChange = useCallback(
        (actions: CodeMonitorFields['actions']): void =>
            setCodeMonitorState(codeMonitor => ({ ...codeMonitor, actions })),
        []
    )

    const { onSubmit } = props

    const [onSubmitRequest, latestValue] = useEventObservable(
        useCallback(
            (submit: Observable<React.FormEvent<HTMLFormElement>>) =>
                submit.pipe(
                    tap(event => event.preventDefault()),
                    mergeMap(() =>
                        onSubmit(codeMonitorState).pipe(
                            startWith(LOADING),
                            catchError(error => [asError(error)])
                        )
                    )
                ),
            [codeMonitorState, onSubmit]
        )
    )

    return (
        <Form className="my-4" onSubmit={onSubmitRequest}>
            <div className="flex mb-4">
                Name
                <div>
                    <input
                        type="text"
                        className="form-control my-2 test-name-input"
                        required={true}
                        onChange={event => {
                            onNameChange(event.target.value)
                        }}
                        value={codeMonitorState.description}
                        autoFocus={true}
                    />
                </div>
                <small className="text-muted">
                    Give it a short, descriptive name to reference events on Sourcegraph and in notifications. Do not
                    include:{' '}
                    <a href="" target="_blank" rel="noopener">
                        {/* TODO: populate link */}
                        confidential information
                    </a>
                    .
                </small>
            </div>
            <div className="flex">
                Owner
                <select className="form-control my-2 w-auto" disabled={true}>
                    <option value={props.authenticatedUser.displayName || props.authenticatedUser.username}>
                        {props.authenticatedUser.username}
                    </option>
                </select>
                <small className="text-muted">Event history and configuration will not be shared.</small>
            </div>
            <hr className="my-4" />
            <div className="create-monitor-page__triggers mb-4">
                <FormTriggerArea
                    query={codeMonitorState.trigger.query}
                    onQueryChange={onQueryChange}
                    triggerCompleted={formCompletion.triggerCompleted}
                    setTriggerCompleted={setTriggerCompleted}
                />
            </div>
            <div
                className={classnames({
                    'create-monitor-page__actions--disabled': !formCompletion.triggerCompleted,
                })}
            >
                <FormActionArea
                    actions={codeMonitorState.actions}
                    setActionCompleted={setActionCompleted}
                    actionCompleted={formCompletion.actionCompleted}
                    authenticatedUser={props.authenticatedUser}
                    disabled={!formCompletion.triggerCompleted}
                    onActionsChange={onActionsChange}
                />
            </div>
            <div>
                <div className="d-flex my-4">
                    <div>
                        <Toggle
                            title="Active"
                            value={codeMonitorState.enabled}
                            onToggle={onEnabledChange}
                            className="mr-2"
                        />{' '}
                    </div>
                    <div className="flex-column">
                        <div>Active</div>
                        <div className="text-muted">We will watch for the trigger and run actions in response</div>
                    </div>
                </div>
                <div className="flex my-4">
                    <button
                        type="submit"
                        disabled={
                            !formCompletion.actionCompleted || isErrorLike(latestValue) || latestValue === LOADING
                        }
                        className="btn btn-primary mr-2 test-submit-monitor"
                    >
                        {props.submitButtonLabel}
                    </button>
                    <button type="button" className="btn btn-outline-secondary">
                        {/* TODO: this should link somewhere */}
                        Cancel
                    </button>
                </div>
                {/** TODO: Error and success states. We will probably redirect the user to another page, so we could remove the success state. */}
                {!isErrorLike(latestValue) && !!latestValue && latestValue !== LOADING && (
                    <div className="alert alert-success">Successfully created monitor {latestValue.description}</div>
                )}
                {isErrorLike(latestValue) && (
                    <div className="alert alert-danger">Failed to create monitor: {latestValue.message}</div>
                )}
            </div>
        </Form>
    )
}
