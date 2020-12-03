import classnames from 'classnames'
import OpenInNewIcon from 'mdi-react/OpenInNewIcon'
import * as H from 'history'
import { Toggle } from '../../../../branded/src/components/Toggle'
import { FilterType } from '../../../../shared/src/search/interactive/util'
import { resolveFilter, validateFilter } from '../../../../shared/src/search/parser/filters'
import { scanSearchQuery } from '../../../../shared/src/search/parser/scanner'
import { asError, isErrorLike } from '../../../../shared/src/util/errors'
import { buildSearchURLQuery } from '../../../../shared/src/util/url'
import { useInputValidation, deriveInputClassName } from '../../../../shared/src/util/useInputValidation'
import { AuthenticatedUser } from '../../auth'
import { CodeMonitorFields, SearchPatternType } from '../../graphql-operations'
import React, { FormEventHandler, FunctionComponent, useCallback, useMemo, useState } from 'react'
import { Link } from '../../../../shared/src/components/Link'
import { Observable } from 'rxjs'
import { mergeMap, startWith, tap, catchError } from 'rxjs/operators'
import { useEventObservable } from '../../../../shared/src/util/useObservable'
import { Form } from '../../../../branded/src/components/Form'

const LOADING = 'loading' as const
interface CodeMonitorFormProps {
    location: H.Location
    authenticatedUser: AuthenticatedUser
    onSubmit: (codeMonitor: CodeMonitorFields) => Observable<Partial<CodeMonitorFields>>
    codeMonitor?: CodeMonitorFields
}

export interface FormCompletionSteps {
    triggerCompleted: boolean
    actionCompleted: boolean
}

