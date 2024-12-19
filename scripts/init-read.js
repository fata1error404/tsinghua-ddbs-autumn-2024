var dbName = "data-center";
var adminRef = db.getSiblingDB("admin");
var userCollection = db.getSiblingDB(dbName).User;

var uidToRegionMap = {};
userCollection.find().forEach(doc => {
    uidToRegionMap[doc.uid] = doc.region;
});

adminRef.runCommand({
    split: `${dbName}.Read`,
    middle: { region: "Hong Kong" }
});

adminRef.runCommand({
    moveChunk: `${dbName}.Read`,
    find: { region: "Beijing" },
    to: "rs-shard-1"
});

adminRef.runCommand({
    moveChunk: `${dbName}.Read`,
    find: { region: "Hong Kong" },
    to: "rs-shard-2"
});

const fs = require('fs');
const inputFile = "/app/data/read.dat";
const outputFile = "/app/data/read_with_regions.dat";
print("Parsing through the read.dat file..")
const data = JSON.parse(fs.readFileSync(inputFile));

const writeStream = fs.createWriteStream(outputFile);

print("Adding region field..")
data.forEach(entry => {
    entry.region = uidToRegionMap[entry.uid] || "Unknown";
    writeStream.write(JSON.stringify(entry) + '\n');
});

print("Saved new file..")
writeStream.end();