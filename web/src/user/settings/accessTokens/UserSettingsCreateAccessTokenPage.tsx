import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import AddIcon from 'mdi-react/AddIcon'
import React, { useEffect, useCallback, useState, ChangeEvent } from 'react'
import { RouteComponentProps } from 'react-router'
import { Link } from 'react-router-dom'
import { Observable, merge, of } from 'rxjs'
import { catchError, concatMap, map, tap } from 'rxjs/operators'
import { gql } from '../../../../../shared/src/graphql/graphql'
import * as GQL from '../../../../../shared/src/graphql/schema'
import { asError, createAggregateError, ErrorLike, isErrorLike } from '../../../../../shared/src/util/errors'
import { AccessTokenScopes } from '../../../auth/accessToken'
import { mutateGraphQL } from '../../../backend/graphql'
import { Form } from '../../../components/Form'
import { PageTitle } from '../../../components/PageTitle'
import { SiteAdminAlert } from '../../../site-admin/SiteAdminAlert'
import { eventLogger } from '../../../tracking/eventLogger'
import { UserAreaRouteContext } from '../../area/UserArea'
import { ErrorAlert } from '../../../components/alerts'
import { useEventObservable } from '../../../../../shared/src/util/useObservable'

function createAccessToken(user: GQL.ID, scopes: string[], note: string): Observable<GQL.ICreateAccessTokenResult> {
    return mutateGraphQL(
        gql`
            mutation CreateAccessToken($user: ID!, $scopes: [String!]!, $note: String!) {
                createAccessToken(user: $user, scopes: $scopes, note: $note) {
                    id
                    token
                }
            }
        `,
        { user, scopes, note }
    ).pipe(
        map(({ data, errors }) => {
            if (!data || !data.createAccessToken || (errors && errors.length > 0)) {
                eventLogger.log('CreateAccessTokenFailed')
                throw createAggregateError(errors)
            }
            eventLogger.log('AccessTokenCreated')
            return data.createAccessToken
        })
    )
}

interface Props extends UserAreaRouteContext, RouteComponentProps<{}> {
    /** Called when a new access token is created and should be temporarily displayed to the user. */
    onDidCreateAccessToken: (result: GQL.ICreateAccessTokenResult) => void
}

/**
 * A page with a form to create an access token for a user.
 */
export const UserSettingsCreateAccessTokenPage: React.FunctionComponent<Props> = props => {
    useEffect(() => {
        eventLogger.logViewEvent('NewAccessToken')
    }, [])

    const [note, setNote] = useState('')
    const onNoteChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => setNote(event.currentTarget.value),
        [setNote]
    )

    const [scopes, setScopes] = useState<string[]>([])
    const onScopesChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const checked = event.currentTarget.checked
            const value = event.currentTarget.value
            setScopes(checked ? [...scopes, value] : scopes.filter(scope => scope !== value))
        },
        [scopes, setScopes]
    )

    const [nextCreation, creationOrError] = useEventObservable(
        useCallback(
            (creations: Observable<void>): Observable<'loading' | GQL.ICreateAccessTokenResult | ErrorLike> =>
                creations.pipe(
                    concatMap(() =>
                        merge(
                            of('loading' as const),
                            createAccessToken(props.user.id, scopes, note).pipe(
                                tap(result => {
                                    // Go back to access tokens list page and display the token secret value.
                                    props.history.push(`${props.match.url.replace(/\/new$/, '')}`)
                                    props.onDidCreateAccessToken(result)
                                }),
                                catchError(error => [asError(error)])
                            )
                        )
                    )
                ),
            [props, note, scopes]
        )
    )

    const onSubmit = useCallback(
        (event: React.FormEvent) => {
            event.preventDefault()
            nextCreation()
        },
        [nextCreation]
    )

    const siteAdminViewingOtherUser = props.authenticatedUser && props.authenticatedUser.id !== props.user.id
    return (
        <div className="user-settings-create-access-token-page">
            <PageTitle title="Create access token" />
            <h2>New access token</h2>
            {siteAdminViewingOtherUser && (
                <SiteAdminAlert className="sidebar__alert">
                    Creating access token for other user <strong>{props.user.username}</strong>
                </SiteAdminAlert>
            )}
            <Form onSubmit={onSubmit}>
                <div className="form-group">
                    <label htmlFor="user-settings-create-access-token-page__note">Token description</label>
                    <input
                        type="text"
                        className="form-control e2e-create-access-token-description"
                        id="user-settings-create-access-token-page__note"
                        onChange={onNoteChange}
                        required={true}
                        autoFocus={true}
                        placeholder="Description"
                    />
                    <small className="form-help text-muted">What's this token for?</small>
                </div>
                <div className="form-group">
                    <label className="mb-1" htmlFor="user-settings-create-access-token-page__note">
                        Token scope
                    </label>
                    <div>
                        <small className="form-help text-muted">
                            Tokens with limited user scopes are not yet supported.
                        </small>
                    </div>
                    <div className="form-check">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            id="user-settings-create-access-token-page__scope-user:all"
                            checked={true}
                            value={AccessTokenScopes.UserAll}
                            onChange={onScopesChange}
                            disabled={true}
                        />
                        <label
                            className="form-check-label"
                            htmlFor="user-settings-create-access-token-page__scope-user:all"
                        >
                            <strong>{AccessTokenScopes.UserAll}</strong> — Full control of all resources accessible to
                            the user account
                        </label>
                    </div>
                    {props.user.siteAdmin && (
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="user-settings-create-access-token-page__scope-site-admin:sudo"
                                checked={scopes.includes(AccessTokenScopes.SiteAdminSudo)}
                                value={AccessTokenScopes.SiteAdminSudo}
                                onChange={onScopesChange}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="user-settings-create-access-token-page__scope-site-admin:sudo"
                            >
                                <strong>{AccessTokenScopes.SiteAdminSudo}</strong> — Ability to perform any action as
                                any other user
                            </label>
                        </div>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={creationOrError === 'loading'}
                    className="btn btn-success e2e-create-access-token-submit"
                >
                    {creationOrError === 'loading' ? (
                        <LoadingSpinner className="icon-inline" />
                    ) : (
                        <AddIcon className="icon-inline" />
                    )}{' '}
                    Generate token
                </button>
                <Link
                    className="btn btn-secondary ml-1 e2e-create-access-token-cancel"
                    to={props.match.url.replace(/\/new$/, '')}
                >
                    Cancel
                </Link>
            </Form>
            {isErrorLike(creationOrError) && (
                <ErrorAlert className="invite-form__alert" error={creationOrError} history={props.history} />
            )}
        </div>
    )
}
