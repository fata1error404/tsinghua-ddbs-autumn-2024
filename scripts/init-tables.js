// Add shards to the cluster
sh.addShard('rs-shard-1/shard-1a:27017,shard-1b:27017');
sh.addShard('rs-shard-2/shard-2a:27017,shard-2b:27017');
print("Connecting shards to the router.. Done");

var dbName = "data-center";
var adminRef = db.getSiblingDB("admin");

sh.enableSharding(dbName);
sh.shardCollection(`${dbName}.User`, { region: 1 });  // create the 'User' collection and shard it by 'region'
sh.shardCollection(`${dbName}.Read`, { region: 1 });
sh.shardCollection(`${dbName}.Article-main`, { category: 1 });
sh.shardCollection(`${dbName}.Be-Read`, { category: 1 });
sh.shardCollection(`${dbName}.Popular-Rank`, { temporalGranularity: 1 });
print("Creating empty sharded collections.. Done");

// Pre-split chunks to optimize initial distribution (to avoid migrating chunks)
// then assign chunks to shards
// User
adminRef.runCommand({
    split: `${dbName}.User`,
    middle: { region: "Hong Kong" }
});

adminRef.runCommand({
    moveChunk: `${dbName}.User`,
    find: { region: "Hong Kong" },
    to: "rs-shard-2"
});


// Article
adminRef.runCommand({
    split: `${dbName}.Article-main`,
    middle: { category: "technology" }
});

db.adminCommand({
    moveChunk: `${dbName}.Article-main`,
    find: { category: "technology" },
    to: "rs-shard-2"
});

adminRef.runCommand({
    movePrimary: "data-center",
    to: "rs-shard-2"
})

print("Assigning chunks to shards.. Done");