import { Shortcut } from '@slimsag/react-shortcuts'
import * as H from 'history'
import React, { useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as GQL from '../../../shared/src/graphql/schema'
import { KeyboardShortcut } from '../../../shared/src/keyboardShortcuts'
import { ThemeProps } from '../../../shared/src/theme'
import { UserAvatar } from '../user/UserAvatar'
import { ThemePreferenceProps, ThemePreference } from '../theme'
import Dropdown from 'react-bootstrap/Dropdown'

interface Props extends ThemeProps, ThemePreferenceProps {
    location: H.Location
    authenticatedUser: Pick<
        GQL.IUser,
        'username' | 'avatarURL' | 'settingsURL' | 'organizations' | 'siteAdmin' | 'session'
    >
    showDotComMarketing: boolean
    keyboardShortcutForSwitchTheme?: KeyboardShortcut
}

/**
 * Displays the user's avatar and/or username in the navbar and exposes a dropdown menu with more options for
 * authenticated viewers.
 */
export const UserNavItem: React.FunctionComponent<Props> = (props: Props) => {
    const supportsSystemTheme = Boolean(
        window.matchMedia && window.matchMedia('not all and (prefers-color-scheme), (prefers-color-scheme)').matches
    )

    const onThemeChange: React.ChangeEventHandler<HTMLSelectElement> = event => {
        props.onThemePreferenceChange(event.target.value as ThemePreference)
    }

    const onThemeCycle = useCallback((): void => {
        props.onThemePreferenceChange(
            props.themePreference === ThemePreference.Dark ? ThemePreference.Light : ThemePreference.Dark
        )
    }, [props])

    return (
        <Dropdown>
            <Dropdown.Toggle id="user-nav-item-dropdown-toggle" title="User" variant="link">
                {props.authenticatedUser.avatarURL ? (
                    <UserAvatar user={props.authenticatedUser} size={48} className="icon-inline" />
                ) : (
                    <strong>{props.authenticatedUser.username}</strong>
                )}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                <Dropdown.Header className="py-1">
                    Signed in as <strong>@{props.authenticatedUser.username}</strong>
                </Dropdown.Header>
                <Dropdown.Divider />
                <Link to={props.authenticatedUser.settingsURL!} className="dropdown-item">
                    Settings
                </Link>
                <Link to="/extensions" className="dropdown-item">
                    Extensions
                </Link>
                <Link to={`/users/${props.authenticatedUser.username}/searches`} className="dropdown-item">
                    Saved searches
                </Link>
                <Dropdown.Divider />
                <div className="px-2 py-1">
                    <div className="d-flex align-items-center">
                        <div className="mr-2">Theme</div>
                        <select
                            className="custom-select custom-select-sm e2e-theme-toggle"
                            onChange={onThemeChange}
                            value={props.themePreference}
                        >
                            <option value={ThemePreference.Light}>Light</option>
                            <option value={ThemePreference.Dark}>Dark</option>
                            <option value={ThemePreference.System}>System</option>
                        </select>
                    </div>
                    {props.themePreference === ThemePreference.System && !supportsSystemTheme && (
                        <div className="text-wrap">
                            <small>
                                <a
                                    href="https://caniuse.com/#feat=prefers-color-scheme"
                                    className="text-warning"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Your browser does not support the system theme.
                                </a>
                            </small>
                        </div>
                    )}
                    {props.keyboardShortcutForSwitchTheme &&
                        props.keyboardShortcutForSwitchTheme.keybindings.map((keybinding, index) => (
                            <Shortcut key={index} {...keybinding} onMatch={onThemeCycle} />
                        ))}
                </div>
                {props.authenticatedUser.organizations.nodes.length > 0 && (
                    <>
                        <Dropdown.Divider />
                        <Dropdown.Header>Organizations</Dropdown.Header>
                        {props.authenticatedUser.organizations.nodes.map(org => (
                            <Link key={org.id} to={org.settingsURL || org.url} className="dropdown-item">
                                {org.displayName || org.name}
                            </Link>
                        ))}
                    </>
                )}
                <Dropdown.Divider />
                {props.authenticatedUser.siteAdmin && (
                    <Link to="/site-admin" className="dropdown-item">
                        Site admin
                    </Link>
                )}
                {props.showDotComMarketing ? (
                    // eslint-disable-next-line react/jsx-no-target-blank
                    <a href="https://docs.sourcegraph.com" target="_blank" className="dropdown-item">
                        Help
                    </a>
                ) : (
                    <Link to="/help" className="dropdown-item">
                        Help
                    </Link>
                )}
                {props.authenticatedUser.session && props.authenticatedUser.session.canSignOut && (
                    <a href="/-/sign-out" className="dropdown-item">
                        Sign out
                    </a>
                )}
                {props.showDotComMarketing && (
                    <>
                        <Dropdown.Divider />
                        {/* eslint-disable-next-line react/jsx-no-target-blank */}
                        <a href="https://about.sourcegraph.com" target="_blank" className="dropdown-item">
                            About Sourcegraph
                        </a>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    )
}
