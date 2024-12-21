const redis = require('redis');
const { MongoClient } = require('mongodb');

const redisClient = redis.createClient();
const mongoClient = new MongoClient('mongodb://router:27017');

async function fetchUser(userId) {
  // Check Redis cache first
  const cachedData = await redisClient.get(`user:${userId}`);
  if (cachedData) {
    console.log('Cache hit');
    return JSON.parse(cachedData);
  }

  // Fetch from MongoDB if not in Redis
  console.log('Cache miss');
  const db = mongoClient.db('data-center');
  const user = await db.collection('User').findOne({ _id: userId });

  // Cache the result in Redis
  redisClient.set(`user:${userId}`, JSON.stringify(user), 'EX', 3600); // Cache for 1 hour
  return user;
}