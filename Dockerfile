# We split deps and builder to speed up builds where dependencies
# don't change, since they'll be cached.
FROM golang:1.11-alpine3.8 as build_deps
RUN apk update && apk add --no-cache git
WORKDIR /go/src/github.com/sourcegraph/sourcegraph
ENV GO111MODULE=on
COPY go.mod go.sum ./
RUN go mod download

# Go builder image
FROM build_deps as build
ARG VERSION
COPY . .
ENV VERSION=$VERSION CGO_ENABLED=0 GOOS=linux GOARCH=amd64
RUN go generate ./... && go install \
  -buildmode "exe" \
  -a -tags "dist netgo" \
  -ldflags '-w -extldflags "-static" -X github.com/sourcegraph/sourcegraph/pkg/version.version='$VERSION \
  ./...

# Server image with everything together.
FROM alpine:3.8 as server
ARG VERSION
RUN echo -e "@edge http://dl-cdn.alpinelinux.org/alpine/edge/main\n" >> /etc/apk/repositories && \
  echo -e "@edge http://dl-cdn.alpinelinux.org/alpine/edge/community\n" >> /etc/apk/repositories
RUN echo -e "http://dl-cdn.alpinelinux.org/alpine/v3.6/main\n" >> /etc/apk/repositories && \
  echo -e "http://dl-cdn.alpinelinux.org/alpine/v3.6/community\n" >> /etc/apk/repositories
RUN apk add --no-cache 'postgresql-contrib<9.7' 'postgresql<9.7' bind-tools ca-certificates curl docker git@edge mailcap nginx openssh-client redis su-exec tini
RUN curl -o /usr/local/bin/syntect_server https://storage.googleapis.com/sourcegraph-artifacts/syntect_server/f85a9897d3c23ef84eb219516efdbb2d && chmod +x /usr/local/bin/syntect_server
RUN apk --no-cache add curl jansson-dev libseccomp-dev linux-headers autoconf pkgconfig make automake gcc g++ binutils && curl https://codeload.github.com/universal-ctags/ctags/tar.gz/7918d19fe358fae9bad1c264c4f5dc2dcde5cece | tar xz -C /tmp && cd /tmp/ctags-7918d19fe358fae9bad1c264c4f5dc2dcde5cece && ./autogen.sh && LDFLAGS=-static ./configure --program-prefix=universal- --enable-json --enable-seccomp && make -j8 && make install && cd && rm -rf /tmp/ctags-7918d19fe358fae9bad1c264c4f5dc2dcde5cece && apk --no-cache --purge del curl jansson-dev libseccomp-dev linux-headers autoconf pkgconfig make automake gcc g++ binutils
ENV LANG=en_US.utf8 VERSION=$VERSION
COPY --from=build /go/bin/* /usr/local/bin/
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/server"]
