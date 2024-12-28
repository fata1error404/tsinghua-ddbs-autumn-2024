#!/bin/bash

SHARD_NAME="rs-shard-1"
SHARD_CONTAINERS=("shard-1a" "shard-1b")
ROUTER_CONTAINER="router"

echo "$(tput bold)Dropping the database: script running. $(tput sgr 0)"


# Step 1: Initiate shard removal
echo -e "$(tput bold dim)Initiating removal of $SHARD_NAME.. $(tput sgr 0)\n"
docker exec -it $ROUTER_CONTAINER mongosh --eval "db.adminCommand({ removeShard: '$SHARD_NAME' })"


# Step 2: Monitor migration progress
echo -e "\n\n$(tput bold dim)Migration in progress...$(tput sgr 0)"
while true; do
    FULL_STATUS_OUTPUT=$(docker exec -it $ROUTER_CONTAINER mongosh --quiet --eval "JSON.stringify(db.adminCommand({ removeShard: '$SHARD_NAME' }))")

    STATUS=$(echo "$FULL_STATUS_OUTPUT" | grep -o '"state":"[^"]*"' | sed -E 's/"state":"([^"]*)"/\1/')
    REMAINING_CHUNKS=$(echo "$FULL_STATUS_OUTPUT" | grep -o '"chunks":{"low":[0-9]*' | grep -o '[0-9]*$')

    if [[ "$STATUS" == "completed" ]]; then
        echo -e "\nData migration completed!"
        break
    elif [[ "$STATUS" == "ongoing" ]]; then
        echo -ne "\rRemaining chunks: $REMAINING_CHUNKS"
        sleep 5
    else
        echo -e "\n$(tput setaf 1)Unexpected status: $STATUS$(tput sgr 0)"
        exit 1
    fi
done


# Step 3: Remove shard containers
echo -e "\n\n$(tput bold dim)Stopping and removing shard containers.. $(tput sgr 0)\n"
for container in "${SHARD_CONTAINERS[@]}"; do
    docker rm -vf $container 2>/dev/null || echo "$(tput setaf 3)Container $container not found, skipping.$(tput sgr 0)"
done


echo -e "\n\n$(tput setaf 2)Removal process DONE$(tput sgr 0)"
echo -e "$(tput setaf 2 bold)DBMS has been dropped.$(tput sgr 0)"
