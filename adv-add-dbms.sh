#!/bin/bash

NAME="shard-3"
NETWORK="project_data-center-network"
PORT=27017
REPL_SET="rs-shard-3"


docker rm -vf shard-3a shard-3b 2>/dev/null || true
echo -e "\n$(tput bold)Expansion script running. $(tput sgr 0)"
echo -e "$(tput dim)Creating Docker containers for a new shard:$(tput sgr 0)\n"

docker run -d \
    --name ${NAME}a \
    --network $NETWORK \
    mongo:latest \
    mongod --shardsvr --replSet $REPL_SET --port $PORT

docker run -d \
    --name ${NAME}b \
    --network $NETWORK \
    mongo:latest \
    mongod --shardsvr --replSet $REPL_SET --port $PORT

docker ps --filter "name=$NAME" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | while read line; do
    if [[ $line == NAMES* ]]; then
        echo -e "\n$(tput bold dim)$line$(tput sgr 0)"
    else
        if echo "$line" | grep -q "Up"; then
            echo -e "$(tput setaf 7 dim)$line$(tput sgr 0)"
        else
            echo -e "$(tput setaf 1)$line$(tput sgr 0)"
        fi
    fi
done

sleep 10


echo -e "\n\n$(tput bold dim)Initializing MongoDB replica sets.. $(tput sgr 0)"
echo -e "$(tput bold)New shard:$(tput sgr 0) \n"
docker exec -it ${NAME}a mongosh --eval "rs.initiate({
  _id: '$REPL_SET',
  members: [
    {_id: 0, host: '${NAME}a:$PORT'},
    {_id: 1, host: '${NAME}b:$PORT'}
  ]
})"


echo -e "\n\n$(tput bold dim)Checking connectivity..$(tput sgr 0)\n"
docker exec -it ${NAME}a mongosh --eval "db.runCommand({ ping: 1 })" --quiet | grep 'ok' | awk -v container=${NAME}a -F ': ' '{print container "  ok : " $2}' | tr -d '},'
docker exec -it ${NAME}b mongosh --eval "db.runCommand({ ping: 1 })" --quiet | grep 'ok' | awk -v container=${NAME}b -F ': ' '{print container "  ok : " $2}' | tr -d '},'


echo -e "\n\n\n$(tput bold dim)Adding shard to the cluster..$(tput sgr 0)\n"
docker exec -it router mongosh --eval "sh.addShard('$REPL_SET/${NAME}a:$PORT,${NAME}b:$PORT')"


echo -e "\n\n$(tput setaf 2)Expansion DONE$(tput sgr 0)"
echo "$(tput setaf 2 bold)New DBMS server has joined!$(tput sgr 0)"