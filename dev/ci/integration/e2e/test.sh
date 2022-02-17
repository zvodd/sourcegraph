#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE[0]}")/../../../.."
set -ex

URL="${1:-"http://localhost:7080"}"

function integration_test() {
  echo "--- yarn run test-e2e"
  env SOURCEGRAPH_BASE_URL="$URL" PERCY_ON=true ./node_modules/.bin/percy exec -- yarn run cover-e2e --reporter mocha-junit-reporter
}

BUILDKITE_ANALYTICS_FRONTEND_E2E_TEST_SUITE_API_KEY=$(gcloud secrets versions access latest --secret="BUILDKITE_ANALYTICS_FRONTEND_E2E_TEST_SUITE_API_KEY" --project="sourcegraph-ci" --quiet)

integration_test

echo "--- coverage"
yarn nyc report -r json
# Upload the coverage under the "e2e" flag (toggleable in the CodeCov UI)
./dev/ci/codecov.sh -F e2e
