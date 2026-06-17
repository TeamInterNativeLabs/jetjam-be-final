/**
 * One-time fix: For each user, keep only the most recent subscription as active.
 * All older subscriptions that are incorrectly marked active get set to inactive.
 * 
 * Run: node fix-duplicate-subscriptions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('./src/models/subscription.model');

async function fixDuplicates() {
  await mongoose.connect(process.env.DB_CONNECTION_STRING, {
    dbName: process.env.DB_NAME,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to DB');

  // Find all users who have more than one active subscription
  const duplicates = await Subscription.aggregate([
    { $match: { active: true } },
    { $sort: { createdAt: -1 } },
    { $group: {
      _id: '$user',
      subs: { $push: { id: '$_id', createdAt: '$createdAt' } },
      count: { $sum: 1 }
    }},
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`Found ${duplicates.length} user(s) with multiple active subscriptions`);

  let totalFixed = 0;
  for (const dup of duplicates) {
    // Keep the most recent (index 0 since sorted desc), deactivate the rest
    const toDeactivate = dup.subs.slice(1).map(s => s.id);
    const result = await Subscription.updateMany(
      { _id: { $in: toDeactivate } },
      { $set: { active: false } }
    );
    console.log(`User ${dup._id}: deactivated ${result.modifiedCount} old subscription(s), kept ${dup.subs[0].id} active`);
    totalFixed += result.modifiedCount;
  }

  console.log(`\nDone. Fixed ${totalFixed} subscription(s) total.`);
  await mongoose.disconnect();
}

fixDuplicates().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
