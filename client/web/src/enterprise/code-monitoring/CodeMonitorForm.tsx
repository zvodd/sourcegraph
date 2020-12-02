import classnames from 'classnames'
import OpenInNewIcon from 'mdi-react/OpenInNewIcon'
import * as H from 'history'
import { Toggle } from '../../../../branded/src/components/Toggle'
import { FilterType } from '../../../../shared/src/search/interactive/util'
import { resolveFilter, validateFilter } from '../../../../shared/src/search/parser/filters'
import { scanSearchQuery } from '../../../../shared/src/search/parser/scanner'
import { ErrorLike, isErrorLike } from '../../../../shared/src/util/errors'
import { buildSearchURLQuery } from '../../../../shared/src/util/url'
import { useInputValidation, deriveInputClassName } from '../../../../shared/src/util/useInputValidation'
import { AuthenticatedUser } from '../../auth'
import { SearchPatternType } from '../../graphql-operations'
import React, { FormEventHandler, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '../../../../shared/src/components/Link'

const LOADING = 'loading' as const

interface Action {
    recipient: string
    enabled: boolean
}

interface CodeMonitorFormProps {
    location: H.Location
    authenticatedUser: AuthenticatedUser
    onNameChange: (name: string) => void
    onQueryChange: (query: string) => void
    onEnabledChange: (enabled: boolean) => void
    onActionChange: (action: Action) => void
    codeMonitor: CodeMonitorFields
    codeMonitorOrError?: typeof LOADING | Partial<CodeMonitorFields> | ErrorLike
}

export interface FormCompletionSteps {
    triggerCompleted: boolean
    actionCompleted: boolean
}

interface CodeMonitorFields {
    description: string
    query: string
    enabled: boolean
    action: Action
}

export const CodeMonitorForm: FunctionComponent<CodeMonitorFormProps> = props => {
    const [formCompletion, setFormCompletion] = useState<FormCompletionSteps>({
        triggerCompleted: props.codeMonitor.query.length > 0,
        actionCompleted: !!props.codeMonitor.action,
    })

    const setTriggerCompleted = useCallback(() => {
        setFormCompletion(previousState => ({ ...previousState, triggerCompleted: !previousState.triggerCompleted }))
    }, [])

    const setActionCompleted = useCallback(() => {
        setFormCompletion(previousState => ({ ...previousState, actionCompleted: !previousState.actionCompleted }))
    }, [])

    return (
        <>
            <div className="flex mb-4">
                Name
                <div>
                    <input
                        type="text"
                        className="form-control my-2 test-name-input"
                        required={true}
                        onChange={event => {
                            props.onNameChange(event.target.value)
                        }}
                        value={props.codeMonitor.description}
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
                    query={props.codeMonitor.query}
                    onQueryChange={props.onQueryChange}
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
                    action={props.codeMonitor.action}
                    setActionCompleted={setActionCompleted}
                    actionCompleted={formCompletion.actionCompleted}
                    authenticatedUser={props.authenticatedUser}
                    disabled={!formCompletion.triggerCompleted}
                    onActionChange={props.onActionChange}
                />
            </div>
            <div>
                <div className="d-flex my-4">
                    <div>
                        <Toggle
                            title="Active"
                            value={props.codeMonitor.enabled}
                            onToggle={props.onEnabledChange}
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
                            !formCompletion.actionCompleted ||
                            isErrorLike(props.codeMonitorOrError) ||
                            props.codeMonitorOrError === LOADING
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
                {!isErrorLike(props.codeMonitorOrError) &&
                    !!props.codeMonitorOrError &&
                    props.codeMonitorOrError !== LOADING && (
                        <div className="alert alert-success">
                            Successfully created monitor {props.codeMonitorOrError.description}
                        </div>
                    )}
                {isErrorLike(props.codeMonitorOrError) && (
                    <div className="alert alert-danger">
                        Failed to create monitor: {props.codeMonitorOrError.message}
                    </div>
                )}
            </div>
        </>
    )
}

interface TriggerAreaProps {
    query: string
    onQueryChange: (query: string) => void
    triggerCompleted: boolean
    setTriggerCompleted: () => void
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

    const editOrCompleteForm: FormEventHandler = useCallback(
        event => {
            event.preventDefault()
            toggleQueryForm(event)
            setTriggerCompleted()
        },
        [setTriggerCompleted, toggleQueryForm]
    )

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

    useEffect(() => {
        if (queryState.kind === 'VALID') {
            onQueryChange(queryState.value)
        }
    }, [onQueryChange, queryState])

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
                                onClick={editOrCompleteForm}
                                onSubmit={editOrCompleteForm}
                                type="submit"
                                disabled={queryState.kind !== 'VALID'}
                            >
                                Continue
                            </button>
                            <button type="button" className="btn btn-outline-secondary" onClick={editOrCompleteForm}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
                {triggerCompleted && (
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <div className="font-weight-bold">When there are new search results</div>
                            <code className="text-muted">{query}</code>
                        </div>
                        <div>
                            <button type="button" onClick={editOrCompleteForm} className="btn btn-link p-0 text-left">
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
    action: Action
    actionCompleted: boolean
    setActionCompleted: () => void
    disabled: boolean
    authenticatedUser: AuthenticatedUser
    onActionChange: (action: Action) => void
}

export const ActionArea: FunctionComponent<ActionAreaProps> = ({
    action,
    actionCompleted,
    setActionCompleted,
    disabled,
    authenticatedUser,
    onActionChange,
}) => {
    const [showEmailNotificationForm, setShowEmailNotificationForm] = useState(false)
    const toggleEmailNotificationForm: FormEventHandler = useCallback(event => {
        event.preventDefault()
        setShowEmailNotificationForm(show => !show)
    }, [])

    const editOrCompleteForm: FormEventHandler = useCallback(
        event => {
            event?.preventDefault()
            toggleEmailNotificationForm(event)
            // For now, when action is undefined, it means that we're creating a new monitor.
            // We currently want to pre-fill this with email notifications to the code monitor owner's email.
            if (!action) {
                onActionChange({ recipient: authenticatedUser.id, enabled: true })
            }
            setActionCompleted()
        },
        [toggleEmailNotificationForm, setActionCompleted, action, onActionChange, authenticatedUser.id]
    )

    const [emailNotificationEnabled, setEmailNotificationEnabled] = useState(true)
    const toggleEmailNotificationEnabled: (value: boolean) => void = useCallback(
        enabled => {
            setEmailNotificationEnabled(enabled)
            onActionChange({ recipient: authenticatedUser.email, enabled })
        },
        [authenticatedUser, onActionChange]
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
                {showEmailNotificationForm && !actionCompleted && (
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
                                onClick={editOrCompleteForm}
                                onSubmit={editOrCompleteForm}
                            >
                                Done
                            </button>
                            <button type="button" className="btn btn-outline-secondary" onClick={editOrCompleteForm}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
                {actionCompleted && (
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
                            <button type="button" onClick={editOrCompleteForm} className="btn btn-link p-0 text-left">
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
