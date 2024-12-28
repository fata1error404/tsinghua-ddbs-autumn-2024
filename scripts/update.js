var dbName = "data-center";

var userCollection = db.getSiblingDB(dbName).getCollection('User');

userCollection.updateMany(
    {
        language: "en",
        region: "Beijing",
        gender: "male"
    },
    {
        $set: { language: "rus" }
    }
);

var updatedDocs = userCollection.findOne(
    {
        language: "rus",
        region: "Beijing",
        gender: "male"
    }
);

print("\nRandom updated user: \n");
printjson(updatedDocs);