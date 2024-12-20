const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();


// Monitoring functionality
async function checkRouterStatus() {
    const uri = "mongodb://router:27017";
    const clientRouter = new MongoClient(uri);

    try {
        await clientRouter.db("data-center").command({ ping: 1 });
        const serverInfo = await clientRouter.db().admin().serverStatus();

        const dbList = await clientRouter.db().admin().listDatabases();

        const shard1Client = new MongoClient("mongodb://shard-1a:27017,shard-1b:27017");
        const shard2Client = new MongoClient("mongodb://shard-2a:27017,shard-2b:27017");

        try {
            await shard1Client.db("data-center").command({ ping: 1 });
            var shard1Info = await shard1Client.db().admin().serverStatus();
            var shard1DbList = await shard1Client.db().admin().listDatabases();
            var user_count = await shard1Client.db("data-center").collection("User").countDocuments();
            var article_count = await shard1Client.db("data-center").collection("Article-main").countDocuments();
            var read_count = await shard1Client.db("data-center").collection("Read").countDocuments();
            var be_read_count = await shard1Client.db("data-center").collection("Be-Read").countDocuments();

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
            await shard2Client.db("data-center").command({ ping: 1 });
            var shard2Info = await shard2Client.db().admin().serverStatus();
            var shard2DbList = await shard2Client.db().admin().listDatabases();
            var user_count = await shard2Client.db("data-center").collection("User").countDocuments();
            var article_count = await shard2Client.db("data-center").collection("Article-main").countDocuments();
            var science_count = await shard2Client.db("data-center").collection("Article-science").countDocuments();
            var read_count = await shard2Client.db("data-center").collection("Read").countDocuments();
            var be_read_count = await shard2Client.db("data-center").collection("Be-Read").countDocuments();
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
            total_size: (dbList.databases[2].sizeOnDisk / (1024 * 1024)).toFixed(2),
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


// async function removeShard(shardName) {
//     const uri = "mongodb://router:27017";
//     const client = new MongoClient(uri);

//     try {
//         await client.connect();
//         const adminDb = client.db("admin");

//         // Start draining the shard
//         console.log(`Starting removal of shard: ${shardName}`);
//         let result = await adminDb.command({ removeShard: shardName });
//         console.log(result);

//         // Monitor the removal progress
//         while (result.state !== "completed") {
//             console.log(`Shard ${shardName} state: ${result.state}`);
//             result = await adminDb.command({ removeShard: shardName });
//             await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
//         }

//         console.log(`Shard ${shardName} successfully removed.`);
//     } catch (err) {
//         console.error(`Error removing shard: ${err.message}`);
//     } finally {
//         await client.close();
//     }
// }

// Usage
// removeShard("rs-shard-1");


app.use(express.static(path.join(__dirname, 'frontend')));



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mainpage.html'));
});



app.get('/monitoring', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitoring.html'));
});



app.get('/query', (req, res) => {
    res.sendFile(path.join(__dirname, 'query.html'));
});



app.get('/router-status', async (req, res) => {
    const status = await checkRouterStatus();
    res.json(status);
});



app.listen(3000, () => {
    console.log('Server running on port 3000');
});




// async function getShardDocumentDistribution() {
//     const uri = "mongodb://router:27017"; // Replace with your router's connection string
//     const client = new MongoClient(uri);

//     try {
//         await client.connect();

//         const configDb = client.db("config");

//         // Get chunks for the User collection and group them by shard
//         const chunks = await configDb.collection("chunks").aggregate([
//             { $match: { ns: "data-center.User" } }, // Filter by the namespace (db.collection)
//             {
//                 $project: {
//                     shard: 1,
//                     documents: { $add: ["$min", "$max"] }, // You can add min and max to calculate doc count if you want more specific info
//                 },
//             },
//             { $group: { _id: "$shard", totalDocuments: { $sum: 1 } } }, // Count docs per shard
//         ]).toArray();

//         return chunks.map(chunk => ({
//             shard: chunk._id,
//             totalDocuments: chunk.totalDocuments,
//         }));
//     } catch (err) {
//         console.error("Error:", err.message);
//         return null;
//     } finally {
//         await client.close();
//     }
// }

// getShardDocumentDistribution().then((shardDistribution) => {
//     console.log("Shard Document Distribution:", shardDistribution);
// });