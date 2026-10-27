# CommunityHub — Community & Event Management (MongoDB + Express)

A clean, multi-page **Community & Event Management** web application built with **Node.js, Express, EJS, and the official MongoDB driver** (`mongodb`).

It manages **Communities**, **Members**, **Events (with RSVPs & Capacity)**, **Bulletin Announcements**, and **Live MongoDB Analytics & Index Insights** — with no ODM, no build step, and easy-to-explain MongoDB queries throughout.

---

## 1. Quick Setup

```bash
cd community-management
npm install
```

Create a `.env` file (or copy `.env.example`):

```env
# Local MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017

# Or MongoDB Atlas
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# Or instant offline demo mode (in-memory MongoDB engine)
# MONGODB_URI=memory

DB_NAME=community_management
PORT=3000
```

Seed the database with realistic sample communities, members, events, and announcements:

```bash
npm run seed
```

Start the server:

```bash
npm start        # or: npm run dev   (auto-restarts on file changes)
```

Open **http://localhost:3000**.

---

## 2. Pages & Features

| Route | What you can do |
|---|---|
| `/` | **Dashboard**: KPI totals, upcoming events with live seat progress bars, highlighted hubs, pinned bulletin posts, and clickable top member skills |
| `/search?q=...` | **Global Search**: searches across all 4 collections simultaneously (`$or` + `$regex`) |
| `/communities` | **Communities Directory**: dynamic category tabs & city filters (`distinct`), dot-notation cadence filter (`contact.meetFrequency`), sort options, and discovery tags |
| `/communities/:id` | **Community Hub**: increments view counter (`$inc`), shows embedded organizer contact info, events, member roster, and community bulletin |
| `/events` | **Events & Workshops**: filter by Upcoming (`$gte`), Past (`$lt`), Open Spots, or Format (`In-Person` / `Online` / `Hybrid`) |
| `/events/:id` | **Event Detail & Live RSVPs**: capacity progress meter, register members (`$push` with duplicate guard + `+2` member points via `$inc`), or cancel RSVPs (`$pull`) |
| `/members` | **Member Directory**: search, filter by community/role/skill, inline add/remove skills (`$addToSet` / `$pull`), award `+5 Kudos` (`$inc`), and server-side pagination (`skip` + `limit` + `countDocuments`) |
| `/announcements` | **Community Bulletin**: cross-community feed, pinned filter, publish updates, atomic Like counter (`$inc`), and Pin toggle (`$set`) |
| `/analytics` | **Insights & MongoDB Explorer**: aggregation pipeline charts (`$group`, `$unwind`, `$avg`, `$max`, multi-`$lookup` leaderboard), active index inspector (`indexes()`), and schema design guide |

---

## 3. MongoDB Concepts Demonstrated (Easy to Explain)

| MongoDB Concept | Operators / Methods Used | Where It Lives |
|---|---|---|
| **Full CRUD** | `insertOne`, `insertMany`, `find`, `findOne`, `updateOne`, `deleteOne`, `deleteMany` | All 4 route modules + `scripts/seed.js` |
| **Embedded Subdocuments** | Nested `community.contact` + dot-notation query `'contact.meetFrequency'`; embedded `event.rsvps` | `src/routes/communities.js`, `src/routes/events.js` |
| **Document References & Joins** | `communityId: ObjectId(...)` joined via `$lookup` + `$unwind` | `communities.js`, `members.js`, `events.js`, `announcements.js` |
| **Atomic Counters** | `$inc: { views: 1 }`, `$inc: { points: 5 }`, `$inc: { likes: 1 }` | Community views, Member kudos, Bulletin likes |
| **Array Operators** | `$addToSet` (unique skills), `$push` (event RSVPs), `$pull` (remove skill / cancel RSVP), `$size` | `src/routes/members.js`, `src/routes/events.js` |
| **Rich Querying** | `$or`, `$regex` (case-insensitive), `$gte` / `$lt` (date & points ranges), array element match `{ skills: 'MongoDB' }` | Search & filter bars across all pages |
| **Pagination & Distinct Values** | `distinct('category')`, `distinct('skills')`, `countDocuments()`, `$skip`, `$limit`, `$sort` | `communities.js`, `members.js` |
| **Aggregation Pipelines** | `$unwind`, `$group` (`$sum`, `$avg`, `$max`), `$project`, `$addFields`, multi-`$lookup` computed score | `src/routes/analytics.js`, `src/server.js` |
| **Indexing** | Single-field, compound (`{ communityId: 1, pinned: -1, createdAt: -1 }`), and multikey array (`{ skills: 1 }`) via `createIndex()` & `indexes()` | `src/config/db.js`, `src/routes/analytics.js` |

---

## 4. Document Shapes (4 Collections)

```js
// 1. communities
{
  _id, name, description, category, location,
  tags: ["web-dev", "mongodb"],
  contact: { leadEmail, website, meetFrequency: "Weekly" | "Bi-weekly" | "Monthly" | "Ad-hoc" },
  views: 148,
  featured: true,
  createdAt, updatedAt
}

// 2. members  (communityId -> communities._id)
{
  _id, name, email,
  role: "member" | "moderator" | "admin",
  bio,
  skills: ["MongoDB", "Node.js", "JavaScript"],
  points: 95,
  communityId, joinedAt, createdAt, updatedAt
}

// 3. events   (communityId -> communities._id)
{
  _id, title, description, date, location,
  mode: "In-Person" | "Online" | "Hybrid",
  capacity: 30,
  tags: ["workshop", "mongodb"],
  rsvps: [{ memberId, memberName, memberRole, rsvpAt }],
  communityId, createdAt, updatedAt
}

// 4. announcements  (communityId -> communities._id)
{
  _id, title, body, authorName,
  communityId,
  pinned: true,
  likes: 14,
  createdAt, updatedAt
}
```
