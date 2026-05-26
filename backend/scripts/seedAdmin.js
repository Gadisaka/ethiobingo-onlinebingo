import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../model/user.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    // Admin user configuration
    const adminData = {
      name: "Admin",
      phoneNumber: "0920304050",
      email: "admin@system.local",
      pin: "admin123",
      role: "admin",
      isVerified: true,
      isActive: true,
      balance: 0,
      points: 1000,
    };

    // Drop legacy unique email index (schema no longer uses email)
    try {
      const indexes = await User.collection.indexes();
      const hasLegacyEmailIndex = indexes.some(
        (idx) => idx.name === "email_1" && idx.key?.email,
      );

      if (hasLegacyEmailIndex) {
        await User.collection.dropIndex("email_1");
        console.log("🧹 Dropped legacy email_1 index");
      }
    } catch (indexError) {
      if (indexError.code !== 27) {
        console.warn("⚠️  Could not drop legacy email_1 index:", indexError.message);
      }
    }

    // Replace any existing admin user(s)
    const deleteResult = await User.deleteMany({
      $or: [{ phoneNumber: adminData.phoneNumber }, { role: "admin" }],
    });

    if (deleteResult.deletedCount > 0) {
      console.log(
        `🗑️  Removed ${deleteResult.deletedCount} existing admin user(s)`,
      );
    }

    const admin = new User(adminData);
    await admin.save();

    console.log("🌱 Admin user seeded successfully!");
    console.log(`  - Name: ${admin.name}`);
    console.log(`  - Phone: ${admin.phoneNumber}`);
    console.log(`  - PIN: ${adminData.pin}`);
    console.log(`  - Role: ${admin.role}`);
    console.log(`  - ID: ${admin._id}`);
    console.log("\n⚠️  Remember to change the default PIN in production!");
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "unknown field";
      console.error(`   Duplicate key on: ${field}`);
    }
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedAdmin();
