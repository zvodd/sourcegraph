# Indexing a C++ repository with LSIF

This guide will walk through setting up LSIF generation for a C++ codebase using Docker.

LSIF generation requires a working build environment (the LSIF indexer essentially takes the place
of the compiler, but instead of emitting a binary, it emits LSIF data), and Docker allows us to
recreate this environment consistently.

Note: If you prefer not to use Docker (e.g., if your CI environment is not Docker-based), you can
easily adapt these instructions to a non-Docker-based system simply by converting all the steps in
the Dockerfile to a script that runs directly on the host.

1. Create a new empty directory called `lsif-docker`. We recommend you add this to an existing
   repository (e.g., the repository being indexed) OR initialize a new Git repository in this
   directory, so you can track the changes you make.

1. Create Dockerfile with the following contents in the `lsif-docker` directory:

  ```dockerfile
  FROM ubuntu:focal

  # General dependencies
  RUN apt-get -qq update
  RUN apt-get install -qq -y llvm-10 clang clang-10 libclang-10-dev cmake wget curl zip
  RUN apt-get install -qq -y git

  # Install lsif-clang
  ENV LSIF_CLANG_REV=366659086a6ba2968c837179c17ff978cf3efc97
  RUN git clone https://github.com/sourcegraph/lsif-clang.git
  WORKDIR /lsif-clang
  RUN git checkout $LSIF_CLANG_REV
  RUN cmake -B build
  RUN make -C build install
  WORKDIR /

  # src-cli
  ENV SRC_ACCESS_TOKEN=""
  ENV SRC_ENDPOINT="https://sourcegraph.com"
  RUN curl -L https://sourcegraph.com/.api/src-cli/src_linux_amd64 -o /usr/local/bin/src
  RUN chmod +x /usr/local/bin/src
  ```

1. In the `lsif-docker` directory, run `docker build .` to verify you can build this Docker image
   successfully. We will be appending to it in subsequent steps.

1. Add a step to `lsif-docker/Dockerfile` that clones the source code of the repository being
   indexed. If the repository is large, you can limit the number of commits cloned with the
   `--depth` flag. For example, if we were creating this for `github.com/google/tcmalloc`, we would
   add a line like the following:

   ```dockerfile
   RUN git clone --depth=10 https://github.com/google/tcmalloc.git /source
   WORKDIR /source
   ```

1. Add the steps to install build dependencies to `lsif-docker/Dockerfile`. For example, for
   `github.com/google/tcmalloc`, we'd add the following steps.
   
   ```dockerfile
   # Dependencies
   RUN apt-get install -y g++

   # Install Bazelisk
   RUN wget https://github.com/bazelbuild/bazelisk/releases/download/v1.7.4/bazelisk-linux-amd64 -O /usr/local/bin/bazelisk
   RUN chmod +x /usr/local/bin/bazelisk
   RUN ln -s /usr/local/bin/bazelisk /usr/local/bin/bazel

   # Install bazel-compilation-database
   RUN git clone --depth=10 https://github.com/grailbio/bazel-compilation-database.git /bazel-compilation-database
   ```

1. Create the following scripts in the `lsif-docker` directory:
   * `generate.sh`:

     ```bash
     set -eux
     cd $(dirname "${BASH_SOURCE[0]}")
     ./generate-compilation-database.sh && ./generate-lsif.sh && ./upload.sh
     ```

   * `generate-compilation-database.sh`:

     ```bash
     #!/bin/bash
     
     set -eux
     cd $(dirname "${BASH_SOURCE[0]}")
     ```

   * test
