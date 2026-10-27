/**
 * Database connection & index setup.
 *
 * Connects once when the server starts and reuses the same connection
 * (a "singleton") for every request.
 *
 * Supports:
 *   1. MongoDB Atlas (`mongodb+srv://...`) via the official `mongodb` driver
 *   2. Local MongoDB (`mongodb://127.0.0.1:27017`) via the official `mongodb` driver
 *   3. Automatic local fallback (`mingo` + `.cache/*.json`) when local `mongod`
 *      is not running on port 27017 or when `MONGODB_URI=memory` is set.
 */
const { MongoClient, ObjectId } = require('mongodb');
const { createMemoryDB } = require('./memoryDb');

let db = null;
let connectionInfo = { dbName: 'community_management', mode: 'mongodb' };

async function ensureIndexes(database) {
  // Communities: name lookup + category/location directory filters
  await database.collection('communities').createIndex({ name: 1 });
  await database.collection('communities').createIndex({ category: 1, location: 1 });

  // Members: foreign key lookup + multikey array index on skills + leaderboard sort
  await database.collection('members').createIndex({ communityId: 1 });
  await database.collection('members').createIndex({ skills: 1 });
  await database.collection('members').createIndex({ points: -1 });

  // Events: foreign key lookup + chronological date range queries
  await database.collection('events').createIndex({ communityId: 1 });
  await database.collection('events').createIndex({ date: 1 });

  // Announcements: compound index for pinned-first feed per community
  await database
    .collection('announcements')
    .createIndex({ communityId: 1, pinned: -1, createdAt: -1 });
}

function isLocalhostUri(uri) {
  return /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(uri);
}

async function connectDB() {
  const rawUri = (process.env.MONGODB_URI || '').trim();
  const dbName = process.env.DB_NAME || 'community_management';

  if (rawUri.includes('<username>') || rawUri.includes('<password>')) {
    throw new Error(
      'Your MONGODB_URI in ".env" still contains placeholder "<username>" or "<password>".\n' +
        '  -> Replace them with your real MongoDB Atlas database username and password.'
    );
  }

  // Explicit offline / demo mode
  if (rawUri === 'memory') {
    db = createMemoryDB(dbName);
    connectionInfo = { dbName, mode: 'memory' };
    await ensureIndexes(db);
    console.log(`MongoDB (local engine) ready  ->  database "${dbName}"`);
    return db;
  }

  const uri = rawUri || 'mongodb://127.0.0.1:27017';
  const localTarget = isLocalhostUri(uri);

  try {
    const client = new MongoClient(
      uri,
      localTarget
        ? { serverSelectionTimeoutMS: 2500, connectTimeoutMS: 2500 }
        : { serverSelectionTimeoutMS: 10000 }
    );
    await client.connect();
    db = client.db(dbName);
    connectionInfo = { dbName, mode: 'mongodb' };
    await ensureIndexes(db);
    console.log(`MongoDB connected  ->  database "${dbName}"`);
    return db;
  } catch (err) {
    // If local mongod is not running on 127.0.0.1:27017, fall back gracefully
    // so `npm run seed` and `npm start` work immediately on any machine.
    if (localTarget && process.env.STRICT_MONGODB !== 'true') {
      console.warn(
        `\n[MongoDB Notice] Local MongoDB is not running at ${uri} (${err.code || err.message}).\n` +
          `  -> Falling back to built-in local document store (.cache/${dbName}.json).\n` +
          `  -> To use MongoDB Atlas instead, paste your "mongodb+srv://..." string in .env.\n`
      );
      db = createMemoryDB(dbName);
      connectionInfo = { dbName, mode: 'memory' };
      await ensureIndexes(db);
      return db;
    }

    throw err;
  }
}

/** Returns the active database. Used by all the routes. */
function getDB() {
  if (!db) {
    throw new Error('Database not connected yet. Did you call connectDB()?');
  }
  return db;
}

/** Metadata about the active DB connection for UI status/insights. */
function getConnectionInfo() {
  return connectionInfo;
}

/** Turns a string from the URL into a MongoDB ObjectId. Returns null if invalid. */
function toObjectId(id) {
  if (!id || !ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

module.exports = { connectDB, getDB, getConnectionInfo, toObjectId, ObjectId };
