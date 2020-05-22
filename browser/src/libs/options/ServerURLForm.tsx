import { upperFirst } from 'lodash'
import React, { useState, useCallback, useEffect } from 'react'
import { ErrorLike } from '../../../../shared/src/util/errors'
import { failedWithHTTPStatus } from '../../../../shared/src/backend/fetch'

const statusClassNames = {
    connecting: 'warning',
    connected: 'success',
    error: 'danger',
}

interface SourcegraphURL {
    sourcegraphURL: string
}

export type SourcegraphURLWithStatus =
    | (SourcegraphURL & { status: 'connecting' | 'connected' })
    | (SourcegraphURL & { status: 'error'; error: ErrorLike })

/**
 * This is the [Word-Joiner](https://en.wikipedia.org/wiki/Word_joiner) character.
 * We are using this as a &nbsp; that has no width to maintain line height when the
 * url is being updated (therefore no text is in the status indicator).
 */
const zeroWidthNbsp = '\u2060'

export interface ServerURLFormProps {
    className?: string
    sourcegraphURLAndStatus: SourcegraphURLWithStatus
    persistSourcegraphURL: (url: string) => void
    requestPermissions: (url: string) => void
}

const INVALID_SOURCEGRAPH_URL_ERROR_NAME = 'InvalidSourcegraphURLError'
export class InvalidSourcegraphURLError extends Error {
    public readonly name = INVALID_SOURCEGRAPH_URL_ERROR_NAME
    constructor(url: string) {
        super(`Invalid Sourcegraph URL: ${url}`)
    }
}

const SOURCEGRAPH_URL_PERMISSIONS_ERROR_NAME = 'SourcegraphURLPermissionsErrorName'
export class SourcegraphURLPermissionsError extends Error {
    public readonly name = SOURCEGRAPH_URL_PERMISSIONS_ERROR_NAME
    constructor(url: string) {
        super(`No permissions for Sourcegraph URL ${url}`)
    }
}

export const ServerURLForm: React.FunctionComponent<ServerURLFormProps> = props => {
    const [sourcegraphURLAndStatus, setSourcegraphURLAndStatus] = useState<
        SourcegraphURLWithStatus | (SourcegraphURL & { status: 'editing' })
    >()
    useEffect(() => {
        setSourcegraphURLAndStatus(props.sourcegraphURLAndStatus)
    }, [props.sourcegraphURLAndStatus])
    const onSourcegraphURLChange = useCallback(({ target }: React.ChangeEvent<HTMLInputElement>) => {
        setSourcegraphURLAndStatus({ sourcegraphURL: target.value, status: 'editing' as const })
    }, [])
    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>): void => {
            event.preventDefault()
            if (sourcegraphURLAndStatus) {
                const { sourcegraphURL } = sourcegraphURLAndStatus
                props.persistSourcegraphURL(sourcegraphURL)
            }
        },
        [props, sourcegraphURLAndStatus]
    )
    if (!sourcegraphURLAndStatus) {
        return null
    }

    return (
        // eslint-disable-next-line react/forbid-elements
        <form className={`server-url-form ${props.className || ''}`} onSubmit={handleSubmit}>
            <label htmlFor="sourcegraph-url">Sourcegraph URL</label>
            <div className="input-group">
                <div className="input-group-prepend">
                    <span className="input-group-text">
                        <span>
                            <span
                                className={
                                    'server-url-form__status-indicator ' +
                                    'bg-' +
                                    (sourcegraphURLAndStatus.status === 'editing'
                                        ? 'secondary'
                                        : statusClassNames[sourcegraphURLAndStatus.status])
                                }
                            />{' '}
                            <span className="e2e-connection-status">
                                {sourcegraphURLAndStatus.status === 'editing'
                                    ? zeroWidthNbsp
                                    : upperFirst(sourcegraphURLAndStatus.status)}
                            </span>
                        </span>
                    </span>
                </div>
                <input
                    type="text"
                    className="form-control e2e-sourcegraph-url"
                    id="sourcegraph-url"
                    value={sourcegraphURLAndStatus.sourcegraphURL}
                    onChange={onSourcegraphURLChange}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                />
            </div>
            {sourcegraphURLAndStatus.status === 'error' && (
                <div className="alert alert-danger mt-2 mb-0">
                    {failedWithHTTPStatus(sourcegraphURLAndStatus.error, 401) ||
                    failedWithHTTPStatus(sourcegraphURLAndStatus.error, 403) ? (
                        <>
                            Authentication to Sourcegraph failed.{' '}
                            <a href={sourcegraphURLAndStatus.sourcegraphURL} target="_blank" rel="noopener noreferrer">
                                Sign in to your instance
                            </a>{' '}
                            to continue.
                        </>
                    ) : sourcegraphURLAndStatus.error.name === INVALID_SOURCEGRAPH_URL_ERROR_NAME ? (
                        <>Invalid URL.</>
                    ) : sourcegraphURLAndStatus.error.name === SOURCEGRAPH_URL_PERMISSIONS_ERROR_NAME ? (
                        <>
                            To use Sourcegraph, you must grant the browser extension permissions to your Sourcegraph
                            URL.
                        </>
                    ) : (
                        <p>
                            Unable to connect to{' '}
                            <a href={sourcegraphURLAndStatus.sourcegraphURL} target="_blank" rel="noopener noreferrer">
                                {sourcegraphURLAndStatus.sourcegraphURL}
                            </a>
                            . Ensure the URL is correct and you are{' '}
                            <a
                                href={new URL('/sign-in', sourcegraphURLAndStatus.sourcegraphURL).href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                signed in
                            </a>
                            .
                        </p>
                    )}
                </div>
            )}
        </form>
    )
}
