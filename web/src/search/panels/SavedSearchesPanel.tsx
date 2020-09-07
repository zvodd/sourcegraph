import React, { useMemo, useState } from 'react'
import classNames from 'classnames'
import { PanelContainer } from './PanelContainer'
import { useObservable } from '../../../../shared/src/util/useObservable'
import { fetchSavedSearches } from '../backend'
import { Link } from '../../../../shared/src/components/Link'
import { buildSearchURLQuery } from '../../../../shared/src/util/url'
import { SearchPatternType } from '../../../../shared/src/graphql/schema'
import { AuthenticatedUser } from '../../auth'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import PencilOutlineIcon from 'mdi-react/PencilOutlineIcon'

export const SavedSearchesPanel: React.FunctionComponent<{
    patternType: SearchPatternType
    authenticatedUser: AuthenticatedUser | null
    className?: string
}> = ({ patternType, authenticatedUser, className }) => {
    const savedSearches = useObservable(useMemo(() => fetchSavedSearches(), []))
    const [showAllSearches, setShowAllSearches] = useState(true)

    const emptyDisplay = (
        <div>
            Use saved searches to alert you to uses of a favorite api, or changes to code you need to monitor.
            {authenticatedUser && (
                <Link to={`/users/${authenticatedUser.username}/searches/add`} className="btn btn-primary">
                    Create a saved search
                </Link>
            )}
        </div>
    )
    const loadingDisplay = (
        <div className="icon-inline">
            <LoadingSpinner />
        </div>
    )

    const contentDisplay = (
        <>
            <div>
                <div className="d-flex justify-content-between">
                    <small>Search</small>
                    <small>Edit</small>
                </div>
                <dl className="list-group-flush">
                    {savedSearches
                        ?.filter(search => (showAllSearches ? true : search.namespace.id === authenticatedUser?.id))
                        .map(search => (
                            <dd key={search.id} className="text-monospace">
                                <div className="d-flex justify-content-between">
                                    <Link
                                        to={'/search?' + buildSearchURLQuery(search.query, patternType, false)}
                                        className="btn btn-link p-0"
                                    >
                                        {search.description}
                                    </Link>
                                    {authenticatedUser && (
                                        <Link to={`/users/${authenticatedUser?.username}/searches/${search.id}`}>
                                            <PencilOutlineIcon className="icon-inline" />
                                        </Link>
                                    )}
                                </div>
                            </dd>
                        ))}
                </dl>
                {/* <button className="btn btn-secondary">View saved searches</button> */}
            </div>
        </>
    )
    const allSavedSearches = (
        <div className="btn-group panel-container__action-button-group">
            {authenticatedUser && (
                <Link to={`/users/${authenticatedUser.username}/searches/add`} className="btn btn-secondary">
                    +
                </Link>
            )}
            <button
                type="button"
                onClick={() => setShowAllSearches(true)}
                className={classNames('btn btn-secondary panel-container__action-button', { active: showAllSearches })}
            >
                All searches
            </button>
            <button
                type="button"
                onClick={() => setShowAllSearches(false)}
                className={classNames('btn btn-secondary panel-container__action-button', { active: !showAllSearches })}
            >
                My searches
            </button>
        </div>
    )
    return (
        <PanelContainer
            className={classNames(className, 'saved-searches-panel')}
            title="Saved searches"
            state={savedSearches ? (savedSearches.length > 0 ? 'populated' : 'empty') : 'loading'}
            loadingContent={loadingDisplay}
            populatedContent={contentDisplay}
            emptyContent={emptyDisplay}
            actionButtons={allSavedSearches}
        />
    )
}
