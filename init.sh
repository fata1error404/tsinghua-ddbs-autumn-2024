#!/bin/bash

echo "$(tput bold)Initialization script running."
echo -e "$(tput dim)Deleting old Docker containers:$(tput sgr 0)\n"
docker rm -vf $(docker ps -a -q | grep -v $(docker ps -a -q --filter name=frontend))

echo -e "\n\n\n$(tput bold dim)Starting Docker containers..$(tput sgr 0)"
docker compose up -d

sleep 10

# Verify Redis Connectivity
echo -e "\n\n$(tput bold dim)Checking Redis connectivity..$(tput sgr 0)"
docker exec -it redis redis-cli PING

# MongoDB Replica Sets Initialization
echo -e "\n\n$(tput bold dim)Initializing MongoDB replica sets.. $(tput sgr 0)"
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
    {_id: 1, host: 'shard-1b:27017'}
  ]
})"

echo -e "\n\n$(tput bold)Shard 2:$(tput sgr 0) \n"
docker exec -it shard-2a mongosh --eval "rs.initiate({
  _id: 'rs-shard-2',
  members: [
    {_id: 0, host: 'shard-2a:27017'},
    {_id: 1, host: 'shard-2b:27017'}
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

# Loading data into tables
echo -e "\n\n$(tput bold dim)Bulk loading data..$(tput sgr 0)"
echo "$(tput dim)User$(tput sgr 0)"
docker exec -it router sh -c "mongoimport -d data-center -c User < /app/data/user.dat"

echo -e "\n$(tput dim)Article$(tput sgr 0)"
docker exec -it router sh -c "mongoimport -d data-center -c Article-main < /app/data/article.dat"
echo "Duplicating category science into DBMS2.."
docker exec -it router sh -c "jq 'select(.category == \"science\")' /app/data/article.dat > /app/data/filtered_article.dat"
docker exec -it router sh -c "mongoimport -d data-center -c Article-science < /app/data/filtered_article.dat"

# echo -e "\n$(tput dim)Read$(tput sgr 0)"
# docker exec -it router mongosh /app/scripts/init-read.js
# docker exec -it router sh -c "mongoimport -d data-center -c Read < /app/data/read_with_regions.dat"

# # echo -e "\n$(tput dim)Be-Read$(tput sgr 0)"
# # docker exec -it router mongosh /app/scripts/init-be-read.js

# echo -e "\n$(tput dim)Popular-Rank$(tput sgr 0)"
# docker exec -it router mongosh /app/scripts/init-popular-rank.js


echo -e "\n$(tput bold dim)Shard distribution info:$(tput sgr 0)"
docker exec -it router mongosh --eval "db.getSiblingDB('data-center').getCollection('Popular-Rank').getShardDistribution()"



# Initializing Hadoop
# echo -e "\n\n$(tput bold dim)Initializing Hadoop HDFS.. $(tput sgr 0)"
# echo "$(tput bold)Formatting Namenode..$(tput sgr 0)"
# docker exec -it hadoop-namenode bash -c "hdfs namenode -format"

# echo "$(tput bold)Starting Namenode and Datanode..$(tput sgr 0)"
# docker exec -it hadoop-namenode bash -c "hdfs namenode &"
# docker exec -it hadoop-datanode bash -c "hdfs datanode &"

# sleep 10

# echo "$(tput bold dim)Verifying HDFS status..$(tput sgr 0)"
# docker exec -it hadoop-namenode bash -c "hdfs dfsadmin -report"

# echo "$(tput bold dim)Creating HDFS directories..$(tput sgr 0)"
# docker exec -it hadoop-namenode bash -c "hdfs dfs -mkdir -p /data"

# echo "$(tput bold dim)Uploading example data to HDFS..$(tput sgr 0)"
# docker exec -it hadoop-namenode bash -c "hdfs dfs -put /hadoop/data/example.txt /data"

echo -e "\n\n$(tput setaf 2)Initialization DONE$(tput sgr 0)"
echo "$(tput setaf 2 bold)MongoDB Sharded Cluster and Apache Hadoop HDFS are ready and running on your local machine!$(tput sgr 0)"
