// Timestamps
// milliseconds: 9999990000
// days: 115
// weeks: 16
// months: 3

var timeBegin = 1506332297000
var timeEnd = 1516332287000

var dbName = "data-center";
var adminRef = db.getSiblingDB("admin");

var readCollection = db.getSiblingDB(dbName).getCollection('Read');
var popularRankCollection = db.getSiblingDB(dbName).getCollection('Popular-Rank');


adminRef.runCommand({
    split: `${dbName}.Popular-Rank`,
    middle: { temporalGranularity: "daily" }
});

adminRef.runCommand({
    moveChunk: `${dbName}.Popular-Rank`,
    find: { temporalGranularity: "daily" },
    to: "rs-shard-1"
});


// Calculate the top-5 most popular aids for each day
for (var dayStart = timeBegin; dayStart < timeEnd; dayStart += 24 * 60 * 60 * 1000) {
    var dayEnd = dayStart + 24 * 60 * 60 * 1000;

    var topArticles = readCollection.aggregate([
        {
            $match: {
                timestamp: { $gte: dayStart, $lt: dayEnd }
            }
        },
        {
            $group: {
                _id: "$aid",
                readCount: { $sum: 1 }
            }
        },
        {
            $sort: { readCount: -1 }
        },
        {
            $limit: 5
        },
        {
            $project: {
                _id: 0,
                aid: "$_id"
            }
        }
    ]).toArray();

    var articleAidList = topArticles.map(article => article.aid);

    if (articleAidList.length > 0) {
        popularRankCollection.insertOne({
            timestamp: dayStart,
            temporalGranularity: "daily",
            articleAidList: articleAidList
        });
    }
}

print("Top-5 daily popular articles have been inserted into Popular-Rank.");