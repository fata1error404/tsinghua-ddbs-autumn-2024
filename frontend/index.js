const express = require('express');
const bodyParser = require('body-parser');
const redis = require("redis");
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

let client;

(async () => {
    client = redis.createClient({
        socket: {
            port: 6379,
            host: 'redis'
        }
    });
    client.on("error", (error) => console.error(`Error : ${error}`));
    client.on("connect", () => console.log("Redis connected"));
    await client.connect();
})();



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
            var popular_rank_count = await shard1Client.db(dbName).collection("Popular-Rank").countDocuments();

            shard1 = {
                status: "ok",
                size: (shard1DbList.databases[2].sizeOnDisk / (1024 * 1024)).toFixed(2),
                ram: (shard1Info.tcmalloc.generic.current_allocated_bytes / shard1Info.tcmalloc.generic.heap_size * 100).toFixed(2),
                tables: { user_count, article_count, read_count, be_read_count, popular_rank_count }
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
            var popular_rank_count = await shard2Client.db(dbName).collection("Popular-Rank").countDocuments();

            article_count += science_count;

            shard2 = {
                status: "ok",
                size: (shard2DbList.databases[2].sizeOnDisk / (1024 * 1024)).toFixed(2),
                ram: (shard2Info.tcmalloc.generic.current_allocated_bytes / shard2Info.tcmalloc.generic.heap_size * 100).toFixed(2),
                tables: { user_count, article_count, read_count, be_read_count, popular_rank_count }
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
            popular_rank_docs: shard1.tables.popular_rank_count + shard2.tables.popular_rank_count,
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
    var status = await checkRouterStatus();
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
    var maxUid = await clientRouter.db(dbName).collection("User").countDocuments();
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
        const result = await clientRouter.db(dbName).collection("User").insertOne(user);

        // Store the user data in Redis with a TTL (e.g., 1 hour)
        const redisKey = `user:${result.insertedId}`;
        await client.set(redisKey, JSON.stringify(user), { EX: 3600 });

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
    var maxAid = await clientRouter.db(dbName).collection("Article-main").countDocuments();
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
        const result = await clientRouter.db(dbName).collection("Article-main").insertOne(article);
        if (category === "science") {
            await clientRouter.db(dbName).collection("Article-science").insertOne(article);
        }

        const redisKey = `article:${result.insertedId}`;
        await client.set(redisKey, JSON.stringify(article), { EX: 3600 });

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
    var maxId = await clientRouter.db(dbName).collection("Read").countDocuments();
    var id = `r${maxId + 1}`;
    var randomUser = await clientRouter.db(dbName).collection("User").aggregate([{ $sample: { size: 1 } }]).toArray();
    var randomArticle = await clientRouter.db(dbName).collection("Article-main").aggregate([{ $sample: { size: 1 } }]).toArray();
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
        const result = await clientRouter.db(dbName).collection("Read").insertOne(read);
        delete read.region;

        const redisKey = `read:${result.insertedId}`;
        await client.set(redisKey, JSON.stringify(read), { EX: 3600 });

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
    var data = JSON.parse(decodeURIComponent(req.query.data));
    var html = await fs.readFile(path.join(__dirname, '/insert-success.html'), 'utf8')

    var dataHTML = `
        <ul style="font-size: 1.2rem; list-style: none; padding: 0; width: 18rem;">
            ${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
        </ul>
    `;

    html = html.replace('<div id="type"> </div>', `<div id="data" style="font-size: 1.3rem"> Inserted a new ${req.query.type}: </div>`);
    html = html.replace('<div id="data"> </div>', `<div id="data"> ${dataHTML} </div>`);

    res.send(html);
});



// QUERY POPULATE BE-READ
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



// QUERY TOP ARTICLES
app.get('/top-articles', (req, res) => {
    res.sendFile(path.join(__dirname, 'top-articles.html'));
});



app.post('/top-articles', async (req, res) => {
    var type, value, topArticles;

    if (req.body.day) {
        type = 'daily';
        value = req.body.day;
    } else if (req.body.week) {
        type = 'weekly';
        value = req.body.week;
    } else if (req.body.month) {
        type = 'monthly';
        value = req.body.month;
    }

    const redisKey = `top-articles:${type}:${value}`;

    try {
        // Check if the result is already cached in Redis
        const cachedData = await client.get(redisKey);

        if (cachedData) {
            console.log('Cache hit');
            topArticles = JSON.parse(cachedData);
        } else {
            console.log('Cache miss');
            await clientRouter.connect();

            const result = await clientRouter
                .db(dbName)
                .collection("Popular-Rank")
                .aggregate([
                    { $match: { temporalGranularity: type } },
                    { $sort: { timestamp: 1 } },
                    { $skip: value - 1 },
                    { $limit: 1 }
                ])
                .toArray();

            if (result.length > 0 && result[0].articleAidList) {
                const articleIds = result[0].articleAidList;

                topArticles = await clientRouter
                    .db(dbName)
                    .collection("Article-main")
                    .aggregate([
                        {
                            $match: {
                                aid: { $in: articleIds }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                aid: 1,
                                category: 1,
                                language: 1
                            }
                        }
                    ])
                    .toArray();

                // Cache the result in Redis with an expiration time (e.g., 1 hour)
                await client.set(redisKey, JSON.stringify(topArticles), {
                    EX: 3600
                });
            }
        }

        res.redirect(`/top-articles-success?data=${encodeURIComponent(JSON.stringify(topArticles))}&type=${type}`);
    } catch (error) {
        console.error('Error getting top articles:', error);
        res.status(500).send('Error getting top articles');
    } finally {
        await clientRouter.close();
    }
});



app.get('/top-articles-success', async (req, res) => {
    const data = JSON.parse(decodeURIComponent(req.query.data));

    const html = await fs.readFile(path.join(__dirname, '/top-articles-success.html'), 'utf8');

    // Build the HTML for all articles
    const dataHTML = data
        .map(article => `
            <ul style="font-size: 1.2rem; list-style: none; padding: 0; margin-bottom: 1.5rem; width: 18rem; border: 2px solid #f0f0f0; padding: 1rem; border-radius: 1rem;">
                ${Object.entries(article)
                .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
                .join('')}
            </ul>
        `)
        .join('');

    const updatedHtml = html
        .replace('<div id="type"> </div>', `<div id="type" style="font-size: 1.5rem; font-weight: bold; margin-top: 1.5rem;">TOP 5 ${req.query.type} articles:</div>`)
        .replace('<div id="data"> </div>', `<div id="data">${dataHTML}</div>`);

    res.send(updatedHtml);
});




// ____________
// START SERVER
app.listen(3000, () => {
    console.log('Server running on port 3000');
});