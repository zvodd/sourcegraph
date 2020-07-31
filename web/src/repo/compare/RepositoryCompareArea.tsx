import MapSearchIcon from 'mdi-react/MapSearchIcon'
import React, { useEffect, useCallback, useMemo } from 'react'
import { Route, RouteComponentProps, Switch } from 'react-router'
import { ActionItemAction } from '../../../../shared/src/actions/ActionItem'
import { HoverMerged } from '../../../../shared/src/api/client/types/hover'
import { ExtensionsControllerProps } from '../../../../shared/src/extensions/controller'
import * as GQL from '../../../../shared/src/graphql/schema'
import { getHoverActions } from '../../../../shared/src/hover/actions'
import { useHoverifier } from '../../../../shared/src/hover/useHoverifier'
import { getModeFromPath } from '../../../../shared/src/languages'
import { PlatformContextProps } from '../../../../shared/src/platform/context'
import {
    escapeRevspecForURL,
    FileSpec,
    ModeSpec,
    UIPositionSpec,
    RepoSpec,
    ResolvedRevisionSpec,
    RevisionSpec,
} from '../../../../shared/src/util/url'
import { getHover, getDocumentHighlights } from '../../backend/features'
import { HeroPage } from '../../components/HeroPage'
import { WebHoverOverlay } from '../../components/shared'
import { EventLoggerProps } from '../../tracking/eventLogger'
import { RepoHeaderContributionsLifecycleProps } from '../RepoHeader'
import { RepositoryCompareHeader } from './RepositoryCompareHeader'
import { RepositoryCompareOverviewPage } from './RepositoryCompareOverviewPage'
import { ThemeProps } from '../../../../shared/src/theme'
import * as H from 'history'
import { UpdateBreadcrumbsProps } from '../../components/Breadcrumbs'
import { HoveredToken } from '@sourcegraph/codeintellify'

const NotFoundPage: React.FunctionComponent = () => (
    <HeroPage
        icon={MapSearchIcon}
        title="404: Not Found"
        subtitle="Sorry, the requested repository comparison page was not found."
    />
)

interface RepositoryCompareAreaProps
    extends RouteComponentProps<{ spec: string }>,
        RepoHeaderContributionsLifecycleProps,
        PlatformContextProps,
        EventLoggerProps,
        ExtensionsControllerProps,
        ThemeProps,
        UpdateBreadcrumbsProps {
    repo: GQL.IRepository
    history: H.History
}

/**
 * Properties passed to all page components in the repository compare area.
 */
export interface RepositoryCompareAreaPageProps extends PlatformContextProps {
    /** The repository being compared. */
    repo: GQL.IRepository

    /** The base of the comparison. */
    base: { repoName: string; repoID: GQL.ID; revision?: string | null }

    /** The head of the comparison. */
    head: { repoName: string; repoID: GQL.ID; revision?: string | null }

    /** The URL route prefix for the comparison. */
    routePrefix: string
}

const getLSPTextDocumentPositionParameters = (
    hoveredToken: HoveredToken & RepoSpec & RevisionSpec & FileSpec & ResolvedRevisionSpec
): RepoSpec & RevisionSpec & ResolvedRevisionSpec & FileSpec & UIPositionSpec & ModeSpec => ({
    repoName: hoveredToken.repoName,
    revision: hoveredToken.revision,
    filePath: hoveredToken.filePath,
    commitID: hoveredToken.commitID,
    position: hoveredToken,
    mode: getModeFromPath(hoveredToken.filePath || ''),
})

/**
 * Renders pages related to a repository comparison.
 */
export const RepositoryCompareArea: React.FunctionComponent<RepositoryCompareAreaProps> = ({
    pushBreadcrumb,
    ...props
}) => {
    const onUpdateComparisonSpec = useCallback(
        (newBaseSpec: string, newHeadSpec: string): void => {
            props.history.push(
                `/${props.repo.name}/-/compare${
                    newBaseSpec || newHeadSpec
                        ? `/${escapeRevspecForURL(newBaseSpec || '')}...${escapeRevspecForURL(newHeadSpec || '')}`
                        : ''
                }`
            )
        },
        [props.history, props.repo.name]
    )

    const { extensionsController, platformContext } = props
    const {
        hoverState,
        hoverifier,
        nextCloseButtonClick,
        nextHoverOverlayElement,
        nextRelativeElement,
    } = useHoverifier<RepoSpec & RevisionSpec & FileSpec & ResolvedRevisionSpec, HoverMerged, ActionItemAction>(
        useMemo(
            () => ({
                getHover: hoveredToken => {
                    console.log('getHover', hoveredToken)
                    return getHover(getLSPTextDocumentPositionParameters(hoveredToken), { extensionsController })
                },
                getDocumentHighlights: hoveredToken =>
                    getDocumentHighlights(getLSPTextDocumentPositionParameters(hoveredToken), { extensionsController }),
                getActions: context => getHoverActions({ extensionsController, platformContext }, context),
            }),
            [extensionsController, platformContext]
        )
    )
    console.log({ hoverState })

    let spec: { base: string | null; head: string | null } | null | undefined
    if (props.match.params.spec) {
        spec = parseComparisonSpec(decodeURIComponent(props.match.params.spec))
    }

    useEffect(() => pushBreadcrumb('Compare'), [pushBreadcrumb])

    const commonProps: RepositoryCompareAreaPageProps = {
        repo: props.repo,
        base: { repoID: props.repo.id, repoName: props.repo.name, revision: spec?.base },
        head: { repoID: props.repo.id, repoName: props.repo.name, revision: spec?.head },
        routePrefix: props.match.url,
        platformContext: props.platformContext,
    }

    return (
        <div className="repository-compare-area container" ref={nextRelativeElement}>
            <RepositoryCompareHeader
                className="my-3"
                {...commonProps}
                onUpdateComparisonSpec={onUpdateComparisonSpec}
            />
            {spec === null ? (
                <div className="alert alert-danger">Invalid comparison specifier</div>
            ) : (
                <Switch>
                    {/* eslint-disable react/jsx-no-bind */}
                    <Route
                        path={`${props.match.url}`}
                        key="hardcoded-key" // see https://github.com/ReactTraining/react-router/issues/4578#issuecomment-334489490
                        exact={true}
                        render={routeComponentProps => (
                            <RepositoryCompareOverviewPage
                                {...routeComponentProps}
                                {...commonProps}
                                hoverifier={hoverifier}
                                isLightTheme={props.isLightTheme}
                                extensionsController={props.extensionsController}
                            />
                        )}
                    />
                    <Route key="hardcoded-key" component={NotFoundPage} />
                    {/* eslint-enable react/jsx-no-bind */}
                </Switch>
            )}
            {hoverState.hoverOverlayProps && (
                <WebHoverOverlay
                    {...props}
                    {...hoverState.hoverOverlayProps}
                    telemetryService={props.telemetryService}
                    hoverRef={nextHoverOverlayElement}
                    onCloseButtonClick={nextCloseButtonClick}
                />
            )}
        </div>
    )
}

function parseComparisonSpec(spec: string): { base: string | null; head: string | null } | null {
    if (!spec.includes('...')) {
        return null
    }
    const parts = spec.split('...', 2).map(decodeURIComponent)
    return {
        base: parts[0] || null,
        head: parts[1] || null,
    }
}
