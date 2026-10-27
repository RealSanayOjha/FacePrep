/**
 * Routes for INSIGHTS & MONGODB EXPLORER (/analytics).
 *
 * Showcases MongoDB's Aggregation Framework & Index Inspection in one place:
 *   1. Category Breakdown:        $group ($sum communities, $sum views)
 *   2. Top Skills Across Network: $unwind('$skills') -> $group -> $sort -> $limit
 *   3. Engagement by Role:        $group ($sum, $avg points, $max points)
 *   4. Community Leaderboard:     multi-collection $lookup + computed $project score
 *   5. Event Formats & RSVPs:     $project ($size of rsvps) -> $group by mode
 *   6. Active Indexes:            db.collection(name).indexes()
 */
const express = require('express');
const { getDB, getConnectionInfo } = require('../config/db');
const { seedDatabase } = require('../utils/seedData');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const db = getDB();

    const [
      communityCount,
      memberCount,
      eventCount,
      announcementCount,
      categoryStats,
      topSkills,
      roleStats,
      leaderboard,
      eventModeStats,
      communityIndexes,
      memberIndexes,
      eventIndexes,
      announcementIndexes,
    ] = await Promise.all([
      db.collection('communities').countDocuments(),
      db.collection('members').countDocuments(),
      db.collection('events').countDocuments(),
      db.collection('announcements').countDocuments(),

      // 1. $group communities by category
      db
        .collection('communities')
        .aggregate([
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 },
              totalViews: { $sum: { $ifNull: ['$views', 0] } },
            },
          },
          { $sort: { count: -1, totalViews: -1 } },
        ])
        .toArray(),

      // 2. $unwind array field `skills`, then $group to count occurrences
      db
        .collection('members')
        .aggregate([
          { $unwind: '$skills' },
          { $group: { _id: '$skills', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 10 },
        ])
        .toArray(),

      // 3. $group members by role with $sum, $avg, and $max
      db
        .collection('members')
        .aggregate([
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 },
              avgPoints: { $avg: { $ifNull: ['$points', 0] } },
              maxPoints: { $max: { $ifNull: ['$points', 0] } },
              totalPoints: { $sum: { $ifNull: ['$points', 0] } },
            },
          },
          { $sort: { avgPoints: -1 } },
        ])
        .toArray(),

      // 4. Multi-$lookup leaderboard with computed activity score
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
            $lookup: {
              from: 'announcements',
              localField: '_id',
              foreignField: 'communityId',
              as: 'announcements',
            },
          },
          {
            $project: {
              name: 1,
              category: 1,
              location: 1,
              views: { $ifNull: ['$views', 0] },
              memberCount: { $size: '$members' },
              eventCount: { $size: '$events' },
              announcementCount: { $size: '$announcements' },
              activityScore: {
                $add: [
                  { $multiply: [{ $size: '$members' }, 5] },
                  { $multiply: [{ $size: '$events' }, 10] },
                  { $multiply: [{ $size: '$announcements' }, 4] },
                  { $ifNull: ['$views', 0] },
                ],
              },
            },
          },
          { $sort: { activityScore: -1 } },
        ])
        .toArray(),

      // 5. Event mode breakdown & RSVP utilization
      db
        .collection('events')
        .aggregate([
          {
            $project: {
              mode: { $ifNull: ['$mode', 'In-Person'] },
              capacity: { $ifNull: ['$capacity', 0] },
              rsvpCount: { $size: { $ifNull: ['$rsvps', []] } },
            },
          },
          {
            $group: {
              _id: '$mode',
              events: { $sum: 1 },
              totalCapacity: { $sum: '$capacity' },
              totalRsvps: { $sum: '$rsvpCount' },
            },
          },
          { $sort: { events: -1 } },
        ])
        .toArray(),

      // 6. Inspect active MongoDB indexes on each collection
      db.collection('communities').indexes(),
      db.collection('members').indexes(),
      db.collection('events').indexes(),
      db.collection('announcements').indexes(),
    ]);

    res.render('analytics/index', {
      title: 'Insights & MongoDB',
      connectionInfo: getConnectionInfo(),
      counts: {
        communities: communityCount,
        members: memberCount,
        events: eventCount,
        announcements: announcementCount,
      },
      categoryStats,
      topSkills,
      roleStats,
      leaderboard,
      eventModeStats,
      indexesByCollection: [
        { collection: 'communities', count: communityCount, indexes: communityIndexes },
        { collection: 'members', count: memberCount, indexes: memberIndexes },
        { collection: 'events', count: eventCount, indexes: eventIndexes },
        { collection: 'announcements', count: announcementCount, indexes: announcementIndexes },
      ],
    });
  } catch (err) {
    next(err);
  }
});

// Reset sample dataset on demand during demos
router.post('/reseed', async (req, res, next) => {
  try {
    const db = getDB();
    await seedDatabase(db);
    res.redirect('/analytics?reseeded=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
