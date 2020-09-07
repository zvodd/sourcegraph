import * as React from 'react'
import { RecentFilesPanel } from './RecentFilesPanel'
import { RecentSearchesPanel } from './RecentSearchesPanel'
import { RepositoriesPanel } from './RepositoriesPanel'
import { SavedSearchesPanel } from './SavedSearchesPanel'
import { AuthenticatedUser } from '../../auth'
import { PatternTypeProps } from '..'

interface Props extends Pick<PatternTypeProps, 'patternType'> {
    authenticatedUser: AuthenticatedUser | null
}

export const EnterpriseHomePanels: React.FunctionComponent<Props> = (props: Props) => (
    <div className="enterprise-home-panels container">
        <div className="row">
            <RepositoriesPanel className="enterprise-home-panels__panel col-md-4" />
            <RecentSearchesPanel className="enterprise-home-panels__panel enterprise-home-panels__panel-recent-searches col-md-8" />
        </div>
        <div className="row">
            <RecentFilesPanel className="enterprise-home-panels__panel col-md-7" />
            <SavedSearchesPanel {...props} className="enterprise-home-panels__panel col-md-5" />
        </div>
    </div>
)
