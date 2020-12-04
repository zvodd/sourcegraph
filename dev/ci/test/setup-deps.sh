#!/usr/bin/env bash

asdf install

asdf plugin add nodejs
echo "legacy_version_file = yes" >>"$HOME/.asdfrc"

yarn
yarn generate
yes | gcloud auth configure-docker

curl -L https://sourcegraph.com/.api/src-cli/src_linux_amd64 -o /usr/local/bin/src
chmod +x /usr/local/bin/src
