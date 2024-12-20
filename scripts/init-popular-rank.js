// Timestamps
// milliseconds: 9999990000
// days: 115
// weeks: 16
// months: 3

var timeBegin = 1506332297000;
var timeEnd = 1516332287000;

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

adminRef.runCommand({
    moveChunk: `${dbName}.Popular-Rank`,
    find: { temporalGranularity: "weekly" },
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
    for (var dayStart = timeBegin; dayStart < timeEnd; dayStart += unit.interval) {
        var dayEnd = dayStart + unit.interval;

        var topArticles = readCollection.aggregate([
            {
                $match: {
                    $expr: {
                        $and: [
                            { $gte: [{ $toLong: "$timestamp" }, dayStart] },
                            { $lt: [{ $toLong: "$timestamp" }, dayEnd] }
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

        var articleAidList = topArticles.map(article => article.aid);

        if (articleAidList.length > 0) {
            data.push({
                timestamp: dayStart,
                temporalGranularity: unit.granularity,
                articleAidList: articleAidList
            });
        }
    }
});

var dailyData = data.filter(item => item.temporalGranularity === "daily");
var weeklyAndMonthlyData = data.filter(item => item.temporalGranularity === "weekly" || item.temporalGranularity === "monthly");

print("Inserting daily data into DBMS1..");
if (dailyData.length > 0) {
    popularRankCollection.bulkWrite(
        dailyData.map(doc => ({ insertOne: { document: doc } }))
    );
}

print("Inserting weekly and monthly data into DBMS2..");
if (weeklyAndMonthlyData.length > 0) {
    popularRankCollection.bulkWrite(
        weeklyAndMonthlyData.map(doc => ({ insertOne: { document: doc } }))
    );
}
