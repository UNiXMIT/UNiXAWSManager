#!/bin/bash

containerName=awsmanager 
containerRepo=mf/awsmanager 
runOptions=(
-v /home/support/.aws:/root/.aws:ro,Z 
-e AWS_DEFAULT_REGION=eu-west-2
-e DEFAULT_REGION=eu-west-2
-e DEFAULT_OWNER=SUPPORT
-e SEMAPHORE_API_ENDPOINT=http://localhost:3000/api
-e SEMAPHORE_API_TOKEN="yourAPIToken"
-p 8989:3001
--restart always
--health-cmd "wget -qO- http://localhost:3001/api/health || exit 1"
--health-interval 30s
--health-timeout 10s
--health-retries 3
--health-start-period 30s
)

checkContainerRuntime() {
    printf "Checking Container Runtime...\n\n"
    containerRuntime=$(which docker 2>/dev/null) ||
        containerRuntime=$(which podman 2>/dev/null) ||
        {
            printf "!!!No docker or podman executable found in your PATH!!!\n\n"
            exit 1
        }
    printf "Using Container Runtime - ${containerRuntime}\n\n"
}

removeContainer() {
    if [[ -n "$(sudo ${containerRuntime} ps -a -q -f name=${containerName})" ]]; then
        printf "Removing Container...\n\n"
        sudo ${containerRuntime} stop ${containerName} >/dev/null
        sudo ${containerRuntime} wait ${containerName} >/dev/null
        sudo ${containerRuntime} rm ${containerName} >/dev/null
    fi
}

updateContainer() {
    printf "Updating Container...\n\n"
    sudo ${containerRuntime} pull node
}

buildContainer() {
    printf "Building Container...\n\n"
    sudo ${containerRuntime} build --tag ${containerRepo} -f $(dirname "$0")/Dockerfile
}

startContainer() {
    printf "Starting Container...\n\n"
    sudo ${containerRuntime} run -d --name ${containerName} "${runOptions[@]}" ${containerRepo} 
}

checkContainerRuntime
removeContainer
if [[ $1 == 'update' ]]; then
    updateContainer
fi
buildContainer
startContainer
