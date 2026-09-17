/**
 * Database connection.
 *
 * Connects once when the server starts and reuses the same connection
 * (a "singleton") for every request.
 */
const { MongoClient, ObjectId } = require('mongodb');

let db = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<username>')) {
    throw new Error(
      'MONGODB_URI is not set.\n' +
        '  -> Open the ".env" file in the community-management folder and paste your MongoDB connection string.'
    );
  }

  const dbName = process.env.DB_NAME || 'community_management';
  const client = new MongoClient(uri);

  await client.connect();
  db = client.db(dbName);

  // Indexes make the lookups we do on every page faster.
  await db.collection('members').createIndex({ communityId: 1 });
  await db.collection('events').createIndex({ communityId: 1 });

  console.log(`MongoDB connected  ->  database "${dbName}"`);
  return db;
}

/** Returns the active database. Used by all the routes. */
function getDB() {
  if (!db) {
    throw new Error('Database not connected yet. Did you call connectDB()?');
  }
  return db;
}

/** Turns a string from the URL into a MongoDB ObjectId. Returns null if invalid. */
function toObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

module.exports = { connectDB, getDB, toObjectId, ObjectId };
