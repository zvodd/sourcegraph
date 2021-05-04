# Quickstart step 1: Install dependencies

> NOTE: Please see install instructions for [macOS](#macos) and [Ubuntu](#ubuntu) in succeeding sections.

Sourcegraph has the following dependencies:
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) (v2.18 or higher)
- [Go](https://golang.org/doc/install) (v1.14 or higher)
- [Node.js](https://nodejs.org/en/download/) (see current recommended version in [.nvmrc](https://github.com/sourcegraph/sourcegraph/blob/main/.nvmrc))
- [make](https://www.gnu.org/software/make/)
- [Docker](https://docs.docker.com/engine/installation/) (v18 or higher)
  - For macOS we recommend using Docker for Mac instead of `docker-machine`
- [PostgreSQL](https://wiki.postgresql.org/wiki/Detailed_installation_guides) (v12 or higher)
- [Redis](http://redis.io/) (v5.0.7 or higher)
- [Yarn](https://yarnpkg.com) (v1.10.1 or higher)
- [SQLite](https://www.sqlite.org/index.html) tools
- [Golang Migrate](https://github.com/golang-migrate/migrate/) (v4.7.0 or higher)
- [Comby](https://github.com/comby-tools/comby/) (v0.11.3 or higher)
- [Watchman](https://facebook.github.io/watchman/)

## macOS

1.  Install [Homebrew](https://brew.sh).

2.  Install [Docker for Mac](https://docs.docker.com/docker-for-mac/).

    optionally via `brew`

    ```
    brew install --cask docker
    ```

3.  Install Redis, PostgreSQL, Git, golang-migrate, Comby, SQLite tools, and jq with the following command:

    ```
    brew install redis postgresql git gnu-sed golang-migrate comby sqlite pcre FiloSottile/musl-cross/musl-cross jq watchman
    ```

4.  Configure PostgreSQL and Redis to start automatically

    ```
    brew services start postgresql
    brew services start redis
    ```

    (You can stop them later by calling `stop` instead of `start` above.)

5.  Ensure `psql`, the PostgreSQL command line client, is on your `$PATH`.

    Homebrew does not put it there by default. Homebrew gives you the command to run to insert `psql` in your path in the "Caveats" section of `brew info postgresql`. Alternatively, you can use the command below. It might need to be adjusted depending on your Homebrew prefix (`/usr/local` below) and shell (bash below).

    ```
    hash psql || { echo 'export PATH="/usr/local/opt/postgresql/bin:$PATH"' >> ~/.bash_profile }
    source ~/.bash_profile
    ```

    Open a new Terminal window to ensure `psql` is now on your `$PATH`.

### 6.  Installing language dependencies

We advise using tools to manage your installations of Node, yarn, and Go, rather than installing them directly from your OS package manager. These tools are able to alter your shell environment so that different executables are used based on versions you define per project or per directory.

There are two main tools we recommend you pick from: [nvm](https://github.com/nvm-sh/nvm) (just for Node) and [asdf](https://asdf-vm.com/#/) (language-agnostic).

Regardless of which option you choose, once set up, **ensure that `node -v` matches the version specified in [.nvmrc](https://github.com/sourcegraph/sourcegraph/blob/main/.tool-versions).**

#### Option 1: Node Version Manager (`nvm`)

Recommended if you primarily only care about the Node.js runtime.

If you select this option, be sure to install Go and yarn another way, such as with Homebrew:

```
brew install go yarn
```

Install `nvm` with the following commands:

```
NVM_VERSION="$(curl https://api.github.com/repos/nvm-sh/nvm/releases/latest | jq -r .name)"
curl -L https://raw.githubusercontent.com/nvm-sh/nvm/"$NVM_VERSION"/install.sh -o install-nvm.sh
sh install-nvm.sh
```

After the install script is finished, re-source your shell profile (e.g.,
`source ~/.zshrc`) or restart your terminal session to pick up the `nvm`
definitions. Re-running the install script will update the installation.

Note: `nvm` is implemented as a shell function, so it may not show up in
the output of `which nvm`. Use `type nvm` to verify whether it is set up.
There is also a Homebrew package for `nvm`, but it is unsupported by the
`nvm` maintainers.

* For fish shell users, you will want to install `bass` which you can get via `omf`:

    ```
    curl -L https://get.oh-my.fish | fish
    omf install bass
    ```

* Then add the following to your `config.fish`:

    ```
    function nvm
      bass source ~/.nvm/nvm.sh --no-use ';' nvm $argv
    end

    set -x NVM_DIR ~/.nvm
    ```

Finally, install the current Node.js version for Sourcegraph by running the following from the working directory of a sourcegraph repository clone:

```
nvm install
nvm use --delete-prefix
```

#### Option 2: `asdf`

Recommended if you are developing in many different language runtimes or for other projects with their own Go/yarn version requirements.

We use `asdf` in buildkite to lock the versions of the tools that we use on a per-commit basis.

After following the [instructions](https://asdf-vm.com/#/core-manage-asdf?id=install) to install `asdf` and its dependencies for your specific OS and shell, also install the following plugins with `asdf plugin add`:

- [Golang](https://github.com/kennyp/asdf-golang)
- [Node.js](https://github.com/asdf-vm/asdf-nodejs)

  You may need to follow [this step](https://github.com/asdf-vm/asdf-nodejs#problems-with-openpgp-signatures-in-older-versions) to manually import the Node.js release team's OpenPGP keys to your main keyring.

  Also be sure to follow [this step](https://github.com/asdf-vm/asdf-nodejs#nvmrc-and-node-version-files) to tell `asdf` to respect `.nvmrc` files.

- [Yarn](https://github.com/twuni/asdf-yarn)

`asdf` uses the versions specified in [.tool-versions](https://github.com/sourcegraph/sourcegraph/blob/main/.tool-versions) whenever a command is run from one of `sourcegraph/sourcegraph`'s subdirectories. You can install or update to these versions by running `asdf install` from any subdirectory.

Assuming the versions specified are all installed, `asdf` will automatically switch versions whenever you change directories.

## Ubuntu

1. Add package repositories:

    ```
    # Go
    sudo add-apt-repository ppa:longsleep/golang-backports

    # Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

    # Yarn
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
    ```

2. Update repositories:

    ```
    sudo apt-get update
    ```

3. Install dependencies:

    ```
    # install most packages (omit golang-go and yarn if you plan to manage them through asdf, see step 4)
    sudo apt install -y make git-all postgresql postgresql-contrib redis-server libpcre3-dev libsqlite3-dev pkg-config golang-go musl-tools docker-ce docker-ce-cli containerd.io yarn jq libnss3-tools

    # install golang-migrate (you must rename the extracted binary to `golang-migrate` and move the binary into your $PATH)
    curl -L https://github.com/golang-migrate/migrate/releases/download/v4.7.0/migrate.linux-amd64.tar.gz | tar xvz

    # install comby (you must rename the extracted binary to `comby` and move the binary into your $PATH)
    curl -L https://github.com/comby-tools/comby/releases/download/0.11.3/comby-0.11.3-x86_64-linux.tar.gz | tar xvz

    # install watchman (you must put the binary and shared libraries on your $PATH and $LD_LIBRARY_PATH)
    curl -LO https://github.com/facebook/watchman/releases/download/v2020.07.13.00/watchman-v2020.07.13.00-linux.zip
    unzip watchman-*-linux.zip
    sudo mkdir -p /usr/local/{bin,lib} /usr/local/var/run/watchman
    sudo cp bin/* /usr/local/bin
    sudo cp lib/* /usr/local/lib
    sudo chmod 755 /usr/local/bin/watchman
    sudo chmod 2777 /usr/local/var/run/watchman
    # On Linux, you may need to run the following in addition:
    watchman watch <path to sourcegraph repository>
    ```

4. Install Node.js and language version management

   Follow the same [instructions outlined for macOS](#6--installing-language-dependencies).

5. Configure startup services

    ```
    sudo systemctl enable postgresql
    sudo systemctl enable redis-server.service
    ```

6. (optional) You can also run Redis using Docker

    In this case you should not enable the `redis-server.service` from the previous step.

    ```
    dockerd # if docker isn't already running
    docker run -p 6379:6379 -v $REDIS_DATA_DIR redis
    # $REDIS_DATA_DIR should be an absolute path to a folder where you intend to store Redis data
    ```

    You need to have Redis running when you start the dev server later on. If you have issues running Docker, try [adding your user to the docker group][dockerGroup], and/or [updating the socket file permissions][socketPermissions], or try running these commands under `sudo`.

    [dockerGroup]: https://stackoverflow.com/a/48957722
    [socketPermissions]: https://stackoverflow.com/a/51362528

[< Previous](index.md) | [Next >](quickstart_2_initialize_database.md)
