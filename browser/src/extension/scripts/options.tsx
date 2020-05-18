// We want to polyfill first.
import '../polyfills'

import * as React from 'react'
import { render } from 'react-dom'
import { from, noop, Observable, merge, of } from 'rxjs'
import { GraphQLResult } from '../../../../shared/src/graphql/graphql'
import * as GQL from '../../../../shared/src/graphql/schema'
import { background } from '../../browser/runtime'
import { observeStorageKey, storage } from '../../browser/storage'
import { featureFlagDefaults, FeatureFlags } from '../../browser/types'
import { OptionsMenuProps, OptionsMenu } from '../../libs/options/OptionsMenu'
import { initSentry } from '../../libs/sentry'
import { fetchSite } from '../../shared/backend/server'
import { featureFlags } from '../../shared/util/featureFlags'
import { assertEnv } from '../envAssertion'
import { map, startWith, switchMap, filter, mapTo, catchError } from 'rxjs/operators'
import { isDefined } from '../../../../shared/src/util/types'
import { asError } from '../../../../shared/src/util/errors'

assertEnv('OPTIONS')

initSentry('options')

const keyIsFeatureFlag = (key: string): key is keyof FeatureFlags =>
    !!Object.keys(featureFlagDefaults).find(k => key === k)

const toggleFeatureFlag = (key: string): void => {
    if (keyIsFeatureFlag(key)) {
        featureFlags.toggle(key).then(noop).catch(noop)
    }
}

const fetchCurrentTabStatus = async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs.length > 1) {
        throw new Error('Querying for the currently active tab returned more than one result')
    }
    const { url } = tabs[0]
    if (!url) {
        throw new Error('Currently active tab has no URL')
    }
    const { host, protocol } = new URL(url)
    const hasPermissions = await browser.permissions.contains({
        origins: [`${protocol}//${host}/*`],
    })
    return { host, protocol, hasPermissions }
}

// Make GraphQL requests from background page
function requestGraphQL<T extends GQL.IQuery | GQL.IMutation>(options: {
    request: string
    variables: {}
}): Observable<GraphQLResult<T>> {
    return from(background.requestGraphQL<T>(options))
}

const props: OptionsMenuProps = {
    observeIsDisabled: () => observeStorageKey('sync', 'disableExtension'),
    observeFeatureFlags: (): any =>
        observeStorageKey('sync', 'featureFlags').pipe(
            map(featureFlags => ({
                ...featureFlagDefaults,
                ...featureFlags,
            })),
            startWith(featureFlagDefaults)
        ),
    observeSourcegraphURL: () =>
        observeStorageKey('sync', 'sourcegraphURL').pipe(
            filter(isDefined),
            switchMap(sourcegraphURL => {
                try {
                    new URL(sourcegraphURL)
                } catch (error) {
                    return [{ status: 'error' as const, error, sourcegraphURL }]
                }
                return merge(
                    of({ sourcegraphURL, status: 'connecting' as const }),
                    fetchSite(requestGraphQL).pipe(
                        switchMap(async () => {
                            const hasPermissions = await browser.permissions.contains({
                                origins: [`${sourcegraphURL}/*`],
                            })
                            if (!hasPermissions) {
                                throw new Error('LOL')
                            }
                        }),
                        mapTo({ status: 'connected' as const, sourcegraphURL }),
                        catchError(err => [{ status: 'error' as const, sourcegraphURL, error: asError(err) }])
                    )
                )
            })
        ),
    fetchCurrentTabStatus,
    toggleExtensionDisabled: disableExtension => storage.sync.set({ disableExtension }),
    toggleFeatureFlag,
    persistSourcegraphURL: sourcegraphURL => storage.sync.set({ sourcegraphURL }),
    requestPermissions: url =>
        browser.permissions.request({
            origins: [`${url}/*`],
        }),
}

const inject = (): void => {
    const injectDOM = document.createElement('div')
    injectDOM.className = 'sourcegraph-options-menu options'
    document.body.appendChild(injectDOM)
    // For shared CSS that would otherwise be dark by default
    document.body.classList.add('theme-light')

    render(<OptionsMenu {...props} />, injectDOM)
}

document.addEventListener('DOMContentLoaded', inject)
