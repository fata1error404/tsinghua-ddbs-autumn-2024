var adminRef = db.getSiblingDB("admin")
var dbName = "data-center";
var userCollection = db.getSiblingDB(dbName).User;;

var shard1UIDs = userCollection.find({ region: "Beijing" }).toArray().map(doc => doc.uid);
var shard2UIDs = userCollection.find({ region: "Hong Kong" }).toArray().map(doc => doc.uid);

sh.setBalancerState(false);

shard1UIDs.forEach(uid => {
    adminRef.runCommand({
        split: `${dbName}.Read`,
        middle: { uid: uid }
    });
    adminRef.runCommand({
        moveChunk: `${dbName}.Read`,
        find: { uid: uid },
        to: "rs-shard-1"
    });
});

shard2UIDs.forEach(uid => {
    adminRef.runCommand({
        split: `${dbName}.Read`,
        middle: { uid: uid }
    });
    adminRef.runCommand({
        moveChunk: `${dbName}.Read`,
        find: { uid: uid },
        to: "rs-shard-2"
    });
});

sh.setBalancerState(true);




// Step 1: Create the new collection and shard it
sh.shardCollection("data-center.ReadFinal", { uid: 1 }); // Shard the new collection by `uid`

// Step 2: Copy data from `Read` to `ReadFinal` without the "region" field
db.getSiblingDB("data-center").Read.aggregate([
    {
        $project: {
            region: 0 // Exclude the "region" field
        }
    },
    {
        $merge: {
            into: "ReadFinal", // Target collection
            whenMatched: "fail", // Ensure no duplicates
            whenNotMatched: "insert"
        }
    }
]);