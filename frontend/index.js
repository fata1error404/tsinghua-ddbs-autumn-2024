const express = require('express');
const bodyParser = require('body-parser')
const { MongoClient, ObjectId } = require('mongodb');

const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


const dbName = "data-center";
const uri = "mongodb://router:27017";
const clientRouter = new MongoClient(uri);

let populateStatus = {
    status: "idle", // Possible values: "idle", "in-progress", "completed", "error"
    message: "Ready to populate data."
};


// Monitoring functionality
async function checkRouterStatus() {
    const clientRouter = new MongoClient(uri);

    try {
        await clientRouter.db(dbName).command({ ping: 1 });
        var dbList = await clientRouter.db().admin().listDatabases();
        var serverInfo = await clientRouter.db().admin().serverStatus();

        const shard1Client = new MongoClient("mongodb://shard-1a:27017,shard-1b:27017");
        const shard2Client = new MongoClient("mongodb://shard-2a:27017,shard-2b:27017");

        try {
            await shard1Client.db(dbName).command({ ping: 1 });
            var shard1Info = await shard1Client.db().admin().serverStatus();
            var shard1DbList = await shard1Client.db().admin().listDatabases();
            var user_count = await shard1Client.db(dbName).collection("User").countDocuments();
            var read_count = await shard1Client.db(dbName).collection("Read").countDocuments();
            var be_read_count = await shard1Client.db(dbName).collection("Be-Read").countDocuments();
            var article_count = await shard1Client.db(dbName).collection("Article-main").countDocuments();

            shard1 = {
                status: "ok",
                size: (shard1DbList.databases[2].sizeOnDisk / (1024 * 1024)).toFixed(2),
                ram: (shard1Info.tcmalloc.generic.current_allocated_bytes / shard1Info.tcmalloc.generic.heap_size * 100).toFixed(2),
                tables: { user_count, article_count, read_count, be_read_count }
            }
        } catch (err) {
            shard1 = {
                status: "error",
                error: err.message
            }
        } finally {
            await shard1Client.close();
        }

        try {
            await shard2Client.db(dbName).command({ ping: 1 });
            var shard2Info = await shard2Client.db().admin().serverStatus();
            var shard2DbList = await shard2Client.db().admin().listDatabases();
            var user_count = await shard2Client.db(dbName).collection("User").countDocuments();
            var read_count = await shard2Client.db(dbName).collection("Read").countDocuments();
            var be_read_count = await shard2Client.db(dbName).collection("Be-Read").countDocuments();
            var article_count = await shard2Client.db(dbName).collection("Article-main").countDocuments();
            var science_count = await shard2Client.db(dbName).collection("Article-science").countDocuments();

            article_count += science_count;

            shard2 = {
                status: "ok",
                size: (shard2DbList.databases[2].sizeOnDisk / (1024 * 1024)).toFixed(2),
                ram: (shard2Info.tcmalloc.generic.current_allocated_bytes / shard2Info.tcmalloc.generic.heap_size * 100).toFixed(2),
                tables: { user_count, article_count, read_count, be_read_count }
            }
        } catch (err) {
            shard2 = {
                status: "error",
                error: err.message
            }
        } finally {
            await shard2Client.close();
        }

        return {
            status: "ok",
            uptime: serverInfo.uptime,
            total_size: dbList.databases[2].sizeOnDisk / (1024 * 1024),
            opcounters: serverInfo.opcounters,
            user_docs: shard1.tables.user_count + shard2.tables.user_count,
            article_docs: shard1.tables.article_count + shard2.tables.article_count,
            read_docs: shard1.tables.read_count + shard2.tables.read_count,
            be_read_docs: shard1.tables.be_read_count + shard2.tables.be_read_count,
            shard1: shard1,
            shard2: shard2
        };
    } catch (err) {
        return {
            status: "error",
            error: err.message
        };
    } finally {
        await clientRouter.close();
    }
}



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mainpage.html'));
});



// MONITORING
app.get('/monitoring', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitoring.html'));
});



app.get('/router-status', async (req, res) => {
    const status = await checkRouterStatus();
    res.json(status);
});



app.get('/query', (req, res) => {
    res.sendFile(path.join(__dirname, 'query.html'));
});



// INSERT
app.get('/insert', (req, res) => {
    res.sendFile(path.join(__dirname, 'insert.html'));
});



app.post('/insert-user', async (req, res) => {
    var { name, gender, email, phone, language, region } = req.body;

    var timestamp = Date.now().toString();
    var maxUid = await clientRouter.db("data-center").collection("User").countDocuments();
    var id = `u${maxUid + 1}`;
    var uid = `${maxUid + 1}`;
    var dept = `dept${Math.floor(Math.random() * 20)}`;
    var grade = `grade${Math.floor(Math.random() * 4 + 1)}`;
    var role = `role${Math.floor(Math.random() * 3)}`;
    var preferTags = `tags${Math.floor(Math.random() * 50)}`;
    var obtainedCredits = `${Math.floor(Math.random() * 100)}`;

    try {
        await clientRouter.connect();

        const user = {
            _id: new ObjectId(),
            timestamp,
            id,
            uid,
            name,
            gender,
            email,
            phone,
            dept,
            grade,
            language,
            region,
            role,
            preferTags,
            obtainedCredits
        };

        // console.log(user);
        const result = await clientRouter.db("data-center").collection("User").insertOne(user);

        console.log(`New user inserted with ID: ${result.insertedId}`);
        res.redirect(`/insert-success?data=${encodeURIComponent(JSON.stringify(user))}&type=user`);
    } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).send('Error inserting user');
    } finally {
        await clientRouter.close();
    }
});