export const CodeMonitorForm: FunctionComponent<CodeMonitorFormProps> = props => {
    const setTriggerCompleted = useCallback((completed: boolean) => {
        setFormCompletion(previousState => ({ ...previousState, triggerCompleted: completed }))
    }, [])

    const setActionCompleted = useCallback((completed: boolean) => {
        setFormCompletion(previousState => ({ ...previousState, actionCompleted: completed }))
    }, [])

    const [codeMonitorState, setCodeMonitorState] = useState<CodeMonitorFields>(
        props.codeMonitor ?? {
            id: '',
            description: '',
            enabled: true,
            trigger: null,
            actions: {
                nodes: [{ id: '', enabled: true, recipients: { nodes: [{ id: props.authenticatedUser.id }] } }],
            },
        }
    )

    const [formCompletion, setFormCompletion] = useState<FormCompletionSteps>({
        triggerCompleted: (codeMonitorState.trigger?.query && codeMonitorState.trigger?.query.length > 0) || false,
        actionCompleted: codeMonitorState.actions.nodes.length > 0,
    })

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
                <TriggerArea
                    query={codeMonitorState.trigger?.query || ''}
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
                <ActionArea
                    action={codeMonitorState.actions}
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
                        Create code monitor
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

interface TriggerAreaProps {
    query: string
    onQueryChange: (query: string) => void
    triggerCompleted: boolean
    setTriggerCompleted: (completed: boolean) => void
}

const isDiffOrCommit = (value: string): boolean => value === 'diff' || value === 'commit'

export const TriggerArea: FunctionComponent<TriggerAreaProps> = ({
    query,
    onQueryChange,
    triggerCompleted,
    setTriggerCompleted,
}) => {
    const [showQueryForm, setShowQueryForm] = useState(false)
    const toggleQueryForm: FormEventHandler = useCallback(event => {
        event.preventDefault()
        setShowQueryForm(show => !show)
    }, [])

    const [queryState, nextQueryFieldChange, queryInputReference] = useInputValidation(
        useMemo(
            () => ({
                initialValue: query,
                synchronousValidators: [
                    (value: string) => {
                        const tokens = scanSearchQuery(value)
                        if (tokens.type === 'success') {
                            const filters = tokens.term.filter(token => token.type === 'filter')
                            const hasTypeDiffOrCommitFilter = filters.some(
                                filter =>
                                    filter.type === 'filter' &&
                                    resolveFilter(filter.field.value)?.type === FilterType.type &&
                                    ((filter.value?.type === 'literal' &&
                                        filter.value &&
                                        isDiffOrCommit(filter.value.value)) ||
                                        (filter.value?.type === 'quoted' &&
                                            filter.value &&
                                            isDiffOrCommit(filter.value.quotedValue)))
                            )
                            const hasPatternTypeFilter = filters.some(
                                filter =>
                                    filter.type === 'filter' &&
                                    resolveFilter(filter.field.value)?.type === FilterType.patterntype &&
                                    filter.value &&
                                    validateFilter(filter.field.value, filter.value)
                            )
                            if (hasTypeDiffOrCommitFilter && hasPatternTypeFilter) {
                                return undefined
                            }
                            if (!hasTypeDiffOrCommitFilter) {
                                return 'Code monitors require queries to specify either `type:commit` or `type:diff`.'
                            }
                            if (!hasPatternTypeFilter) {
                                return 'Code monitors require queries to specify a `patternType:` of literal, regexp, or structural.'
                            }
                        }
                        return 'Failed to parse query'
                    },
                ],
            }),
            [query]
        )
    )

    const completeForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            setShowQueryForm(false)
            setTriggerCompleted(true)
            onQueryChange(queryState.value)
        },
        [setTriggerCompleted, setShowQueryForm, onQueryChange, queryState]
    )

    const editForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            setShowQueryForm(true)
        },
        [setShowQueryForm]
    )

    const cancelForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            setShowQueryForm(false)
        },
        [setShowQueryForm]
    )

    return (
        <>
            <h3>Trigger</h3>
            <div className="card p-3 my-3">
                {!showQueryForm && !triggerCompleted && (
                    <>
                        <button
                            type="button"
                            onClick={toggleQueryForm}
                            className="btn btn-link font-weight-bold p-0 text-left test-trigger-button"
                        >
                            When there are new search results
                        </button>
                        <span className="text-muted">
                            This trigger will fire when new search results are found for a given search query.
                        </span>
                    </>
                )}
                {showQueryForm && (
                    <>
                        <div className="font-weight-bold">When there are new search results</div>
                        <span className="text-muted">
                            This trigger will fire when new search results are found for a given search query.
                        </span>
                        <div className="create-monitor-page__query-input">
                            <input
                                type="text"
                                className={classnames(
                                    'create-monitor-page__query-input-field form-control my-2 test-trigger-input',
                                    deriveInputClassName(queryState)
                                )}
                                onChange={nextQueryFieldChange}
                                value={queryState.value}
                                required={true}
                                autoFocus={true}
                                ref={queryInputReference}
                            />
                            {queryState.kind === 'VALID' && (
                                <Link
                                    to={buildSearchURLQuery(query, SearchPatternType.literal, false)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="create-monitor-page__query-input-preview-link test-preview-link"
                                >
                                    Preview results <OpenInNewIcon />
                                </Link>
                            )}
                            {queryState.kind === 'INVALID' && (
                                <small className="invalid-feedback mb-4 test-trigger-error">{queryState.reason}</small>
                            )}
                            {(queryState.kind === 'NOT_VALIDATED' || queryState.kind === 'VALID') && (
                                <div className="d-flex mb-4 flex-column">
                                    <small className="text-muted">
                                        Code monitors only support <code className="bg-code">type:diff</code> and{' '}
                                        <code className="bg-code">type:commit</code> search queries.
                                    </small>
                                </div>
                            )}
                        </div>
                        <div>
                            <button
                                className="btn btn-outline-secondary mr-1 test-submit-trigger"
                                onClick={completeForm}
                                onSubmit={completeForm}
                                type="submit"
                                disabled={queryState.kind !== 'VALID'}
                            >
                                Continue
                            </button>
                            <button type="button" className="btn btn-outline-secondary" onClick={cancelForm}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
                {!showQueryForm && triggerCompleted && (
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <div className="font-weight-bold">When there are new search results</div>
                            <code className="text-muted">{query}</code>
                        </div>
                        <div>
                            <button type="button" onClick={editForm} className="btn btn-link p-0 text-left">
                                Edit
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <small className="text-muted">
                {' '}
                What other events would you like to monitor? {/* TODO: populate link */}
                <a href="" target="_blank" rel="noopener">
                    {/* TODO: populate link */}
                    Share feedback.
                </a>
            </small>
        </>
    )
}

interface ActionAreaProps {
    action: CodeMonitorFields['actions']
    actionCompleted: boolean
    setActionCompleted: (completed: boolean) => void
    disabled: boolean
    authenticatedUser: AuthenticatedUser
    onActionsChange: (action: CodeMonitorFields['actions']) => void
}

export const ActionArea: FunctionComponent<ActionAreaProps> = ({
    action,
    actionCompleted,
    setActionCompleted,
    disabled,
    authenticatedUser,
    onActionsChange,
}) => {
    const [showEmailNotificationForm, setShowEmailNotificationForm] = useState(false)
    const toggleEmailNotificationForm: FormEventHandler = useCallback(event => {
        event.preventDefault()
        setShowEmailNotificationForm(show => !show)
    }, [])

    const completeForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            setShowEmailNotificationForm(false)
            setActionCompleted(true)
            if (action.nodes.length === 0) {
                // ID can be empty here, since we'll generate a new ID when we create the monitor.
                onActionsChange({
                    nodes: [{ id: '', enabled: true, recipients: { nodes: [{ id: authenticatedUser.id }] } }],
                })
            }
        },
        [setActionCompleted, setShowEmailNotificationForm, action.nodes.length, authenticatedUser.id, onActionsChange]
    )

    const editForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            setShowEmailNotificationForm(true)
        },
        [setShowEmailNotificationForm]
    )

    const cancelForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            setShowEmailNotificationForm(false)
        },
        [setShowEmailNotificationForm]
    )

    const [emailNotificationEnabled, setEmailNotificationEnabled] = useState(true)
    const toggleEmailNotificationEnabled: (value: boolean) => void = useCallback(
        enabled => {
            setEmailNotificationEnabled(enabled)
            onActionsChange({ nodes: [{ id: '', recipients: { nodes: [{ id: authenticatedUser.email }] }, enabled }] })
        },
        [authenticatedUser, onActionsChange]
    )

    return (
        <>
            <h3 className="mb-1">Actions</h3>
            <span className="text-muted">Run any number of actions in response to an event</span>
            <div className="card p-3 my-3">
                {/* This should be its own component when you can add multiple email actions */}
                {!showEmailNotificationForm && !actionCompleted && (
                    <>
                        <button
                            type="button"
                            onClick={toggleEmailNotificationForm}
                            className="btn btn-link font-weight-bold p-0 text-left test-action-button"
                            disabled={disabled}
                        >
                            Send email notifications
                        </button>
                        <span className="text-muted">Deliver email notifications to specified recipients.</span>
                    </>
                )}
                {showEmailNotificationForm && (
                    <>
                        <div className="font-weight-bold">Send email notifications</div>
                        <span className="text-muted">Deliver email notifications to specified recipients.</span>
                        <div className="mt-4 test-action-form">
                            Recipients
                            <input
                                type="text"
                                className="form-control my-2"
                                value={`${authenticatedUser.email || ''} (you)`}
                                disabled={true}
                                autoFocus={true}
                            />
                            <small className="text-muted">
                                Code monitors are currently limited to sending emails to your primary email address.
                            </small>
                        </div>
                        <div className="flex my-4">
                            <Toggle
                                title="Enabled"
                                value={emailNotificationEnabled}
                                onToggle={toggleEmailNotificationEnabled}
                                className="mr-2"
                            />
                            Enabled
                        </div>
                        <div>
                            <button
                                type="submit"
                                className="btn btn-outline-secondary mr-1 test-submit-action"
                                onClick={completeForm}
                                onSubmit={completeForm}
                            >
                                Done
                            </button>
                            <button type="button" className="btn btn-outline-secondary" onClick={cancelForm}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
                {actionCompleted && !showEmailNotificationForm && (
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <div className="font-weight-bold">Send email notifications</div>
                            <span className="text-muted">{authenticatedUser.email}</span>
                        </div>
                        <div className="d-flex">
                            <div className="flex my-4">
                                <Toggle
                                    title="Enabled"
                                    value={emailNotificationEnabled}
                                    onToggle={toggleEmailNotificationEnabled}
                                    className="mr-2"
                                />
                            </div>
                            <button type="button" onClick={editForm} className="btn btn-link p-0 text-left">
                                Edit
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <small className="text-muted">
                What other actions would you like to do?{' '}
                <a href="" target="_blank" rel="noopener">
                    {/* TODO: populate link */}
                    Share feedback.
                </a>
            </small>
        </>
    )
}
