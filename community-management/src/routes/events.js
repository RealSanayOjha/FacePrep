/**
 * Routes for EVENTS & EVENT RSVPs.
 *
 * MongoDB operations demonstrated here:
 *   - Date range queries ($gte / $lt) for Upcoming vs Past events
 *   - Multi-field $or + $regex search and mode filtering
 *   - $lookup + $unwind join with communities + $addFields ($size of rsvps)
 *   - Embedded subdocument array management:
 *       * $push with duplicate guard ('rsvps.memberId': { $ne: memberId })
 *       * $pull to cancel an RSVP ({ $pull: { rsvps: { memberId } } })
 *   - Cross-collection reward: $inc +2 points on member upon RSVP
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');
const { escapeRegex, parseCsvList } = require('../utils/format');

const router = express.Router();
const events = () => getDB().collection('events');
const communities = () => getDB().collection('communities');
const members = () => getDB().collection('members');

const MODES = ['In-Person', 'Online', 'Hybrid'];

/* ---------------------------------------------------------------- READ ---- */

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const selectedCommunity = (req.query.community || '').trim();
    const selectedStatus = (req.query.status || 'all').trim();
    const selectedMode = (req.query.mode || '').trim();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const filter = {};
    if (selectedCommunity) {
      const communityId = toObjectId(selectedCommunity);
      if (communityId) filter.communityId = communityId;
    }
    if (selectedMode && MODES.includes(selectedMode)) {
      filter.mode = selectedMode;
    }
    if (selectedStatus === 'upcoming' || selectedStatus === 'open') {
      filter.date = { $gte: startOfToday };
    } else if (selectedStatus === 'past') {
      filter.date = { $lt: startOfToday };
    }
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [{ title: rx }, { description: rx }, { location: rx }, { tags: rx }];
    }

    const pipeline = [
      { $match: filter },
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
          rsvps: { $ifNull: ['$rsvps', []] },
          capacity: { $ifNull: ['$capacity', 0] },
          mode: { $ifNull: ['$mode', 'In-Person'] },
          tags: { $ifNull: ['$tags', []] },
          rsvpCount: { $size: { $ifNull: ['$rsvps', []] } },
        },
      },
      { $sort: selectedStatus === 'past' ? { date: -1 } : { date: 1 } },
    ];

    let list = await events().aggregate(pipeline).toArray();

    // Filter for events that still have open capacity
    if (selectedStatus === 'open') {
      list = list.filter((e) => !e.capacity || e.rsvpCount < e.capacity);
    }

    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();

    res.render('events/index', {
      title: 'Events',
      events: list,
      allCommunities,
      modes: MODES,
      filters: {
        q,
        community: selectedCommunity,
        status: selectedStatus,
        mode: selectedMode,
      },
      today: startOfToday,
    });
  } catch (err) {
    next(err);
  }
});

// CREATE form (must appear before /:id)
router.get('/new', async (req, res, next) => {
  try {
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    res.render('events/new', {
      title: 'Create event',
      allCommunities,
      modes: MODES,
      preselected: req.query.community || '',
    });
  } catch (err) {
    next(err);
  }
});

