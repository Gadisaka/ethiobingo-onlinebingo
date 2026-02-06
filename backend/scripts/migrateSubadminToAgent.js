/**
 * Migration Script: Convert "subadmin" role to "agent" role
 *
 * Run this script once to update existing subadmin users to the new agent role.
 *
 * Usage: node scripts/migrateSubadminToAgent.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bingo";

async function migrate() {
  try {
    console.log("🔄 Connecting to database...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to database");

    // Get the User collection directly
    const User = mongoose.connection.collection("users");

    // Count existing subadmins
    const subadminCount = await User.countDocuments({ role: "subadmin" });
    console.log(`📊 Found ${subadminCount} users with role "subadmin"`);

    if (subadminCount === 0) {
      console.log("✅ No migration needed - no subadmin users found");
      await mongoose.disconnect();
      return;
    }

    // Update all subadmin users to agent
    const result = await User.updateMany(
      { role: "subadmin" },
      { $set: { role: "agent" } }
    );

    console.log(
      `✅ Successfully migrated ${result.modifiedCount} users from "subadmin" to "agent"`
    );

    // Verify migration
    const remainingSubadmins = await User.countDocuments({ role: "subadmin" });
    const newAgents = await User.countDocuments({ role: "agent" });

    console.log(`📊 Remaining subadmin users: ${remainingSubadmins}`);
    console.log(`📊 Total agent users: ${newAgents}`);

    await mongoose.disconnect();
    console.log("✅ Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
