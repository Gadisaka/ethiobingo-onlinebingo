import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    // System Games Settings
    systemGames: {
      maxPlayers: { type: Number, default: 100 },
      minStake: { type: Number, default: 10 },
      maxStake: { type: Number, default: 1000 },
      callInterval: { type: Number, default: 5 }, // seconds
      winCut: { type: Number, default: 10 }, // percentage
      gameStakes: { type: [Number], default: [10, 20, 50, 100] }, // Array of stake amounts
    },
    // User/Cashier Games Settings (constraints for cashiers creating games)
    // Note: winCut is now stored per-cashier in the User model
    userGames: {
      minPlayers: { type: Number, default: 2 },
      maxPlayers: { type: Number, default: 50 },
      minStake: { type: Number, default: 5 },
      maxStake: { type: Number, default: 500 },
    },
    // Banner/Slideshow Image Settings
    banner: {
      enabled: { type: Boolean, default: false },
      // Array of banner images for slideshow
      images: [{
        url: { type: String, required: true },
        publicId: { type: String }, // Cloudinary public_id for deletion
        link: { type: String, default: "" }, // Optional click link
        alt: { type: String, default: "" }, // Alt text
      }],
      // Which pages to display the banner on
      displayOn: {
        friends: { type: Boolean, default: true },
        waitingRoom: { type: Boolean, default: true },
        playingRoom: { type: Boolean, default: true },
      },
      // Slideshow settings
      autoPlay: { type: Boolean, default: true },
      interval: { type: Number, default: 5000 }, // milliseconds between slides
      expiresAt: { type: Date, default: null },
    },
    // Spin Settings (for future use)
    spin: {
      enabled: { type: Boolean, default: false },
    },
    // Bonus Settings (for future use)
    bonus: {
      enabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
