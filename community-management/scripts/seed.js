/**
 * Fills the database with sample data so the screens are rich and ready to explore.
 *
 *   npm run seed
 *
 * NOTE: this clears the four collections first, then inserts the sample set.
 */
require('dotenv').config();

const { connectDB, getDB } = require('../src/config/db');
const { seedDatabase } = require('../src/utils/seedData');

async function seed() {
  await connectDB();
  const db = getDB();

  console.log('Clearing existing data and inserting sample documents...');
  const counts = await seedDatabase(db);

  console.log(`Inserted ${counts.communities} communities`);
  console.log(`Inserted ${counts.members} members`);
  console.log(`Inserted ${counts.events} events`);
  console.log(`Inserted ${counts.announcements} announcements`);
  console.log('\nSeed complete. Start the app with:  npm start\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n[seed failed] ' + err.message + '\n');
  process.exit(1);
});
