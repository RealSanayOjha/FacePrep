/**
 * Routes for ANNOUNCEMENTS (Community Bulletin Board).
 *
 * MongoDB operations demonstrated here:
 *   - $lookup join with communities + compound sort ({ pinned: -1, createdAt: -1 })
 *   - Boolean field filtering ({ pinned: true }) + $or/$regex search
 *   - Atomic reaction counter via updateOne({ _id }, { $inc: { likes: 1 } })
 *   - Boolean toggle via updateOne({ _id }, { $set: { pinned: !doc.pinned } })
 */
const express = require('express');
const { getDB, toObjectId } = require('../config/db');
const { escapeRegex } = require('../utils/format');

const router = express.Router();
const announcements = () => getDB().collection('announcements');
const communities = () => getDB().collection('communities');

function safeReturnTo(raw, fallback = '/announcements') {
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
    const pinnedOnly = req.query.pinned === '1';

    const filter = {};
    if (selectedCommunity) {
      const communityId = toObjectId(selectedCommunity);
      if (communityId) filter.communityId = communityId;
    }
    if (pinnedOnly) {
      filter.pinned = true;
    }
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [{ title: rx }, { body: rx }, { authorName: rx }];
    }

    const [list, allCommunities] = await Promise.all([
      announcements()
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
          { $sort: { pinned: -1, createdAt: -1 } },
        ])
        .toArray(),
      communities().find({}).sort({ name: 1 }).toArray(),
    ]);

    res.render('announcements/index', {
      title: 'Announcements',
      announcements: list,
      allCommunities,
      filters: {
        q,
        community: selectedCommunity,
        pinned: pinnedOnly,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- CREATE ---- */

router.post('/', async (req, res, next) => {
  try {
    const { title, body, authorName, communityId, pinned, returnTo } = req.body;
    const redirectBack = safeReturnTo(returnTo, '/announcements');

    if (!title || !title.trim() || !communityId) {
      return res.redirect(redirectBack);
    }

    const _communityId = toObjectId(communityId);
    if (!_communityId) return res.redirect(redirectBack);

    const now = new Date();
    await announcements().insertOne({
      title: title.trim(),
      body: (body || '').trim(),
      authorName: (authorName || '').trim() || 'Community Admin',
      communityId: _communityId,
      pinned: pinned === 'on' || pinned === 'true',
      likes: 0,
      createdAt: now,
      updatedAt: now,
    });

    const sep = redirectBack.includes('?') ? '&' : '?';
    res.redirect(`${redirectBack}${sep}created=1`);
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------- ATOMIC OPERATORS ---- */

// $inc: Increment announcement likes counter atomically
router.post('/:id/like', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    await announcements().updateOne({ _id }, { $inc: { likes: 1 } });
    res.redirect(safeReturnTo(req.body.returnTo, '/announcements'));
  } catch (err) {
    next(err);
  }
});

// $set: Toggle pinned status
router.post('/:id/pin', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    const doc = await announcements().findOne({ _id });
    if (!doc) return res.status(404).render('404', { title: 'Not found' });

    await announcements().updateOne(
      { _id },
      { $set: { pinned: !doc.pinned, updatedAt: new Date() } }
    );

    res.redirect(safeReturnTo(req.body.returnTo, '/announcements'));
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------- DELETE ---- */

router.post('/:id/delete', async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(404).render('404', { title: 'Not found' });

    await announcements().deleteOne({ _id });
    const redirectBack = safeReturnTo(req.body.returnTo, '/announcements');
    const sep = redirectBack.includes('?') ? '&' : '?';
    res.redirect(`${redirectBack}${sep}deleted=1`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