// READ (one) - Event detail & interactive RSVP roster
router.get('/:id', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const event = await events().findOne({ _id });
    if (!event) return res.status(404).render('404', { title: 'Not found' });

    const [community, allMembers] = await Promise.all([
      event.communityId ? communities().findOne({ _id: event.communityId }) : null,
      members()
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
          { $sort: { name: 1 } },
        ])
        .toArray(),
    ]);

    const rsvps = Array.isArray(event.rsvps) ? event.rsvps : [];
    const registeredIds = new Set(rsvps.map((r) => String(r.memberId)));

    // Put members from the host community first in the RSVP dropdown
    const eligibleMembers = allMembers
      .filter((m) => !registeredIds.has(String(m._id)))
      .sort((a, b) => {
        const aHost = String(a.communityId) === String(event.communityId) ? 0 : 1;
        const bHost = String(b.communityId) === String(event.communityId) ? 0 : 1;
        if (aHost !== bHost) return aHost - bHost;
        return a.name.localeCompare(b.name);
      });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    res.render('events/show', {
      title: event.title,
      event: {
        ...event,
        rsvps,
        capacity: event.capacity || 0,
        mode: event.mode || 'In-Person',
        tags: event.tags || [],
      },
      community,
      eligibleMembers,
      today: startOfToday,
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- CREATE ---- */

router.post('/', async (req, res, next) => {
  try {
    const { title, description, date, location, mode, capacity, tags, communityId } =
      req.body;

    const renderError = async (message) => {
      const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
      return res.status(400).render('events/new', {
        title: 'Create event',
        allCommunities,
        modes: MODES,
        preselected: communityId || '',
        error: message,
        values: req.body,
      });
    };

    if (!title || !title.trim()) return renderError('Event title is required.');
    if (!communityId) return renderError('Please pick a community.');

    const _communityId = toObjectId(communityId);
    if (!_communityId) return renderError('That community is not valid.');

    const parsedDate = date ? new Date(date) : null;
    const parsedCapacity = Math.max(0, parseInt(capacity, 10) || 0);
    const now = new Date();

    const doc = {
      title: title.trim(),
      description: (description || '').trim(),
      date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
      location: (location || '').trim(),
      mode: MODES.includes(mode) ? mode : 'In-Person',
      capacity: parsedCapacity,
      tags: parseCsvList(tags, { lower: true }),
      rsvps: [],
      communityId: _communityId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await events().insertOne(doc);
    res.redirect(`/events/${result.insertedId}?created=1`);
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------- RSVP OPERATIONS ---- */

// $push subdocument into `rsvps` (with capacity & duplicate checks) + $inc points
router.post('/:id/rsvp', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const memberId = toObjectId(req.body.memberId);
    if (!memberId) return res.redirect(`/events/${_id}?rsvpError=member`);

    const [event, member] = await Promise.all([
      events().findOne({ _id }),
      members().findOne({ _id: memberId }),
    ]);

    if (!event) return res.status(404).render('404', { title: 'Not found' });
    if (!member) return res.redirect(`/events/${_id}?rsvpError=member`);

    const rsvps = Array.isArray(event.rsvps) ? event.rsvps : [];
    if (event.capacity && event.capacity > 0 && rsvps.length >= event.capacity) {
      return res.redirect(`/events/${_id}?rsvpError=full`);
    }

    const updateResult = await events().updateOne(
      { _id, 'rsvps.memberId': { $ne: member._id } },
      {
        $push: {
          rsvps: {
            memberId: member._id,
            memberName: member.name,
            memberRole: member.role || 'member',
            rsvpAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      }
    );

    if (updateResult.modifiedCount > 0) {
      // Reward event registration with +2 contribution points ($inc)
      await members().updateOne({ _id: member._id }, { $inc: { points: 2 } });
    }

    res.redirect(`/events/${_id}?rsvp=1`);
  } catch (err) {
    next(err);
  }
});

// $pull subdocument from `rsvps` by memberId
router.post('/:id/rsvp/cancel', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    const memberId = toObjectId(req.body.memberId);
    if (!_id || !memberId) return res.status(404).render('404', { title: 'Not found' });

    await events().updateOne(
      { _id },
      {
        $pull: { rsvps: { memberId } },
        $set: { updatedAt: new Date() },
      }
    );

    res.redirect(`/events/${_id}?rsvpCancelled=1`);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- UPDATE ---- */

router.get('/:id/edit', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const event = await events().findOne({ _id });
    if (!event) return res.status(404).render('404', { title: 'Not found' });

    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    res.render('events/edit', {
      title: `Edit ${event.title}`,
      event,
      allCommunities,
      modes: MODES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const { title, description, date, location, mode, capacity, tags, communityId } =
      req.body;
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    const existing = await events().findOne({ _id });
    if (!existing) return res.status(404).render('404', { title: 'Not found' });

    const merged = { ...existing, ...req.body, tags: parseCsvList(tags, { lower: true }) };

    if (!title || !title.trim()) {
      return res.status(400).render('events/edit', {
        title: 'Edit event',
        event: merged,
        allCommunities,
        modes: MODES,
        error: 'Event title is required.',
      });
    }
    if (!communityId) {
      return res.status(400).render('events/edit', {
        title: 'Edit event',
        event: merged,
        allCommunities,
        modes: MODES,
        error: 'Please pick a community.',
      });
    }

    const _communityId = toObjectId(communityId);
    if (!_communityId) {
      return res.status(400).render('events/edit', {
        title: 'Edit event',
        event: merged,
        allCommunities,
        modes: MODES,
        error: 'That community is not valid.',
      });
    }

    const parsedDate = date ? new Date(date) : null;
    const parsedCapacity = Math.max(0, parseInt(capacity, 10) || 0);

    await events().updateOne(
      { _id },
      {
        $set: {
          title: title.trim(),
          description: (description || '').trim(),
          date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
          location: (location || '').trim(),
          mode: MODES.includes(mode) ? mode : 'In-Person',
          capacity: parsedCapacity,
          tags: parseCsvList(tags, { lower: true }),
          communityId: _communityId,
          updatedAt: new Date(),
        },
      }
    );

    res.redirect(`/events/${_id}?updated=1`);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- DELETE ---- */

router.post('/:id/delete', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    await events().deleteOne({ _id });
    res.redirect('/events?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
