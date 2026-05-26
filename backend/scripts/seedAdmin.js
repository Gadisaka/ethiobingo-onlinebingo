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
      phoneNumber: "0911223344",
      pin: "admin123",
      role: "admin",
      isVerified: true,
      isActive: true,
      balance: 0,
      points: 1000,
    };

    // Replace any existing admin user(s)
    const deleteResult = await User.deleteMany({
      $or: [{ phoneNumber: adminData.phoneNumber }, { role: "admin" }],
    });

    if (deleteResult.deletedCount > 0) {
      console.log(`🗑️  Removed ${deleteResult.deletedCount} existing admin user(s)`);
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
      console.error("   Duplicate phone number detected");
    }
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedAdmin();
