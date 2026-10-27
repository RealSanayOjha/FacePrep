/**
 * Built-in local MongoDB-compatible engine (powered by `mingo`).
 *
 * Used when:
 *   1. `MONGODB_URI=memory` is set in `.env`, OR
 *   2. `MONGODB_URI` points to `localhost` / `127.0.0.1` and local `mongod`
 *      is not running (`ECONNREFUSED`), so `npm run seed` and `npm start`
 *      work out of the box without extra setup.
 *
 * When a running local `mongod` or a MongoDB Atlas `mongodb+srv://` URI is
 * provided, `db.js` uses the official `mongodb` Node.js driver directly.
 */
const fs = require('fs');
const path = require('path');
const mingo = require('mingo');
const { ObjectId } = require('mongodb');

function cloneValue(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof ObjectId) return new ObjectId(val.toHexString());
  if (val instanceof Date) return new Date(val.getTime());
  if (Array.isArray(val)) return val.map(cloneValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = cloneValue(v);
    return out;
  }
  return val;
}

function serializeValue(val) {
  if (val instanceof ObjectId) return { $oid: val.toHexString() };
  if (val instanceof Date) return { $date: val.toISOString() };
  if (Array.isArray(val)) return val.map(serializeValue);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = serializeValue(v);
    return out;
  }
  return val;
}

function deserializeValue(val) {
  if (Array.isArray(val)) return val.map(deserializeValue);
  if (val && typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 1 && typeof val.$oid === 'string' && ObjectId.isValid(val.$oid)) {
      return new ObjectId(val.$oid);
    }
    if (keys.length === 1 && typeof val.$date === 'string') {
      return new Date(val.$date);
    }
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = deserializeValue(v);
    return out;
  }
  return val;
}

function getByPath(obj, fieldPath) {
  const parts = fieldPath.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function createMemoryDB(dbName = 'community_management') {
  const cacheDir = path.join(__dirname, '..', '..', '.cache');
  const storageFile =
    process.env.MEMORY_DB_FILE || path.join(cacheDir, `${dbName}.json`);

  let collections = {};
  const indexRegistry = {};

  if (fs.existsSync(storageFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
      collections = deserializeValue(raw.collections || {});
    } catch {
      collections = {};
    }
  }

  function persist() {
    try {
      fs.mkdirSync(path.dirname(storageFile), { recursive: true });
      fs.writeFileSync(
        storageFile,
        JSON.stringify({ collections: serializeValue(collections) }, null, 2),
        'utf8'
      );
    } catch {
      // Ignore write failures in read-only environments
    }
  }

  function ensureCollection(name) {
    if (!collections[name]) collections[name] = [];
    if (!indexRegistry[name]) {
      indexRegistry[name] = [{ v: 2, key: { _id: 1 }, name: '_id_' }];
    }
    return collections[name];
  }

  const mingoOptions = {
    hashFunction: (v) => (v instanceof ObjectId ? v.toHexString() : JSON.stringify(v)),
    collectionResolver: (name) => cloneValue(ensureCollection(name)),
  };

  function getCollection(name) {
    ensureCollection(name);

    return {
      async insertOne(doc) {
        const copy = cloneValue(doc);
        if (!copy._id) copy._id = new ObjectId();
        collections[name].push(copy);
        persist();
        return { acknowledged: true, insertedId: cloneValue(copy._id) };
      },

      async insertMany(docs) {
        const insertedIds = {};
        docs.forEach((doc, idx) => {
          const copy = cloneValue(doc);
          if (!copy._id) copy._id = new ObjectId();
          collections[name].push(copy);
          insertedIds[idx] = cloneValue(copy._id);
        });
        persist();
        return { acknowledged: true, insertedCount: docs.length, insertedIds };
      },

      find(filter = {}, options = {}) {
        let projection = options.projection || undefined;
        let sortSpec = null;
        let skipCount = 0;
        let limitCount = null;

        const cursor = {
          project(p) {
            projection = p;
            return cursor;
          },
          sort(s) {
            sortSpec = s;
            return cursor;
          },
          skip(n) {
            skipCount = Number(n) || 0;
            return cursor;
          },
          limit(n) {
            limitCount = Number(n);
            return cursor;
          },
          async toArray() {
            const source = cloneValue(collections[name]);
            let mCursor = mingo.find(source, filter, projection, mingoOptions);
            if (sortSpec) mCursor = mCursor.sort(sortSpec);
            if (skipCount > 0) mCursor = mCursor.skip(skipCount);
            if (limitCount !== null && !Number.isNaN(limitCount)) {
              mCursor = mCursor.limit(limitCount);
            }
            return mCursor.all();
          },
        };
        return cursor;
      },

      async findOne(filter = {}, options = {}) {
        const rows = await this.find(filter, options).limit(1).toArray();
        return rows[0] || null;
      },

      async updateOne(filter, update) {
        const res = mingo.updateOne(collections[name], filter, update, {}, mingoOptions);
        persist();
        return {
          acknowledged: true,
          matchedCount: res.matchedCount || 0,
          modifiedCount: res.modifiedCount || 0,
        };
      },

      async updateMany(filter, update) {
        const res = mingo.updateMany(collections[name], filter, update, {}, mingoOptions);
        persist();
        return {
          acknowledged: true,
          matchedCount: res.matchedCount || 0,
          modifiedCount: res.modifiedCount || 0,
        };
      },

      async deleteOne(filter = {}) {
        const query = new mingo.Query(filter, mingoOptions);
        const idx = collections[name].findIndex((d) => query.test(d));
        if (idx === -1) return { acknowledged: true, deletedCount: 0 };
        collections[name].splice(idx, 1);
        persist();
        return { acknowledged: true, deletedCount: 1 };
      },

      async deleteMany(filter = {}) {
        const query = new mingo.Query(filter, mingoOptions);
        const before = collections[name].length;
        collections[name] = collections[name].filter((d) => !query.test(d));
        const deletedCount = before - collections[name].length;
        persist();
        return { acknowledged: true, deletedCount };
      },

      async countDocuments(filter = {}) {
        if (!filter || Object.keys(filter).length === 0) {
          return collections[name].length;
        }
        const query = new mingo.Query(filter, mingoOptions);
        return collections[name].filter((d) => query.test(d)).length;
      },

      async distinct(field, filter = {}) {
        const matched = await this.find(filter).toArray();
        const seen = new Map();
        for (const doc of matched) {
          const val = getByPath(doc, field);
          const items = Array.isArray(val) ? val : [val];
          for (const item of items) {
            if (item === undefined || item === null || item === '') continue;
            const key = item instanceof ObjectId ? item.toHexString() : JSON.stringify(item);
            if (!seen.has(key)) seen.set(key, item);
          }
        }
        return Array.from(seen.values());
      },

      aggregate(pipeline = []) {
        return {
          async toArray() {
            const source = cloneValue(collections[name]);
            return mingo.aggregate(source, pipeline, mingoOptions);
          },
        };
      },

      async createIndex(key, options = {}) {
        const idxName =
          options.name ||
          Object.entries(key)
            .map(([k, v]) => `${k}_${v}`)
            .join('_');
        const exists = indexRegistry[name].some((i) => i.name === idxName);
        if (!exists) {
          const entry = { v: 2, key, name: idxName };
          if (options.unique) entry.unique = true;
          indexRegistry[name].push(entry);
        }
        return idxName;
      },

      async indexes() {
        return cloneValue(indexRegistry[name]);
      },
    };
  }

  return {
    databaseName: dbName,
    collection: getCollection,
  };
}

module.exports = { createMemoryDB };
