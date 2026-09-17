/**
 * CRUD routes for MEMBERS.
 * A member always belongs to a community (communityId).
 *
 *   GET   /members              list all
 *   GET   /members/new          form to create
 *   POST  /members              create
 *   GET   /members/:id/edit     form to update
 *   POST  /members/:id/update   update
 *   POST  /members/:id/delete   delete
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');

const router = express.Router();
const members = () => getDB().collection('members');
const communities = () => getDB().collection('communities');

const ROLES = ['member', 'moderator', 'admin'];

/* ---------------------------------------------------------------- READ ---- */

router.get('/', async (req, res, next) => {
  try {
    // Optional filter: /members?community=<id>
    const filter = {};
    if (req.query.community) {
      const communityId = toObjectId(req.query.community);
      if (communityId) filter.communityId = communityId;
    }

    // $lookup joins each member with its community (like a JOIN in SQL)
    const list = await members()
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
        { $sort: { name: 1 } },
      ])
      .toArray();

    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();

    res.render('members/index', {
      title: 'Members',
      members: list,
      allCommunities,
      selectedCommunity: req.query.community || '',
    });
  } catch (err) {
    next(err);
  }
});

// CREATE form
router.get('/new', async (req, res, next) => {
  try {
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    res.render('members/new', {
      title: 'New member',
      allCommunities,
      roles: ROLES,
      preselected: req.query.community || '',
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- CREATE ---- */

router.post('/', async (req, res, next) => {
  try {
    const { name, email, role, communityId } = req.body;

    const renderError = (message) =>
      communities()
        .find({})
        .sort({ name: 1 })
        .toArray()
        .then((allCommunities) =>
          res.status(400).render('members/new', {
            title: 'New member',
            allCommunities,
            roles: ROLES,
            preselected: communityId || '',
            error: message,
            values: req.body,
          })
        );

    if (!name || !name.trim()) return renderError('Member name is required.');
    if (!communityId) return renderError('Please pick a community.');

    const _communityId = toObjectId(communityId);
    if (!_communityId) return renderError('That community is not valid.');

    const doc = {
      name: name.trim(),
      email: (email || '').trim().toLowerCase(),
      role: ROLES.includes(role) ? role : 'member',
      communityId: _communityId,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await members().insertOne(doc);
    res.redirect('/members');
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- UPDATE ---- */

router.get('/:id/edit', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const member = await members().findOne({ _id });
    if (!member) return res.status(404).render('404', { title: 'Not found' });

    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    res.render('members/edit', { title: `Edit ${member.name}`, member, allCommunities, roles: ROLES });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const { name, email, role, communityId } = req.body;
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    const member = { ...(await members().findOne({ _id })), ...req.body };

    if (!name || !name.trim()) {
      return res.status(400).render('members/edit', {
        title: 'Edit member',
        member,
        allCommunities,
        roles: ROLES,
        error: 'Member name is required.',
      });
    }
    if (!communityId) {
      return res.status(400).render('members/edit', {
        title: 'Edit member',
        member,
        allCommunities,
        roles: ROLES,
        error: 'Please pick a community.',
      });
    }

    const _communityId = toObjectId(communityId);
    if (!_communityId) {
      return res.status(400).render('members/edit', {
        title: 'Edit member',
        member,
        allCommunities,
        roles: ROLES,
        error: 'That community is not valid.',
      });
    }

    await members().updateOne(
      { _id },
      {
        $set: {
          name: name.trim(),
          email: (email || '').trim().toLowerCase(),
          role: ROLES.includes(role) ? role : 'member',
          communityId: _communityId,
          updatedAt: new Date(),
        },
      }
    );

    res.redirect('/members?updated=1');
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- DELETE ---- */

router.post('/:id/delete', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    await members().deleteOne({ _id });
    res.redirect('/members?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
