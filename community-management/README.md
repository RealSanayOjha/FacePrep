# Community Management (MongoDB CRUD)

A small, beginner-friendly **Community Management** system built with **Node.js + Express + the official MongoDB driver**.
It manages three things: **Communities**, **Members** and **Events**, with full **CRUD** (Create, Read, Update, Delete) on each.

No ODM, no build step, no TypeScript — just `npm install`, paste your MongoDB link in `.env`, and `npm start`.

---

## 1. Requirements

- **Node.js 18 or newer** → check with `node -v`
- **A MongoDB database**, either:
  - MongoDB installed locally → `mongodb://127.0.0.1:27017`
  - or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster → `mongodb+srv://...`

## 2. Setup (takes ~1 minute)

```bash
cd community-management
npm install
```

Open the **`.env`** file and paste your connection string:

```env
# local
MONGODB_URI=mongodb://127.0.0.1:27017

# or Atlas
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

DB_NAME=community_management
PORT=3000
```

Optionally fill the app with sample data:

```bash
npm run seed     # 3 communities, 6 members, 4 events
```

Start it:

```bash
npm start        # or: npm run dev   (auto-restarts on file changes)
```

Then open **http://localhost:3000**

> `.env` is listed in `.gitignore` so your password never ends up on GitHub.
> `.env.example` is the committed template.

## 3. What the app does

| Page | What you can do |
|---|---|
| `/` | Dashboard: totals + next 5 events |
| `/communities` | List communities (with member/event counts), create, edit, delete |
| `/communities/:id` | One community + its members + its events |
| `/members` | List members (filter by community), add, edit, delete |
| `/events` | List events (filter by community), create, edit, delete |

Deleting a community also deletes its members and events.

## 4. Folder structure

```
community-management/
├── .env                  <- your MongoDB connection string (not committed)
├── .env.example          <- template
├── package.json
├── scripts/
│   └── seed.js           <- sample data (npm run seed)
├── public/
│   └── styles.css
└── src/
    ├── server.js         <- Express app, routes, error handling
    ├── config/
    │   └── db.js         <- connects to MongoDB once, exports getDB()
    ├── routes/
    │   ├── communities.js
    │   ├── members.js
    │   └── events.js
    ├── utils/
    │   └── format.js     <- date helpers used by the views
    └── views/            <- EJS pages (forms + tables)
```

## 5. Where each MongoDB operation lives

| Operation | MongoDB call | File |
|---|---|---|
| **C**reate | `insertOne()` | `src/routes/communities.js` → `POST /` (same pattern in `members.js`, `events.js`) |
| **R**ead all | `find().sort().toArray()` / `aggregate([...])` | `GET /` in each route file |
| **R**ead one | `findOne({ _id })` | `GET /:id` in `communities.js` |
| **U**pdate | `updateOne({ _id }, { $set: {...} })` | `POST /:id/update` |
| **D**elete | `deleteOne()` / `deleteMany()` | `POST /:id/delete` |
| Join | `$lookup` (communities ↔ members/events) | `members.js`, `events.js`, `communities.js` |

The seed script uses `insertMany()`, `deleteMany()` and `countDocuments()`.

## 6. Document shapes (collections)

```js
// communities
{ _id, name, description, category, location, createdAt, updatedAt }

// members  (communityId links to a community)
{ _id, name, email, role: "member" | "moderator" | "admin", communityId, joinedAt, createdAt, updatedAt }

// events   (communityId links to a community)
{ _id, title, description, date, location, communityId, createdAt, updatedAt }
```

MongoDB creates the database and the collections automatically the first time you insert something — you never have to run `createCollection`.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `MONGODB_URI is not set` | Put your connection string in `.env` (no quotes needed) and restart |
| `ECONNREFUSED 127.0.0.1:27017` | Local MongoDB is not running — start `mongod` (or `net start MongoDB` on Windows) |
| Atlas: `Could not connect` / timeout | In Atlas → **Network Access** → add your IP (or `0.0.0.0/0` while learning). Also check the username/password in the URI |
| `bad auth` | The password in the URI is URL-encoded or wrong; recreate the DB user |
| Port already in use | Change `PORT=3001` in `.env` |

## 8. npm scripts

| Command | Description |
|---|---|
| `npm start` | Run the app |
| `npm run dev` | Run with auto-reload on save (Node ≥ 18 `--watch`) |
| `npm run seed` | Replace all data with the sample set |
