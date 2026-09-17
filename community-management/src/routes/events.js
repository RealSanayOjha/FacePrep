/**
 * CRUD routes for EVENTS.
 * An event always belongs to a community (communityId).
 *
 *   GET   /events              list all
 *   GET   /events/new          form to create
 *   POST  /events              create
 *   GET   /events/:id/edit     form to update
 *   POST  /events/:id/update   update
 *   POST  /events/:id/delete   delete
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');

const router = express.Router();
const events = () => getDB().collection('events');
const communities = () => getDB().collection('communities');

/* ---------------------------------------------------------------- READ ---- */

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.community) {
      const communityId = toObjectId(req.query.community);
      if (communityId) filter.communityId = communityId;
    }

    const list = await events()
      .aggregate([
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
        { $sort: { date: 1 } },
      ])
      .toArray();

    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();

    res.render('events/index', {
      title: 'Events',
      events: list,
      allCommunities,
      selectedCommunity: req.query.community || '',
      today: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

// CREATE form
router.get('/new', async (req, res, next) => {
  try {
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    res.render('events/new', {
      title: 'New event',
      allCommunities,
      preselected: req.query.community || '',
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- CREATE ---- */

router.post('/', async (req, res, next) => {
  try {
    const { title, description, date, location, communityId } = req.body;

    const renderError = (message) =>
      communities()
        .find({})
        .sort({ name: 1 })
        .toArray()
        .then((allCommunities) =>
          res.status(400).render('events/new', {
            title: 'New event',
            allCommunities,
            preselected: communityId || '',
            error: message,
            values: req.body,
          })
        );

    if (!title || !title.trim()) return renderError('Event title is required.');
    if (!communityId) return renderError('Please pick a community.');

    const _communityId = toObjectId(communityId);
    if (!_communityId) return renderError('That community is not valid.');

    const parsedDate = date ? new Date(date) : null;

    const doc = {
      title: title.trim(),
      description: (description || '').trim(),
      date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
      location: (location || '').trim(),
      communityId: _communityId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await events().insertOne(doc);
    res.redirect('/events');
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
    res.render('events/edit', { title: `Edit ${event.title}`, event, allCommunities });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const { title, description, date, location, communityId } = req.body;
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    const event = { ...(await events().findOne({ _id })), ...req.body };

    if (!title || !title.trim()) {
      return res.status(400).render('events/edit', {
        title: 'Edit event',
        event,
        allCommunities,
        error: 'Event title is required.',
      });
    }
    if (!communityId) {
      return res.status(400).render('events/edit', {
        title: 'Edit event',
        event,
        allCommunities,
        error: 'Please pick a community.',
      });
    }

    const _communityId = toObjectId(communityId);
    if (!_communityId) {
      return res.status(400).render('events/edit', {
        title: 'Edit event',
        event,
        allCommunities,
        error: 'That community is not valid.',
      });
    }

    const parsedDate = date ? new Date(date) : null;

    await events().updateOne(
      { _id },
      {
        $set: {
          title: title.trim(),
          description: (description || '').trim(),
          date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
          location: (location || '').trim(),
          communityId: _communityId,
          updatedAt: new Date(),
        },
      }
    );

    res.redirect('/events?updated=1');
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
