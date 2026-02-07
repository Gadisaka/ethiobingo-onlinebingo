import mongoose from 'mongoose';
import GameHistory from './model/gameHistory.js';
import GameRoom from './model/gameRooms.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * This script backfills the cashierId field in GameHistory records
 * for user games where cashierId is null but hostUserId exists.
 * 
 * For user games (not system games), the hostUserId is the cashier's ID,
 * so we copy hostUserId to cashierId.
 */
async function backfillCashierId() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bingoGame';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all user game history records where:
    // - gameType is "user"
    // - cashierId is null or undefined
    // - hostUserId is not null
    const records = await GameHistory.find({
      gameType: 'user',
      $or: [{ cashierId: null }, { cashierId: { $exists: false } }],
      hostUserId: { $exists: true, $ne: null },
    });

    console.log(`📊 Found ${records.length} GameHistory records to update`);

    if (records.length === 0) {
      console.log('✅ No records need updating. All done!');
      process.exit(0);
    }

    // Update each record
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        record.cashierId = record.hostUserId;
        await record.save();
        updated++;
        
        if (updated % 10 === 0) {
          console.log(`   Updated ${updated}/${records.length} records...`);
        }
      } catch (err) {
        console.error(`❌ Failed to update record ${record._id}:`, err.message);
        failed++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Successfully updated: ${updated} records`);
    if (failed > 0) {
      console.log(`   Failed: ${failed} records`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
backfillCashierId();
