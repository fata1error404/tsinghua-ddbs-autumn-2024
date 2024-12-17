#!/bin/bash

echo "$(tput bold)Initialization script running."
echo -e "$(tput dim)Deleting old Docker containers:$(tput sgr 0)\n"
docker rm -vf $(docker ps -a -q)

echo -e "\n\n\n$(tput bold dim)Starting Docker containers..$(tput sgr 0)"
docker compose up -d

sleep 10

echo -e "\n\n$(tput bold dim)Initializing replica sets.. $(tput sgr 0)"
echo -e "$(tput bold)Config server:$(tput sgr 0) \n"
docker exec -it config-1 mongosh --eval "rs.initiate({                                                                                                 
 _id: 'rs-config-server',
 configsvr: true,
 members: [
   {_id: 0, host: 'config-1:27017'},
   {_id: 1, host: 'config-2:27017'},
   {_id: 2, host: 'config-3:27017'}
 ]
})"

echo -e "\n\n$(tput bold)Shard 1:$(tput sgr 0) \n"
docker exec -it shard-1a mongosh --eval "rs.initiate({
 _id: 'rs-shard-1',
 members: [
   {_id: 0, host: 'shard-1a:27017'},
   {_id: 1, host: 'shard-1b:27017'},
 ]
})"

echo -e "\n\n$(tput bold)Shard 2:$(tput sgr 0) \n"
docker exec -it shard-2a mongosh --eval "rs.initiate({
 _id: 'rs-shard-2',
 members: [
   {_id: 0, host: 'shard-2a:27017'},
   {_id: 1, host: 'shard-2b:27017'},
 ]
})"


containers=("config-1" "config-2" "config-3" "shard-1a" "shard-1b" "shard-2a" "shard-2b")
echo -e "\n\n$(tput bold dim)Checking connectivity..$(tput sgr 0)\n"
for container in "${containers[@]}" 
do
  output=$(docker exec -it $container mongosh --eval "db.runCommand({ ping: 1 })" --quiet | grep 'ok' | awk -v container="$container" -F ': ' '{print container "  ok : " $2}' | tr -d '},')
  echo "$output"
done

echo -e "\n\n\n$(tput bold dim)Setting up router..$(tput sgr 0)"
sleep 10
docker exec -it router mongosh /app/scripts/init-tables.js


echo -e "\n\n$(tput bold dim)Bulk loading data..$(tput sgr 0)"
echo "$(tput dim)User$(tput sgr 0)"
docker exec -it router sh -c "mongoimport -d data-center -c User < /app/data/user.dat"
echo "$(tput dim)Article$(tput sgr 0)"
docker exec -it router sh -c "mongoimport -d data-center -c Article < /app/data/article.dat"
echo "$(tput dim)Read$(tput sgr 0)"
docker exec -it router mongosh /app/scripts/init-read.js
docker exec -it router sh -c "mongoimport -d data-center -c Temp < /app/data/read_with_regions.dat"
docker exec -it router mongosh --eval "db.getSiblingDB('data-center').Temp.aggregate([
    {
        \$merge: {
            into: 'Read',
            whenMatched: 'fail',
            whenNotMatched: 'insert'
        }
    }
])"

echo -e "\n$(tput bold dim)Shard distribution info:$(tput sgr 0)"
docker exec -it router mongosh --eval "db.getSiblingDB('data-center').Read.getShardDistribution()"
# docker exec -it router mongosh --eval "db.getSiblingDB('data-center').printShardingStatus()"

echo -e "\n\n$(tput setaf 2)Initialization DONE$(tput sgr 0)"
echo "$(tput setaf 2 bold)MongoDB Sharded Cluster is ready and running on your local machine!$(tput sgr 0)"