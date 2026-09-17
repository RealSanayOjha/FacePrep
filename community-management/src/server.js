/**
 * Community Management - basic CRUD app.
 *
 * Collections: communities, members, events
 * Every collection supports Create / Read / Update / Delete.
 */
require('dotenv').config();

const path = require('path');
const express = require('express');

const { connectDB, getDB } = require('./config/db');
const communitiesRoutes = require('./routes/communities');
const membersRoutes = require('./routes/members');
const eventsRoutes = require('./routes/events');
const { formatDate, toDateInput } = require('./utils/format');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- view engine + static files -------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- body parsing (HTML forms + JSON) -------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---- helpers available inside every view ----------------------------------
app.use((req, res, next) => {
  res.locals.formatDate = formatDate;
  res.locals.toDateInput = toDateInput;
  res.locals.currentPath = req.path;
  res.locals.query = req.query; // used for the small "Saved!" / "Deleted!" banners
  next();
});

// ---- routes ---------------------------------------------------------------
// Dashboard: counts + the next 5 events
app.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const [communityCount, memberCount, eventCount] = await Promise.all([
      db.collection('communities').countDocuments(),
      db.collection('members').countDocuments(),
      db.collection('events').countDocuments(),
    ]);

    const upcoming = await db
      .collection('events')
      .aggregate([
        { $match: { date: { $gte: new Date() } } },
        {
          $lookup: {
            from: 'communities',
            localField: 'communityId',
            foreignField: '_id',
            as: 'community',
          },
        },
        { $unwind: { path: '$community', preserveNullAndEmptyArrays: true } },
        { $sort: { date: 1 } },
        { $limit: 5 },
      ])
      .toArray();

    res.render('home', {
      title: 'Dashboard',
      counts: { communities: communityCount, members: memberCount, events: eventCount },
      upcoming,
    });
  } catch (err) {
    next(err);
  }
});
app.use('/communities', communitiesRoutes);
app.use('/members', membersRoutes);
app.use('/events', eventsRoutes);

// ---- 404 + error handling -------------------------------------------------
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', error: err });
});

// ---- start ----------------------------------------------------------------
async function main() {
  await connectDB(); // if this fails we never start the server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Community Management running at http://localhost:${PORT}\n`);
  });
}

main().catch((err) => {
  console.error('\n[startup failed] ' + err.message + '\n');
  process.exit(1);
});
