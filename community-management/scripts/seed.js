/**
 * Fills the database with sample data so the screens are not empty.
 *
 *   npm run seed
 *
 * NOTE: this clears the three collections first, then inserts the samples.
 */
require('dotenv').config();

const { connectDB, getDB, ObjectId } = require('../src/config/db');

async function seed() {
  await connectDB();
  const db = getDB();

  console.log('Clearing existing data...');
  await db.collection('members').deleteMany({});
  await db.collection('events').deleteMany({});
  await db.collection('communities').deleteMany({});

  const now = new Date();
  const inDays = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const ago = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // ---- CREATE: communities ------------------------------------------------
  const communityDocs = [
    {
      _id: new ObjectId(),
      name: 'Poornima Coding Club',
      description: 'Students learning web development, DSA and open source together.',
      category: 'Technology',
      location: 'Jaipur',
      createdAt: ago(120),
      updatedAt: ago(120),
    },
    {
      _id: new ObjectId(),
      name: 'Jaipur Runners',
      description: 'Weekend running group - 5K, 10K and marathon training.',
      category: 'Sports',
      location: 'Jaipur',
      createdAt: ago(60),
      updatedAt: ago(60),
    },
    {
      _id: new ObjectId(),
      name: 'Local Business Network',
      description: 'Monthly meetup for small business owners and freelancers.',
      category: 'Business',
      location: 'Jaipur',
      createdAt: ago(30),
      updatedAt: ago(30),
    },
  ];

  await db.collection('communities').insertMany(communityDocs);
  console.log(`Inserted ${communityDocs.length} communities`);

  const [coding, runners, business] = communityDocs;

  // ---- CREATE: members ----------------------------------------------------
  const memberDocs = [
    { name: 'Sanay Ojha', email: 'sanay@example.com', role: 'admin', communityId: coding._id, joinedAt: ago(118), createdAt: ago(118), updatedAt: ago(118) },
    { name: 'Aarav Sharma', email: 'aarav@example.com', role: 'member', communityId: coding._id, joinedAt: ago(90), createdAt: ago(90), updatedAt: ago(90) },
    { name: 'Diya Verma', email: 'diya@example.com', role: 'moderator', communityId: coding._id, joinedAt: ago(45), createdAt: ago(45), updatedAt: ago(45) },
    { name: 'Kabir Singh', email: 'kabir@example.com', role: 'member', communityId: runners._id, joinedAt: ago(58), createdAt: ago(58), updatedAt: ago(58) },
    { name: 'Ishita Jain', email: 'ishita@example.com', role: 'admin', communityId: runners._id, joinedAt: ago(20), createdAt: ago(20), updatedAt: ago(20) },
    { name: 'Rohan Mehta', email: 'rohan@example.com', role: 'member', communityId: business._id, joinedAt: ago(10), createdAt: ago(10), updatedAt: ago(10) },
  ];

  await db.collection('members').insertMany(memberDocs);
  console.log(`Inserted ${memberDocs.length} members`);

  // ---- CREATE: events -----------------------------------------------------
  const eventDocs = [
    { title: 'MongoDB Basics Workshop', description: 'Hands-on session on CRUD with MongoDB.', date: inDays(7), location: 'Lab 3, Poornima College', communityId: coding._id, createdAt: now, updatedAt: now },
    { title: 'Open Source Saturday', description: 'Pick your first good-first-issue.', date: inDays(21), location: 'Online (Google Meet)', communityId: coding._id, createdAt: now, updatedAt: now },
    { title: 'Sunrise 5K Run', description: 'Easy pace run followed by breakfast.', date: inDays(3), location: 'Central Park', communityId: runners._id, createdAt: now, updatedAt: now },
    { title: 'Founders Coffee Meetup', description: 'Informal networking over coffee.', date: inDays(14), location: 'Cafe Coffee Day, MI Road', communityId: business._id, createdAt: now, updatedAt: now },
  ];

  await db.collection('events').insertMany(eventDocs);
  console.log(`Inserted ${eventDocs.length} events`);

  console.log('\nSeed complete. Start the app with:  npm start\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n[seed failed] ' + err.message + '\n');
  process.exit(1);
});
