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
    middle: { temporalGranularity: "weekly" }
});

adminRef.runCommand({
    split: `${dbName}.Popular-Rank`,
    middle: { temporalGranularity: "monthly" }
});

adminRef.runCommand({
    moveChunk: `${dbName}.Popular-Rank`,
    find: { temporalGranularity: "weekly" },
    to: "rs-shard-2"
});

adminRef.runCommand({
    moveChunk: `${dbName}.Popular-Rank`,
    find: { temporalGranularity: "monthly" },
    to: "rs-shard-2"
});


var data = [];

var timeUnits = [
    { granularity: "daily", interval: 24 * 60 * 60 * 1000 },
    { granularity: "weekly", interval: 7 * 24 * 60 * 60 * 1000 },
    { granularity: "monthly", interval: 30 * 24 * 60 * 60 * 1000 }
];

print("Aggregating top read articles from the Read table..");
timeUnits.forEach(function (unit) {
    for (var timeStart = timeBegin; timeStart < timeEnd; timeStart += unit.interval) {
        var timeEndUnit = timeStart + unit.interval;

        var topArticles = readCollection.aggregate([
            {
                $match: {
                    $expr: {
                        $and: [
                            { $gte: [{ $toLong: "$timestamp" }, timeStart] },
                            { $lt: [{ $toLong: "$timestamp" }, timeEndUnit] }
                        ]
                    }
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

        var articleAidList = topArticles.map(function (article) {
            return article.aid;
        });

        if (articleAidList.length > 0) {
            popularRankCollection.insertOne({
                timestamp: timeStart,
                temporalGranularity: unit.granularity,
                articleAidList: articleAidList
            });
        }
    }

    print(`Top-${unit.granularity} popular articles have been inserted into Popular-Rank.`);
});