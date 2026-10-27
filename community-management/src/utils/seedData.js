/**
 * Reusable sample dataset for seeding all four MongoDB collections:
 *   - communities (with tags, views, featured flag, embedded contact subdocument)
 *   - members     (with bio, skills array, contribution points, role)
 *   - events      (with mode, capacity, tags, embedded rsvps subdocument array)
 *   - announcements (with pinned flag, atomic likes counter, authorName)
 */
const { ObjectId } = require('mongodb');

async function seedDatabase(db) {
  await db.collection('announcements').deleteMany({});
  await db.collection('members').deleteMany({});
  await db.collection('events').deleteMany({});
  await db.collection('communities').deleteMany({});

  const now = new Date();
  const inDays = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const ago = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // ---- 1. COMMUNITIES -----------------------------------------------------
  const communityDocs = [
    {
      _id: new ObjectId(),
      name: 'Poornima Coding Club',
      description:
        'Campus developer community learning full-stack web development, DSA, databases, and open-source collaboration.',
      category: 'Technology',
      location: 'Jaipur',
      tags: ['web-dev', 'mongodb', 'dsa', 'open-source'],
      contact: {
        leadEmail: 'codingclub@poornima.org',
        website: 'https://github.com/poornima-coding',
        meetFrequency: 'Weekly',
      },
      views: 148,
      featured: true,
      createdAt: ago(120),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      name: 'Jaipur Runners',
      description:
        'Weekend endurance group hosting 5K sunrise runs, 10K pacing clinics, and winter half-marathon prep across Central Park.',
      category: 'Sports',
      location: 'Jaipur',
      tags: ['running', 'fitness', 'marathon', 'outdoors'],
      contact: {
        leadEmail: 'hello@jaipurrunners.in',
        website: 'https://jaipurrunners.example.com',
        meetFrequency: 'Weekly',
      },
      views: 94,
      featured: true,
      createdAt: ago(85),
      updatedAt: ago(5),
    },
    {
      _id: new ObjectId(),
      name: 'Local Business Network',
      description:
        'Monthly roundtable for student founders, indie makers, and local freelancers sharing growth lessons and client referrals.',
      category: 'Business',
      location: 'Jaipur',
      tags: ['startups', 'freelancing', 'networking'],
      contact: {
        leadEmail: 'founders@jaipurbiz.example.com',
        website: '',
        meetFrequency: 'Monthly',
      },
      views: 67,
      featured: false,
      createdAt: ago(60),
      updatedAt: ago(8),
    },
    {
      _id: new ObjectId(),
      name: 'Pink City Design Guild',
      description:
        'UI/UX designers, illustrators, and frontend craft enthusiasts critiquing interfaces and building design systems together.',
      category: 'Design',
      location: 'Jaipur',
      tags: ['ui-ux', 'figma', 'css', 'design-systems'],
      contact: {
        leadEmail: 'guild@pinkcitydesign.example.com',
        website: 'https://pinkcitydesign.example.com',
        meetFrequency: 'Bi-weekly',
      },
      views: 82,
      featured: true,
      createdAt: ago(45),
      updatedAt: ago(3),
    },
    {
      _id: new ObjectId(),
      name: 'Udaipur AI & Data Circle',
      description:
        'Reading group and hands-on lab exploring Python data pipelines, vector search, and practical machine learning.',
      category: 'Education',
      location: 'Udaipur',
      tags: ['python', 'data-science', 'ai', 'mongodb'],
      contact: {
        leadEmail: 'team@udaipurai.example.com',
        website: '',
        meetFrequency: 'Bi-weekly',
      },
      views: 53,
      featured: false,
      createdAt: ago(28),
      updatedAt: ago(4),
    },
  ];

  await db.collection('communities').insertMany(communityDocs);
  const [coding, runners, business, design, aiCircle] = communityDocs;

  // ---- 2. MEMBERS ---------------------------------------------------------
  const memberDocs = [
    {
      _id: new ObjectId(),
      name: 'Sanay Ojha',
      email: 'sanay@example.com',
      role: 'admin',
      bio: 'Full-stack builder focused on Node.js, Express, and MongoDB architecture.',
      skills: ['MongoDB', 'Node.js', 'JavaScript', 'Git'],
      points: 95,
      communityId: coding._id,
      joinedAt: ago(118),
      createdAt: ago(118),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      name: 'Aarav Sharma',
      email: 'aarav@example.com',
      role: 'member',
      bio: 'Backend enthusiast practicing data structures and REST APIs.',
      skills: ['JavaScript', 'C++', 'MongoDB'],
      points: 55,
      communityId: coding._id,
      joinedAt: ago(90),
      createdAt: ago(90),
      updatedAt: ago(10),
    },
    {
      _id: new ObjectId(),
      name: 'Diya Verma',
      email: 'diya@example.com',
      role: 'moderator',
      bio: 'Mentors first-time open-source contributors and leads code reviews.',
      skills: ['React', 'Node.js', 'Git', 'CSS'],
      points: 80,
      communityId: coding._id,
      joinedAt: ago(45),
      createdAt: ago(45),
      updatedAt: ago(4),
    },
    {
      _id: new ObjectId(),
      name: 'Pranav Joshi',
      email: 'pranav@example.com',
      role: 'member',
      bio: 'Exploring database indexing and backend performance.',
      skills: ['Python', 'MongoDB', 'Docker'],
      points: 40,
      communityId: coding._id,
      joinedAt: ago(22),
      createdAt: ago(22),
      updatedAt: ago(6),
    },
    {
      _id: new ObjectId(),
      name: 'Kabir Singh',
      email: 'kabir@example.com',
      role: 'member',
      bio: 'Training for a sub-50 minute 10K this season.',
      skills: ['Endurance', 'Pacing'],
      points: 45,
      communityId: runners._id,
      joinedAt: ago(58),
      createdAt: ago(58),
      updatedAt: ago(12),
    },
    {
      _id: new ObjectId(),
      name: 'Ishita Jain',
      email: 'ishita@example.com',
      role: 'admin',
      bio: 'Route coordinator and marathon pacer.',
      skills: ['Marathon Prep', 'Event Ops', 'Coaching'],
      points: 85,
      communityId: runners._id,
      joinedAt: ago(55),
      createdAt: ago(55),
      updatedAt: ago(3),
    },
    {
      _id: new ObjectId(),
      name: 'Rohan Mehta',
      email: 'rohan@example.com',
      role: 'admin',
      bio: 'Bootstrapped SaaS founder helping local agencies scale.',
      skills: ['Product Strategy', 'Sales', 'Operations'],
      points: 70,
      communityId: business._id,
      joinedAt: ago(50),
      createdAt: ago(50),
      updatedAt: ago(7),
    },
    {
      _id: new ObjectId(),
      name: 'Neha Rathore',
      email: 'neha@example.com',
      role: 'member',
      bio: 'Independent brand consultant & copywriter.',
      skills: ['Marketing', 'Copywriting', 'Figma'],
      points: 35,
      communityId: business._id,
      joinedAt: ago(18),
      createdAt: ago(18),
      updatedAt: ago(5),
    },
    {
      _id: new ObjectId(),
      name: 'Ananya Gupta',
      email: 'ananya@example.com',
      role: 'admin',
      bio: 'Design systems lead passionate about accessible interfaces.',
      skills: ['Figma', 'UI/UX', 'CSS', 'HTML'],
      points: 90,
      communityId: design._id,
      joinedAt: ago(44),
      createdAt: ago(44),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      name: 'Vikramaditya Rao',
      email: 'vikram@example.com',
      role: 'moderator',
      bio: 'Bridging design tokens and clean frontend components.',
      skills: ['CSS', 'JavaScript', 'Figma'],
      points: 60,
      communityId: design._id,
      joinedAt: ago(30),
      createdAt: ago(30),
      updatedAt: ago(6),
    },
    {
      _id: new ObjectId(),
      name: 'Meera Nair',
      email: 'meera@example.com',
      role: 'admin',
      bio: 'Data engineer working with Python and document databases.',
      skills: ['Python', 'MongoDB', 'Machine Learning'],
      points: 75,
      communityId: aiCircle._id,
      joinedAt: ago(26),
      createdAt: ago(26),
      updatedAt: ago(3),
    },
  ];

  await db.collection('members').insertMany(memberDocs);
  const [sanay, aarav, diya, pranav, kabir, ishita, rohan, neha, ananya, vikram, meera] =
    memberDocs;

  // ---- 3. EVENTS ----------------------------------------------------------
  const eventDocs = [
    {
      _id: new ObjectId(),
      title: 'Sunrise 5K Community Run',
      description:
        'Easy conversational-pace 5K loop around Central Park followed by filter coffee and cooldown stretches.',
      date: inDays(3),
      location: 'Gate 2, Central Park, Jaipur',
      mode: 'In-Person',
      capacity: 25,
      tags: ['5k', 'beginner-friendly'],
      rsvps: [
        { memberId: ishita._id, memberName: ishita.name, memberRole: ishita.role, rsvpAt: ago(4) },
        { memberId: kabir._id, memberName: kabir.name, memberRole: kabir.role, rsvpAt: ago(3) },
        { memberId: sanay._id, memberName: sanay.name, memberRole: sanay.role, rsvpAt: ago(1) },
      ],
      communityId: runners._id,
      createdAt: ago(10),
      updatedAt: ago(1),
    },
    {
      _id: new ObjectId(),
      title: 'MongoDB Aggregation & Indexing Workshop',
      description:
        'Hands-on lab covering CRUD, $lookup joins, $unwind + $group analytics pipelines, and compound indexes.',
      date: inDays(7),
      location: 'Lab 3, Poornima College',
      mode: 'Hybrid',
      capacity: 30,
      tags: ['mongodb', 'workshop', 'backend'],
      rsvps: [
        { memberId: sanay._id, memberName: sanay.name, memberRole: sanay.role, rsvpAt: ago(6) },
        { memberId: aarav._id, memberName: aarav.name, memberRole: aarav.role, rsvpAt: ago(5) },
        { memberId: diya._id, memberName: diya.name, memberRole: diya.role, rsvpAt: ago(4) },
        { memberId: pranav._id, memberName: pranav.name, memberRole: pranav.role, rsvpAt: ago(2) },
        { memberId: meera._id, memberName: meera.name, memberRole: meera.role, rsvpAt: ago(1) },
      ],
      communityId: coding._id,
      createdAt: ago(14),
      updatedAt: ago(1),
    },
    {
      _id: new ObjectId(),
      title: 'Design Critique: Clean Dashboard Layouts',
      description:
        'Bring a work-in-progress screen for friendly 10-minute feedback on spacing, typography, and visual hierarchy.',
      date: inDays(11),
      location: 'Pink City Co-Work, C-Scheme',
      mode: 'In-Person',
      capacity: 18,
      tags: ['ui-ux', 'critique'],
      rsvps: [
        { memberId: ananya._id, memberName: ananya.name, memberRole: ananya.role, rsvpAt: ago(3) },
        { memberId: vikram._id, memberName: vikram.name, memberRole: vikram.role, rsvpAt: ago(2) },
      ],
      communityId: design._id,
      createdAt: ago(8),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      title: 'Founders Coffee & Pitch Feedback',
      description:
        'Informal morning roundtable for early-stage builders to test product positioning and swap customer insights.',
      date: inDays(15),
      location: 'Curious Life Coffee Roasters, Jaipur',
      mode: 'In-Person',
      capacity: 15,
      tags: ['founders', 'networking'],
      rsvps: [
        { memberId: rohan._id, memberName: rohan.name, memberRole: rohan.role, rsvpAt: ago(5) },
        { memberId: neha._id, memberName: neha.name, memberRole: neha.role, rsvpAt: ago(2) },
      ],
      communityId: business._id,
      createdAt: ago(9),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      title: 'Open Source Saturday Sprint',
      description:
        'Pick a good-first-issue, set up your local branch, and submit a pull request with mentor guidance.',
      date: inDays(21),
      location: 'Online (Google Meet)',
      mode: 'Online',
      capacity: 50,
      tags: ['open-source', 'git'],
      rsvps: [
        { memberId: diya._id, memberName: diya.name, memberRole: diya.role, rsvpAt: ago(2) },
        { memberId: sanay._id, memberName: sanay.name, memberRole: sanay.role, rsvpAt: ago(1) },
      ],
      communityId: coding._id,
      createdAt: ago(5),
      updatedAt: ago(1),
    },
    {
      _id: new ObjectId(),
      title: 'Intro to Document Modeling vs SQL Tables',
      description:
        'Past session comparing embedded subdocuments against foreign-key references in real apps.',
      date: ago(12),
      location: 'Seminar Hall B, Poornima College',
      mode: 'In-Person',
      capacity: 35,
      tags: ['mongodb', 'schema-design'],
      rsvps: [
        { memberId: sanay._id, memberName: sanay.name, memberRole: sanay.role, rsvpAt: ago(16) },
        { memberId: aarav._id, memberName: aarav.name, memberRole: aarav.role, rsvpAt: ago(15) },
        { memberId: diya._id, memberName: diya.name, memberRole: diya.role, rsvpAt: ago(14) },
      ],
      communityId: coding._id,
      createdAt: ago(25),
      updatedAt: ago(12),
    },
  ];

  await db.collection('events').insertMany(eventDocs);

  // ---- 4. ANNOUNCEMENTS ---------------------------------------------------
  const announcementDocs = [
    {
      _id: new ObjectId(),
      title: 'Workshop slides & sample .env template posted',
      body: 'Make sure Node.js 18+ and your MongoDB Atlas URI are ready before Saturday so we can jump straight into live aggregation pipelines.',
      authorName: 'Sanay Ojha',
      communityId: coding._id,
      pinned: true,
      likes: 14,
      createdAt: ago(2),
      updatedAt: ago(2),
    },
    {
      _id: new ObjectId(),
      title: 'New 5K Hydration Point at Gate 2',
      body: 'Starting this Sunday we will have water and electrolytes waiting at the finish arch. Arrive 10 minutes early for warm-up drills.',
      authorName: 'Ishita Jain',
      communityId: runners._id,
      pinned: true,
      likes: 9,
      createdAt: ago(3),
      updatedAt: ago(3),
    },
    {
      _id: new ObjectId(),
      title: 'Share your portfolio for the November UI showcase',
      body: 'Drop a link to one component or redesign you shipped this month. Three projects will be featured in our bi-weekly critique.',
      authorName: 'Ananya Gupta',
      communityId: design._id,
      pinned: false,
      likes: 7,
      createdAt: ago(4),
      updatedAt: ago(4),
    },
    {
      _id: new ObjectId(),
      title: 'Python + MongoDB notebook repository live',
      body: 'Uploaded starter notebooks demonstrating pymongo queries, index explain plans, and dataset imports.',
      authorName: 'Meera Nair',
      communityId: aiCircle._id,
      pinned: false,
      likes: 6,
      createdAt: ago(6),
      updatedAt: ago(6),
    },
  ];

  await db.collection('announcements').insertMany(announcementDocs);

  return {
    communities: communityDocs.length,
    members: memberDocs.length,
    events: eventDocs.length,
    announcements: announcementDocs.length,
  };
}

module.exports = { seedDatabase };