app.post('/insert-article', async (req, res) => {
    var { title, abstract, authors, language, category, text, image, video } = req.body;

    var timestamp = Date.now().toString();
    var maxAid = await clientRouter.db("data-center").collection("Article-main").countDocuments();
    var id = `a${maxAid + 1}`;
    var aid = `${maxAid + 1}`;
    var articleTags = `tags${Math.floor(Math.random() * 50)}`;

    try {
        await clientRouter.connect();

        const article = {
            _id: new ObjectId(),
            timestamp,
            id,
            aid,
            title,
            category,
            abstract,
            articleTags,
            authors,
            language,
            text,
            image,
            video
        };

        // console.log(article);
        const result = await clientRouter.db("data-center").collection("Article-main").insertOne(article);
        if (category === "science") {
            await clientRouter.db("data-center").collection("Article-science").insertOne(article);
        }

        console.log(`New article inserted with ID: ${result.insertedId}`);
        res.redirect(`/insert-success?data=${encodeURIComponent(JSON.stringify(article))}&type=article`);
    } catch (error) {
        console.error('Error inserting article:', error);
        res.status(500).send('Error inserting article');
    } finally {
        await clientRouter.close();
    }
});



app.post('/insert-read', async (req, res) => {
    var { readTimeLength, agreeOrNot, commentOrNot, shareOrNot } = req.body;

    var timestamp = Date.now().toString();
    var maxId = await clientRouter.db("data-center").collection("Read").countDocuments();
    var id = `r${maxId + 1}`;
    var randomUser = await clientRouter.db("data-center").collection("User").aggregate([{ $sample: { size: 1 } }]).toArray();
    var randomArticle = await clientRouter.db("data-center").collection("Article-main").aggregate([{ $sample: { size: 1 } }]).toArray();
    var uid = randomUser[0]?.uid;
    var aid = randomArticle[0]?.aid;
    var commentDetail = `comments to this article: (${uid}, ${aid})`;
    var region = randomUser[0]?.region;

    try {
        await clientRouter.connect();

        const read = {
            _id: new ObjectId(),
            timestamp,
            id,
            uid,
            aid,
            readTimeLength,
            agreeOrNot,
            commentOrNot,
            shareOrNot,
            commentDetail,
            region
        };

        // console.log(read);
        const result = await clientRouter.db("data-center").collection("Read").insertOne(read);
        delete read.region;

        console.log(`New read inserted with ID: ${result.insertedId}`);
        res.redirect(`/insert-success?data=${encodeURIComponent(JSON.stringify(read))}&type=read`);
    } catch (error) {
        console.error('Error inserting read:', error);
        res.status(500).send('Error inserting read');
    } finally {
        await clientRouter.close();
    }
});



app.get('/insert-success', async (req, res) => {
    const data = JSON.parse(decodeURIComponent(req.query.data));
    var html = await fs.readFile(path.join(__dirname, '/insert-success.html'), 'utf8')

    const dataHTML = `
        <ul style="font-size: 1.2rem; list-style: none; padding: 0; width: 18rem;">
            ${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
        </ul>
    `;

    html = html.replace('<div id="type"> </div>', `<div id="data" style="font-size: 1.3rem"> Inserted a new ${req.query.type}: </div>`);
    html = html.replace('<div id="data"> </div>', `<div id="data"> ${dataHTML} </div>`);

    res.send(html);
});



// POPULATE BE-READ
app.get('/populate-be-read', (req, res) => {
    populateStatus.status = "in-progress";
    populateStatus.message = "Starting data population...";

    setImmediate(async () => {
        try {
            var articlesMain = await clientRouter.db(dbName).collection("Article-main").find({}, { timestamp: 1, aid: 1, category: 1 }).toArray();
            var articlesScience = await clientRouter.db(dbName).collection("Article-science").find({}, { timestamp: 1, aid: 1, category: 1 }).toArray();

            populateStatus.message = "Aggregating statistics from the Read table...";
            var readData = await clientRouter.db(dbName).collection("Read").aggregate([
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

            populateStatus.message = "Inserting data into the Be-Read table...";
            for (const article of articlesMain) {
                await clientRouter.db(dbName).collection("Be-Read").updateOne(
                    { _id: article._id },
                    { $set: article },
                    { upsert: true }
                );
            }

            for (const article of articlesScience) {
                await clientRouter.db(dbName).collection("Be-Read-science").updateOne(
                    { _id: article._id },
                    { $set: article },
                    { upsert: true }
                );
            }

            for (const read of readData) {
                const updateFields = {
                    $set: {
                        readNum: read.readNum,
                        readUidList: read.readUidList,
                        agreeNum: read.agreeNum,
                        agreeUidList: read.agreeUidList,
                        commentNum: read.commentNum,
                        commentUidList: read.commentUidList,
                        shareNum: read.shareNum,
                        shareUidList: read.shareUidList
                    }
                };
                const filter = { aid: read._id };
                for (const collection of ["Be-Read", "Be-Read-science"]) {
                    await clientRouter.db(dbName).collection(collection).updateOne(filter, updateFields);
                }
            }

            populateStatus.status = "completed";
            populateStatus.message = "Data population completed successfully.";
        } catch (error) {
            populateStatus.status = "error";
            populateStatus.message = `Error during population: ${error.message}`;
            console.error("Error during population:", error);
        }
    });

    res.sendFile(path.join(__dirname, 'populate.html'));
});




app.get('/populate-status', (req, res) => {
    res.json(populateStatus);
});



// START SERVER
app.listen(3000, () => {
    console.log('Server running on port 3000');
});