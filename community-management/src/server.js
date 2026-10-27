/**
 * Community Management System - Node.js + Express + MongoDB.
 *
 * Collections:
 *   - communities    (hubs with embedded contact info, tags, atomic view counters)
 *   - members        (profiles with skills arrays, contribution points, roles)
 *   - events         (gatherings with capacity & embedded RSVP subdocuments)
 *   - announcements  (pinned & upvoted community updates)
 */
require('dotenv').config();

const path = require('path');
const express = require('express');

const { connectDB, getDB, getConnectionInfo } = require('./config/db');
const communitiesRoutes = require('./routes/communities');
const membersRoutes = require('./routes/members');
const eventsRoutes = require('./routes/events');
const announcementsRoutes = require('./routes/announcements');
const analyticsRoutes = require('./routes/analytics');
const { seedDatabase } = require('./utils/seedData');
const {
  formatDate,
  formatMonthShort,
  formatDayNum,
  formatRelativeDate,
  toDateInput,
  initials,
  escapeRegex,
} = require('./utils/format');

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
  res.locals.formatMonthShort = formatMonthShort;
  res.locals.formatDayNum = formatDayNum;
  res.locals.formatRelativeDate = formatRelativeDate;
  res.locals.toDateInput = toDateInput;
  res.locals.initials = initials;
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.originalUrl;
  res.locals.query = req.query;
  res.locals.dbInfo = getConnectionInfo();
  next();
});

// ---- Dashboard ------------------------------------------------------------
app.get('/', async (req, res, next) => {
  try {
    const db = getDB();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      communityCount,
      memberCount,
      upcomingEventCount,
      announcementCount,
      upcoming,
      featuredCommunities,
      recentAnnouncements,
      topSkills,
      rsvpSummary,
    ] = await Promise.all([
      db.collection('communities').countDocuments(),
      db.collection('members').countDocuments(),
      db.collection('events').countDocuments({ date: { $gte: startOfToday } }),
      db.collection('announcements').countDocuments(),

      // Next 4 upcoming events joined with their host community
      db
        .collection('events')
        .aggregate([
          { $match: { date: { $gte: startOfToday } } },
          {
            $lookup: {
              from: 'communities',
              localField: 'communityId',
              foreignField: '_id',
              as: 'community',
            },
          },
          { $unwind: { path: '$community', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              rsvpCount: { $size: { $ifNull: ['$rsvps', []] } },
              capacity: { $ifNull: ['$capacity', 0] },
              mode: { $ifNull: ['$mode', 'In-Person'] },
            },
          },
          { $sort: { date: 1 } },
          { $limit: 4 },
        ])
        .toArray(),

      // Highlighted communities with live member & event counts
      db
        .collection('communities')
        .aggregate([
          {
            $lookup: {
              from: 'members',
              localField: '_id',
              foreignField: 'communityId',
              as: 'members',
            },
          },
          {
            $lookup: {
              from: 'events',
              localField: '_id',
              foreignField: 'communityId',
              as: 'events',
            },
          },
          {
            $project: {
              name: 1,
              description: 1,
              category: 1,
              location: 1,
              featured: { $ifNull: ['$featured', false] },
              views: { $ifNull: ['$views', 0] },
              tags: { $ifNull: ['$tags', []] },
              memberCount: { $size: '$members' },
              eventCount: { $size: '$events' },
            },
          },
          { $sort: { featured: -1, memberCount: -1, views: -1 } },
          { $limit: 3 },
        ])
        .toArray(),

      // Pinned & latest announcements
      db
        .collection('announcements')
        .aggregate([
          {
            $lookup: {
              from: 'communities',
              localField: 'communityId',
              foreignField: '_id',
              as: 'community',
            },
          },
          { $unwind: { path: '$community', preserveNullAndEmptyArrays: true } },
          { $sort: { pinned: -1, createdAt: -1 } },
          { $limit: 3 },
        ])
        .toArray(),

      // Top skills across all members ($unwind + $group)
      db
        .collection('members')
        .aggregate([
          { $unwind: '$skills' },
          { $group: { _id: '$skills', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 8 },
        ])
        .toArray(),

      // Total RSVPs across events
      db
        .collection('events')
        .aggregate([
          { $project: { rsvpCount: { $size: { $ifNull: ['$rsvps', []] } } } },
          { $group: { _id: null, totalRsvps: { $sum: '$rsvpCount' } } },
        ])
        .toArray(),
    ]);

    const totalRsvps = rsvpSummary[0] ? rsvpSummary[0].totalRsvps : 0;

    res.render('home', {
      title: 'Dashboard',
      counts: {
        communities: communityCount,
        members: memberCount,
        upcomingEvents: upcomingEventCount,
        announcements: announcementCount,
        totalRsvps,
      },
      upcoming,
      featuredCommunities,
      recentAnnouncements,
      topSkills,
    });
  } catch (err) {
    next(err);
  }
});

