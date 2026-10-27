/**
 * Routes for MEMBERS.
 *
 * MongoDB operations demonstrated here:
 *   - $lookup + $unwind join with communities
 *   - Multi-field $or + $regex search, role filter, $gte points filter
 *   - Array element querying ({ skills: "MongoDB" }) + distinct('skills')
 *   - Server-side pagination with countDocuments(), skip(), and limit()
 *   - Array update operators: $addToSet (add unique skill) & $pull (remove skill)
 *   - Atomic counter update: $inc ({ points: 5 } for Kudos)
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');
const { escapeRegex, parseCsvList } = require('../utils/format');

const router = express.Router();
const members = () => getDB().collection('members');
const communities = () => getDB().collection('communities');
const events = () => getDB().collection('events');

const ROLES = ['member', 'moderator', 'admin'];
const PAGE_SIZE = 8;

function safeReturnTo(raw, fallback = '/members') {
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return fallback;
}

/* ---------------------------------------------------------------- READ ---- */

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const selectedCommunity = (req.query.community || '').trim();
    const selectedRole = (req.query.role || '').trim();
    const selectedSkill = (req.query.skill || '').trim();
    const minPointsRaw = (req.query.minPoints || '').trim();
    const sortBy = (req.query.sort || 'name').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const filter = {};
    if (selectedCommunity) {
      const communityId = toObjectId(selectedCommunity);
      if (communityId) filter.communityId = communityId;
    }
    if (selectedRole && ROLES.includes(selectedRole)) {
      filter.role = selectedRole;
    }
    if (selectedSkill) {
      // Matches any document whose `skills` array contains `selectedSkill`
      filter.skills = selectedSkill;
    }
    if (minPointsRaw !== '' && !Number.isNaN(Number(minPointsRaw))) {
      filter.points = { $gte: Number(minPointsRaw) };
    }
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [{ name: rx }, { email: rx }, { bio: rx }, { skills: rx }];
    }

    const sortStage =
      sortBy === 'points'
        ? { points: -1, name: 1 }
        : sortBy === 'recent'
        ? { joinedAt: -1 }
        : { name: 1 };

    const totalCount = await members().countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * PAGE_SIZE;

    const [list, allCommunities, distinctSkills] = await Promise.all([
      members()
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
          {
            $addFields: {
              points: { $ifNull: ['$points', 0] },
              skills: { $ifNull: ['$skills', []] },
            },
          },
          { $sort: sortStage },
          { $skip: skip },
          { $limit: PAGE_SIZE },
        ])
        .toArray(),
      communities().find({}).sort({ name: 1 }).toArray(),
      members().distinct('skills'),
    ]);

    res.render('members/index', {
      title: 'Members',
      members: list,
      allCommunities,
      distinctSkills: distinctSkills.sort(),
      roles: ROLES,
      filters: {
        q,
        community: selectedCommunity,
        role: selectedRole,
        skill: selectedSkill,
        minPoints: minPointsRaw,
        sort: sortBy,
      },
      pagination: {
        page: currentPage,
        pageSize: PAGE_SIZE,
        totalCount,
        totalPages,
        from: totalCount === 0 ? 0 : skip + 1,
        to: Math.min(skip + list.length, totalCount),
      },
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
      title: 'Add member',
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
    const { name, email, role, bio, skills, points, communityId } = req.body;

    const renderError = async (message) => {
      const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
      return res.status(400).render('members/new', {
        title: 'Add member',
        allCommunities,
        roles: ROLES,
        preselected: communityId || '',
        error: message,
        values: req.body,
      });
    };

    if (!name || !name.trim()) return renderError('Member name is required.');
    if (!communityId) return renderError('Please pick a community.');

    const _communityId = toObjectId(communityId);
    if (!_communityId) return renderError('That community is not valid.');

    const now = new Date();
    const parsedPoints = Math.max(0, parseInt(points, 10) || 10);

    const doc = {
      name: name.trim(),
      email: (email || '').trim().toLowerCase(),
      role: ROLES.includes(role) ? role : 'member',
      bio: (bio || '').trim(),
      skills: parseCsvList(skills),
      points: parsedPoints,
      communityId: _communityId,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await members().insertOne(doc);
    res.redirect('/members?created=1');
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
    res.render('members/edit', {
      title: `Edit ${member.name}`,
      member,
      allCommunities,
      roles: ROLES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/update', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const { name, email, role, bio, skills, points, communityId } = req.body;
    const allCommunities = await communities().find({}).sort({ name: 1 }).toArray();
    const existing = await members().findOne({ _id });
    if (!existing) return res.status(404).render('404', { title: 'Not found' });

    const merged = { ...existing, ...req.body, skills: parseCsvList(skills) };

    if (!name || !name.trim()) {
      return res.status(400).render('members/edit', {
        title: 'Edit member',
        member: merged,
        allCommunities,
        roles: ROLES,
        error: 'Member name is required.',
      });
    }
    if (!communityId) {
      return res.status(400).render('members/edit', {
        title: 'Edit member',
        member: merged,
        allCommunities,
        roles: ROLES,
        error: 'Please pick a community.',
      });
    }

    const _communityId = toObjectId(communityId);
    if (!_communityId) {
      return res.status(400).render('members/edit', {
        title: 'Edit member',
        member: merged,
        allCommunities,
        roles: ROLES,
        error: 'That community is not valid.',
      });
    }

    const parsedPoints =
      points !== undefined && points !== ''
        ? Math.max(0, parseInt(points, 10) || 0)
        : existing.points || 0;

    await members().updateOne(
      { _id },
      {
        $set: {
          name: name.trim(),
          email: (email || '').trim().toLowerCase(),
          role: ROLES.includes(role) ? role : 'member',
          bio: (bio || '').trim(),
          skills: parseCsvList(skills),
          points: parsedPoints,
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

/* ------------------------------------------- ARRAY & COUNTER OPERATORS ---- */

// $addToSet: Add a skill tag without duplicates
router.post('/:id/skills/add', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const skill = (req.body.skill || '').trim();
    if (skill) {
      await members().updateOne(
        { _id },
        {
          $addToSet: { skills: skill },
          $set: { updatedAt: new Date() },
        }
      );
    }

    res.redirect(safeReturnTo(req.body.returnTo, '/members'));
  } catch (err) {
    next(err);
  }
});

// $pull: Remove a specific skill tag from the `skills` array
router.post('/:id/skills/remove', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const skill = (req.body.skill || '').trim();
    if (skill) {
      await members().updateOne(
        { _id },
        {
          $pull: { skills: skill },
          $set: { updatedAt: new Date() },
        }
      );
    }

    res.redirect(safeReturnTo(req.body.returnTo, '/members'));
  } catch (err) {
    next(err);
  }
});

// $inc: Atomically award +5 contribution points ("Kudos")
router.post('/:id/kudos', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    await members().updateOne(
      { _id },
      {
        $inc: { points: 5 },
        $set: { updatedAt: new Date() },
      }
    );

    res.redirect(safeReturnTo(req.body.returnTo, '/members'));
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- DELETE ---- */

router.post('/:id/delete', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    await Promise.all([
      members().deleteOne({ _id }),
      // Also clean up any RSVPs by this member inside event documents ($pull)
      events().updateMany({}, { $pull: { rsvps: { memberId: _id } } }),
    ]);

    res.redirect('/members?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
