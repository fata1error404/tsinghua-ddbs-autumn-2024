#!/bin/bash

echo "$(tput bold)Initialization script running."
echo -e "$(tput dim)Deleting old Docker containers:$(tput sgr 0)\n"
docker rm -vf $(docker ps -a -q)

echo -e "\n\n\n$(tput bold dim)Starting Docker containers..$(tput sgr 0)"
docker-compose up -d

# Wait for containers to start
sleep 10

# Initialize MongoDB Replica Sets
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

# Initialize Hadoop
echo -e "\n\n$(tput bold dim)Initializing Hadoop HDFS.. $(tput sgr 0)"
echo -e "$(tput bold)Formatting Namenode..$(tput sgr 0)"
docker exec -it hadoop-namenode bash -c "hdfs namenode -format"

echo -e "$(tput bold)Starting Hadoop HDFS..$(tput sgr 0)"
docker exec -it hadoop-namenode bash -c "start-dfs.sh"

# Wait for Hadoop services to start
sleep 10

# Verify HDFS status
echo -e "$(tput bold)Checking Hadoop HDFS status..$(tput sgr 0)"
docker exec -it hadoop-namenode hdfs dfsadmin -report

# MongoDB Router Setup
echo -e "\n\n$(tput bold dim)Setting up MongoDB router..$(tput sgr 0)"
docker exec -it router mongosh /app/scripts/init-tables.js

# Bulk Loading Data into MongoDB
echo -e "\n\n$(tput bold dim)Bulk loading data into MongoDB..$(tput sgr 0)"
docker exec -it router sh -c "mongoimport -d data-center -c User < /app/data/user.dat"

echo -e "\n$(tput bold dim)Shard distribution info:$(tput sgr 0)"
docker exec -it router mongosh --eval "db.getSiblingDB('data-center').User.getShardDistribution()"

echo -e "\n\n$(tput setaf 2)Initialization DONE$(tput sgr 0)"
echo "$(tput setaf 2 bold)MongoDB Sharded Cluster and Apache Hadoop HDFS are ready and running!$(tput sgr 0)"