// ---- Global Search across all 4 collections ($or + $regex) ----------------
app.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const db = getDB();

    if (!q) {
      return res.render('search', {
        title: 'Search',
        q: '',
        results: { communities: [], events: [], members: [], announcements: [] },
        totalMatches: 0,
      });
    }

    const rx = { $regex: escapeRegex(q), $options: 'i' };

    const [foundCommunities, foundEvents, foundMembers, foundAnnouncements] =
      await Promise.all([
        db
          .collection('communities')
          .find({
            $or: [{ name: rx }, { description: rx }, { category: rx }, { location: rx }, { tags: rx }],
          })
          .sort({ name: 1 })
          .limit(10)
          .toArray(),

        db
          .collection('events')
          .aggregate([
            {
              $match: {
                $or: [{ title: rx }, { description: rx }, { location: rx }, { tags: rx }],
              },
            },
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
            { $limit: 10 },
          ])
          .toArray(),

        db
          .collection('members')
          .aggregate([
            {
              $match: {
                $or: [{ name: rx }, { email: rx }, { bio: rx }, { skills: rx }],
              },
            },
            {
              $lookup: {
                from: 'communities',
                localField: 'communityId',
                foreignField: '_id',
                as: 'community',
              },
            },
            { $unwind: { path: '$community', preserveNullAndEmptyArrays: true } },
            { $sort: { name: 1 } },
            { $limit: 10 },
          ])
          .toArray(),

        db
          .collection('announcements')
          .aggregate([
            {
              $match: {
                $or: [{ title: rx }, { body: rx }, { authorName: rx }],
              },
            },
            {
              $lookup: {
                from: 'communities',
                localField: 'communityId',
                foreignField: '_id',
                as: 'community',
              },
            },
            { $unwind: { path: '$community', preserveNullAndEmptyArrays: true } },
            { $sort: { pinned: -1, createdAt: -1 } },
            { $limit: 10 },
          ])
          .toArray(),
      ]);

    const totalMatches =
      foundCommunities.length +
      foundEvents.length +
      foundMembers.length +
      foundAnnouncements.length;

    res.render('search', {
      title: `Search: ${q}`,
      q,
      results: {
        communities: foundCommunities,
        events: foundEvents,
        members: foundMembers,
        announcements: foundAnnouncements,
      },
      totalMatches,
    });
  } catch (err) {
    next(err);
  }
});

// ---- Resource Routes ------------------------------------------------------
app.use('/communities', communitiesRoutes);
app.use('/members', membersRoutes);
app.use('/events', eventsRoutes);
app.use('/announcements', announcementsRoutes);
app.use('/analytics', analyticsRoutes);

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
  const db = await connectDB();

  // In memory-demo mode, auto-populate sample data if the database is empty
  if (getConnectionInfo().mode === 'memory') {
    const existing = await db.collection('communities').countDocuments();
    if (existing === 0) {
      await seedDatabase(db);
      console.log('Auto-seeded sample data for in-memory demo mode.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Community Management running at http://localhost:${PORT}\n`);
  });
}

main().catch((err) => {
  console.error('\n[startup failed] ' + err.message + '\n');
  process.exit(1);
});
