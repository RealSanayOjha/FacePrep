/**
 * CRUD routes for COMMUNITIES.
 *
 *   GET   /communities              list all
 *   GET   /communities/new          form to create
 *   POST  /communities              create
 *   GET   /communities/:id          details of one community
 *   GET   /communities/:id/edit     form to update
 *   POST  /communities/:id/update   update
 *   POST  /communities/:id/delete   delete
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');

const router = express.Router();
const communities = () => getDB().collection('communities');
const members = () => getDB().collection('members');
const events = () => getDB().collection('events');

const CATEGORIES = ['Technology', 'Sports', 'Music', 'Education', 'Business', 'Other'];

/* ---------------------------------------------------------------- READ ---- */

// READ (all)  - with the number of members and events in each community
router.get('/', async (req, res, next) => {
  try {
    const list = await communities()
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
            createdAt: 1,
            memberCount: { $size: '$members' },
            eventCount: { $size: '$events' },
          },
        },
        { $sort: { name: 1 } },
      ])
      .toArray();

    res.render('communities/index', { title: 'Communities', communities: list });
  } catch (err) {
    next(err);
  }
});

// CREATE form
router.get('/new', (req, res) => {
  res.render('communities/new', { title: 'New community', categories: CATEGORIES });
});

// READ (one) - community details + its members + its events
router.get('/:id', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const community = await communities().findOne({ _id });
    if (!community) return res.status(404).render('404', { title: 'Not found' });

    const communityMembers = await members()
      .find({ communityId: _id })
      .sort({ name: 1 })
      .toArray();

    const communityEvents = await events()
      .find({ communityId: _id })
      .sort({ date: 1 })
      .toArray();

    res.render('communities/show', {
      title: community.name,
      community,
      communityMembers,
      communityEvents,
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- CREATE ---- */

router.post('/', async (req, res, next) => {
  try {
    const { name, description, category, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).render('communities/new', {
        title: 'New community',
        categories: CATEGORIES,
        error: 'Community name is required.',
        values: req.body,
      });
    }

    const existing = await communities().findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
    });
    if (existing) {
      return res.status(400).render('communities/new', {
        title: 'New community',
        categories: CATEGORIES,
        error: `"${name.trim()}" already exists.`,
        values: req.body,
      });
    }

    const doc = {
      name: name.trim(),
      description: (description || '').trim(),
      category: category || 'Other',
      location: (location || '').trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await communities().insertOne(doc);
    res.redirect(`/communities/${result.insertedId}`);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- UPDATE ---- */

router.get('/:id/edit', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const community = await communities().findOne({ _id });
    if (!community) return res.status(404).render('404', { title: 'Not found' });

    res.render('communities/edit', {
      title: `Edit ${community.name}`,
      community,
      categories: CATEGORIES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const { name, description, category, location } = req.body;

    if (!name || !name.trim()) {
      const community = await communities().findOne({ _id });
      return res.status(400).render('communities/edit', {
        title: 'Edit community',
        community: { ...community, ...req.body },
        categories: CATEGORIES,
        error: 'Community name is required.',
      });
    }

    await communities().updateOne(
      { _id },
      {
        $set: {
          name: name.trim(),
          description: (description || '').trim(),
          category: category || 'Other',
          location: (location || '').trim(),
          updatedAt: new Date(),
        },
      }
    );

    res.redirect(`/communities/${_id}`);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- DELETE ---- */

router.post('/:id/delete', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    // Delete the community and everything that belonged to it.
    await communities().deleteOne({ _id });
    await members().deleteMany({ communityId: _id });
    await events().deleteMany({ communityId: _id });

    res.redirect('/communities?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
