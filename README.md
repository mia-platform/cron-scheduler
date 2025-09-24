# Cron Scheduler
[![pipeline status][pipeline]][git-link]
[![coverage report][coverage]][git-link]

## Summary
This repository contains the microservice responsible for the handling of the Mia-Platform cronjob.

## Local Development
To develop the service locally you need:
- Node 8+

To setup node, please if possible try to use [nvm][nvm], so you can manage multiple
versions easily. Once you have installed nvm, you can go inside the directory of the project and simply run
`nvm install`, the `.nvmrc` file will install and select the correct version if you don’t already have it.

Once you have all the dependency in place, you can launch:
```shell
npm i
npm run coverage
```

This two commands, will install the dependencies and run the tests with the coverage report that you can view as an HTML
page in `coverage/lcov-report/index.html`.  
After running the coverage you can create your local copy of the default values for the `env` variables needed for
launching the application.

```shell
cp ./default.env ./local.env
```

From now on, if you want to change anyone of the default values for the variables you can do it inside the `local.env`
file without pushing it to the remote repository.

Once you have all your dependency in place you can launch:
```shell
set -a && source ./local.env
npm start
```
After that you will have the service exposed on your machine.

## Configuring the Cron Scheduler
The Cron Scheduler needs a configuration file specifying the scripts to run and when to run them.
Currently, only Node scripts are supported.  
The configuration file must be placed in the root folder of the service having and specify its name via the env variable
`CONFIG_PATH`.
The [config-example.json][config-file] file of this repository is an example showing how it should be structured.

```json
[
  {
    "name": "YOUR_DESIRED_SCRIPT_NAME",
    "filePath": "FULL_PATH_TO_THE_SCRIPT",
    "crontab": "CRON_TAB_STRING (Ex: * * * * * 30)",
    "timezone": "THE_DESIRED_TIMEZONE",
    "env": {
      "ENV_VARIABLE_NAME_1": "ENV_VARIABLE_VALUE_1",
      "ENV_VARIABLE_NAME_2": "ENV_VARIABLE_VALUE_2"
    }
  },
  {
  }
]
```

## Configuring cron scheduler for another client
You can use cron scheduler as is, or integrating your scripts.
In the latter case, you should create your own dockerfile inheriting from the docker image at *nexus.mia-platform.eu/cron-scheduler*.
Through the dockerfile, copy the scripts you want to run in the created container, and create your own configuration file that you should also copy in the docker image.

## Scripts available
Cron scheduler offers some script ready to be used simply setting them in the configuration.
These services are:
 - send-curl

# Send curl
This is a script that try to send POST requests reading continuously from mongo the information to send.
The script connects to the `MONGO_COLLECTION` specified in the env and reads rows so composed:

- `url`: a string representing to url to send the request to
- `body`: a stringified object containg the body to attach to the request (json body is only supported now)
- `headers`: a stringified object containing the headers to attach to the request
- `state`: the current processing state of the request to send among:
    - `PENDING`: the request need to be processed
    - `SENDING`: the request is being processed
    - `SENT`: the request was processed succesfully
- `attempt`: the number of attempts the script did for this request

For each read row in a `PENDING` state, the script attempts to send a POST request with the read information.
If the POST is sent succesfully and the status code of the response is `204` or `200` the request is not sent anymore.
Otherwise a new attempt is done after the period set in the cron settings.
A configuration example is the following:
```json
{
  "name": "Send Curl",
  "filePath": "/cron-scheduler/scripts/send-curl/index.js",
  "crontab": "*/5 * * * * *",
  "timezone": "Europe/Rome",
  "env": {
    "MONGO_URL": "mongodb://localhost:27017/curl-db-name",
    "MONGO_COLLECTION": "curl-collection-name"
  }
}
```
Where:
 - `MONGO_URL` is the url to reach mongo with the db containing the *MONGO_COLLECTION* collection where curls are stored
 - `MONGO_COLLECTION` - Is the name of the collection from where the curl are retrieved

## Contributing
To contribute to the project, please be mindful for this simple rules:
1. Don’t commit directly on master
2. Start your branches with `feature/` or `fix/` based on the content of the branch
3. If possible, refer to the Jira issue id, inside the name of the branch, but not call it only `fix/BAAST3000`
4. Always commit in english
5. Once you are happy with your branch, open a [Merge Request][merge-request]

## Run the Docker Image
If you are interested in the docker image you can get one and run it locally with this commands:
```shell
docker pull nexus.mia-platform.eu/core/cron-scheduler:latest
docker run --name cron-scheduler \
           --detach \
           --mount type=bind,source=$(pwd)/tests/config.json,target=/home/node/app/config.json
           --env LOG_LEVEL=info \
           --env CONFIG_PATH=./config.json \
           nexus.mia-platform.eu/core/cron-scheduler
```

[pipeline]: https://git.tools.mia-platform.eu/platform/core/cron-scheduler/badges/master/pipeline.svg
[coverage]: https://git.tools.mia-platform.eu/platform/core/cron-scheduler/badges/master/coverage.svg
[git-link]: https://git.tools.mia-platform.eu/platform/core/cron-scheduler/commits/master

[nvm]: https://github.com/creationix/nvm
[config-file]: ./config-example.json
[merge-request]: https://git.tools.mia-platform.eu/platform/core/cron-scheduler/merge_requests
