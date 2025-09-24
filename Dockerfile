FROM node:10.24.1-alpine as build

ARG COMMIT_SHA=<not-specified>
ENV NODE_ENV=production

WORKDIR /build-dir

COPY package.json package-lock.json ./
RUN npm install

COPY LICENSE index.js ./
RUN find . -type f -exec chmod 644 {} \;

WORKDIR /build-dir/default-scripts/send-curl

COPY default-scripts/send-curl/package.json default-scripts/send-curl/package-lock.json ./

RUN npm install

COPY default-scripts/send-curl ./

RUN echo "cron-scheduler: $COMMIT_SHA" >> /build-dir/commit.sha

########################################################################################################################

FROM node:10.24.1-alpine

LABEL maintainer="Mia Platform Core Team<core@mia-platform.eu>" \
      name="Cron Scheduler" \
      description="The microservice responsible for handling and calling the cron scripts inside the platform." \
      eu.mia-platform.url="https://www.mia-platform.eu" \
      eu.mia-platform.version="3.4.6"

ENV NODE_ENV=production
ENV LOG_LEVEL=warn

WORKDIR /home/node/app

COPY --from=build /build-dir ./

USER node

CMD ["npm", "start"]
