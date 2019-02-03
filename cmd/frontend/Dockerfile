FROM node:11.6.0-alpine as web_deps
COPY package.json yarn.lock ./
RUN yarn install --production

FROM web_deps as web_build
ENV NODE_ENV=production
WORKDIR /workspace
COPY web/ .
WORKDIR /workspace/web
RUN yarn -s run build

FROM alpine:3.9
# hadolint ignore=DL3018
RUN apk add --no-cache bind-tools ca-certificates mailcap tini
RUN addgroup -S sourcegraph && adduser -S -G sourcegraph -h /home/sourcegraph sourcegraph
ENV CONFIGURATION_MODE=server PGDATABASE=sg PGHOST=pgsql PGPORT=5432 PGSSLMODE=disable PGUSER=sg PUBLIC_REPO_REDIRECTS=true CACHE_DIR=/mnt/cache/frontend
USER sourcegraph
CMD ["serve"]
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/frontend"]
COPY frontend /usr/local/bin/
