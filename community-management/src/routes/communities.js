/**
 * Routes for COMMUNITIES.
 *
 * MongoDB operations demonstrated here:
 *   - aggregate() with $match, $lookup, $project ($size, $ifNull), $sort
 *   - distinct() for dynamic category & city filter options
 *   - $or + $regex for multi-field search (name, description, location, tags)
 *   - Dot-notation query on embedded subdocument ('contact.meetFrequency')
 *   - Atomic counter increment via updateOne({ _id }, { $inc: { views: 1 } })
 *   - Cascading delete across related collections (deleteOne + deleteMany)
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');
const { escapeRegex, parseCsvList } = require('../utils/format');

const router = express.Router();
const communities = () => getDB().collection('communities');
const members = () => getDB().collection('members');
const events = () => getDB().collection('events');
const announcements = () => getDB().collection('announcements');

const CATEGORIES = [
  'Technology',
  'Design',
  'Sports',
  'Education',
  'Business',
  'Music',
  'Arts',
  'Other',
];

const FREQUENCIES = ['Weekly', 'Bi-weekly', 'Monthly', 'Ad-hoc'];

/* ---------------------------------------------------------------- READ ---- */

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const selectedCategory = (req.query.category || '').trim();
    const selectedLocation = (req.query.location || '').trim();
    const selectedFrequency = (req.query.frequency || '').trim();
    const sortBy = (req.query.sort || 'featured').trim();

    const filter = {};
    if (selectedCategory) filter.category = selectedCategory;
    if (selectedLocation) filter.location = selectedLocation;
    if (selectedFrequency) {
      // Dot-notation query inside embedded subdocument `contact`
      filter['contact.meetFrequency'] = selectedFrequency;
    }
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [
        { name: rx },
        { description: rx },
        { location: rx },
        { tags: rx },
      ];
    }

    const sortStage =
      sortBy === 'newest'
        ? { createdAt: -1 }
        : sortBy === 'members'
        ? { memberCount: -1, name: 1 }
        : sortBy === 'views'
        ? { views: -1, name: 1 }
        : sortBy === 'name'
        ? { name: 1 }
        : { featured: -1, memberCount: -1, name: 1 };

    const [list, distinctCategories, distinctLocations] = await Promise.all([
      communities()
        .aggregate([
          { $match: filter },
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
              tags: { $ifNull: ['$tags', []] },
              contact: { $ifNull: ['$contact', {}] },
              views: { $ifNull: ['$views', 0] },
              featured: { $ifNull: ['$featured', false] },
              createdAt: 1,
              memberCount: { $size: '$members' },
              eventCount: { $size: '$events' },
            },
          },
          { $sort: sortStage },
        ])
        .toArray(),
      communities().distinct('category'),
      communities().distinct('location'),
    ]);

    res.render('communities/index', {
      title: 'Communities',
      communities: list,
      distinctCategories: distinctCategories.sort(),
      distinctLocations: distinctLocations.sort(),
      frequencies: FREQUENCIES,
      filters: {
        q,
        category: selectedCategory,
        location: selectedLocation,
        frequency: selectedFrequency,
        sort: sortBy,
      },
    });
  } catch (err) {
    next(err);
  }
});

// CREATE form
router.get('/new', (req, res) => {
  res.render('communities/new', {
    title: 'New community',
    categories: CATEGORIES,
    frequencies: FREQUENCIES,
  });
});

// READ (one) - increments `views` atomically via $inc, then loads hub data
router.get('/:id', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const existing = await communities().findOne({ _id });
    if (!existing) return res.status(404).render('404', { title: 'Not found' });

    // Atomic MongoDB counter increment ($inc)
    await communities().updateOne({ _id }, { $inc: { views: 1 } });

    const [community, communityMembers, communityEvents, communityAnnouncements] =
      await Promise.all([
        communities().findOne({ _id }),
        members().find({ communityId: _id }).sort({ points: -1, name: 1 }).toArray(),
        events().find({ communityId: _id }).sort({ date: 1 }).toArray(),
        announcements()
          .find({ communityId: _id })
          .sort({ pinned: -1, createdAt: -1 })
          .toArray(),
      ]);

    res.render('communities/show', {
      title: community.name,
      community,
      communityMembers,
      communityEvents,
      communityAnnouncements,
      today: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- CREATE ---- */

router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      location,
      tags,
      leadEmail,
      website,
      meetFrequency,
      featured,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).render('communities/new', {
        title: 'New community',
        categories: CATEGORIES,
        frequencies: FREQUENCIES,
        error: 'Community name is required.',
        values: req.body,
      });
    }

    const duplicate = await communities().findOne({
      name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' },
    });
    if (duplicate) {
      return res.status(400).render('communities/new', {
        title: 'New community',
        categories: CATEGORIES,
        frequencies: FREQUENCIES,
        error: `"${name.trim()}" already exists.`,
        values: req.body,
      });
    }

    const now = new Date();
    const doc = {
      name: name.trim(),
      description: (description || '').trim(),
      category: CATEGORIES.includes(category) ? category : 'Other',
      location: (location || '').trim(),
      tags: parseCsvList(tags, { lower: true }),
      contact: {
        leadEmail: (leadEmail || '').trim().toLowerCase(),
        website: (website || '').trim(),
        meetFrequency: FREQUENCIES.includes(meetFrequency) ? meetFrequency : 'Monthly',
      },
      views: 0,
      featured: featured === 'on' || featured === 'true',
      createdAt: now,
      updatedAt: now,
    };

    const result = await communities().insertOne(doc);
    res.redirect(`/communities/${result.insertedId}?created=1`);
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
      frequencies: FREQUENCIES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const {
      name,
      description,
      category,
      location,
      tags,
      leadEmail,
      website,
      meetFrequency,
      featured,
    } = req.body;

    if (!name || !name.trim()) {
      const current = await communities().findOne({ _id });
      return res.status(400).render('communities/edit', {
        title: 'Edit community',
        community: { ...current, ...req.body },
        categories: CATEGORIES,
        frequencies: FREQUENCIES,
        error: 'Community name is required.',
      });
    }

    await communities().updateOne(
      { _id },
      {
        $set: {
          name: name.trim(),
          description: (description || '').trim(),
          category: CATEGORIES.includes(category) ? category : 'Other',
          location: (location || '').trim(),
          tags: parseCsvList(tags, { lower: true }),
          contact: {
            leadEmail: (leadEmail || '').trim().toLowerCase(),
            website: (website || '').trim(),
            meetFrequency: FREQUENCIES.includes(meetFrequency) ? meetFrequency : 'Monthly',
          },
          featured: featured === 'on' || featured === 'true',
          updatedAt: new Date(),
        },
      }
    );

    res.redirect(`/communities/${_id}?updated=1`);
  } catch (err) {
    next(err);
  }
});

// Toggle featured status ($set boolean)
router.post('/:id/feature', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const community = await communities().findOne({ _id });
    if (!community) return res.status(404).render('404', { title: 'Not found' });

    await communities().updateOne(
      { _id },
      { $set: { featured: !community.featured, updatedAt: new Date() } }
    );

    res.redirect(`/communities/${_id}?updated=1`);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- DELETE ---- */

router.post('/:id/delete', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    // Cascade delete the community and its related documents
    await Promise.all([
      communities().deleteOne({ _id }),
      members().deleteMany({ communityId: _id }),
      events().deleteMany({ communityId: _id }),
      announcements().deleteMany({ communityId: _id }),
    ]);

    res.redirect('/communities?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
