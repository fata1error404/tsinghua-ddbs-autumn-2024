#!/bin/bash

echo "Starting MongoDB and Hadoop Initialization..."

# Start MongoDB Config Servers
echo "Initializing MongoDB Config Server Replica Set..."
docker exec -it config-1 mongosh --eval "
rs.initiate({
  _id: 'rs-config-server',
  configsvr: true,
  members: [
    { _id: 0, host: 'config-1:27017' },
    { _id: 1, host: 'config-2:27017' },
    { _id: 2, host: 'config-3:27017' }
  ]
})"

# Initialize Shard 1 Replica Set
echo "Initializing MongoDB Shard 1 Replica Set..."
docker exec -it shard-1a mongosh --eval "
rs.initiate({
  _id: 'rs-shard-1',
  members: [
    { _id: 0, host: 'shard-1a:27017' },
    { _id: 1, host: 'shard-1b:27017' }
  ]
})"

# Initialize Shard 2 Replica Set
echo "Initializing MongoDB Shard 2 Replica Set..."
docker exec -it shard-2a mongosh --eval "
rs.initiate({
  _id: 'rs-shard-2',
  members: [
    { _id: 0, host: 'shard-2a:27017' },
    { _id: 1, host: 'shard-2b:27017' }
  ]
})"

# Add Shards to MongoDB Router
echo "Adding Shards to MongoDB Router..."
docker exec -it router mongosh --eval "
sh.addShard('rs-shard-1/shard-1a:27017,shard-1b:27017');
sh.addShard('rs-shard-2/shard-2a:27017,shard-2b:27017');
"

# Format Hadoop Namenode
echo "Formatting Hadoop Namenode..."
docker exec -it hadoop-namenode bash -c "hdfs namenode -format"

# Start Hadoop HDFS Services
echo "Starting Hadoop HDFS Services..."
docker exec -it hadoop-namenode bash -c "start-dfs.sh"

# Verify HDFS Status
echo "Verifying Hadoop HDFS Status..."
docker exec -it hadoop-namenode bash -c "hdfs dfsadmin -report"

# Load Data into MongoDB
echo "Loading Data into MongoDB..."
docker exec -it router sh -c "mongoimport -d data-center -c User --file /data/user.dat"

echo "MongoDB and Hadoop Initialization Completed Successfully!"