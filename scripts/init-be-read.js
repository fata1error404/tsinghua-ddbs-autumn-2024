var dbName = "data-center";
var adminRef = db.getSiblingDB("admin");

var readCollection = db.getSiblingDB(dbName).getCollection('Read');
var articleCollectionMain = db.getSiblingDB(dbName).getCollection('Article-main');
var articleCollectionScience = db.getSiblingDB(dbName).getCollection('Article-science');
var bereadCollectionMain = db.getSiblingDB(dbName).getCollection('Be-Read');
var bereadCollectionScience = db.getSiblingDB(dbName).getCollection('Be-Read-science');

var articlesMain = articleCollectionMain.find({}, { timestamp: 1, aid: 1, category: 1 }).toArray();
var articlesScience = articleCollectionScience.find({}, { timestamp: 1, aid: 1, category: 1 }).toArray();


adminRef.runCommand({
    split: `${dbName}.Be-Read`,
    middle: { category: "technology" }
});

adminRef.runCommand({
    moveChunk: `${dbName}.Be-Read`,
    find: { category: "technology" },
    to: "rs-shard-2"
});


print("Aggregating statistics from the Read table..");
var readData = readCollection.aggregate([
    {
        $group: {
            _id: "$aid",
            readNum: { $sum: 1 },
            readUidList: { $push: "$uid" },
            agreeNum: { $sum: { $cond: [{ $eq: ["$agreeOrNot", "1"] }, 1, 0] } },
            agreeUidList: {
                $push: { $cond: [{ $eq: ["$agreeOrNot", "1"] }, "$uid", "$$REMOVE"] }
            },
            commentNum: { $sum: { $cond: [{ $eq: ["$commentOrNot", "1"] }, 1, 0] } },
            commentUidList: {
                $push: { $cond: [{ $eq: ["$commentOrNot", "1"] }, "$uid", "$$REMOVE"] }
            },
            shareNum: { $sum: { $cond: [{ $eq: ["$shareOrNot", "1"] }, 1, 0] } },
            shareUidList: {
                $push: { $cond: [{ $eq: ["$shareOrNot", "1"] }, "$uid", "$$REMOVE"] }
            }
        }
    }
]).toArray();


print("Inserting data into the Be-Read table..");
if (articlesMain.length > 0) {
    bereadCollectionMain.insertMany(articlesMain);
    bereadCollectionScience.insertMany(articlesScience);

    readData.forEach((readData) => {
        bereadCollectionMain.updateOne(
            { aid: readData._id },
            {
                $set: {
                    readNum: readData.readNum,
                    readUidList: readData.readUidList,
                    agreeNum: readData.agreeNum,
                    agreeUidList: readData.agreeUidList,
                    commentNum: readData.commentNum,
                    commentUidList: readData.commentUidList,
                    shareNum: readData.shareNum,
                    shareUidList: readData.shareUidList
                }
            }
        );

        bereadCollectionScience.updateOne(
            { aid: readData._id },
            {
                $set: {
                    readNum: readData.readNum,
                    readUidList: readData.readUidList,
                    agreeNum: readData.agreeNum,
                    agreeUidList: readData.agreeUidList,
                    commentNum: readData.commentNum,
                    commentUidList: readData.commentUidList,
                    shareNum: readData.shareNum,
                    shareUidList: readData.shareUidList
                }
            }
        )
    });
}