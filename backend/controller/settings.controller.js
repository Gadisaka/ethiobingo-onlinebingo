import Settings from "../model/settings.js";

// GET /api/settings - Get current settings
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

// PUT /api/settings - Update settings
export const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      // Create new settings if none exist
      settings = new Settings(req.body);
      await settings.save();
    } else {
      // Update existing settings
      // Only update fields that are provided
      if (req.body.systemGames) {
        settings.systemGames = {
          ...settings.systemGames,
          ...req.body.systemGames,
        };
      }
      if (req.body.userGames) {
        settings.userGames = {
          ...settings.userGames,
          ...req.body.userGames,
        };
      }
      if (req.body.spin) {
        settings.spin = {
          ...settings.spin,
          ...req.body.spin,
        };
      }
      if (req.body.bonus) {
        settings.bonus = {
          ...settings.bonus,
          ...req.body.bonus,
        };
      }
      if (req.body.banner) {
        settings.banner = {
          ...settings.banner,
          ...req.body.banner,
        };
      }

      await settings.save();
    }

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

// GET /api/settings/system-games/stakes - Get only game stakes (public endpoint)
export const getGameStakes = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: {
        gameStakes: settings.systemGames.gameStakes || [10, 20, 50, 100],
      },
    });
  } catch (error) {
    console.error("Error fetching game stakes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch game stakes",
      error: error.message,
    });
  }
};

// GET /api/settings/system-games - Get all system game settings (public endpoint)
export const getSystemGameSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: {
        maxPlayers: settings.systemGames?.maxPlayers || 100,
        minStake: settings.systemGames?.minStake || 10,
        maxStake: settings.systemGames?.maxStake || 1000,
        callInterval: settings.systemGames?.callInterval || 5,
        winCut: settings.systemGames?.winCut || 10,
        gameStakes: settings.systemGames?.gameStakes || [10, 20, 50, 100],
      },
    });
  } catch (error) {
    console.error("Error fetching system game settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch system game settings",
      error: error.message,
    });
  }
};

// GET /api/settings/user-games - Get user/cashier game settings (public endpoint for cashiers)
export const getUserGameSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.status(200).json({
      success: true,
      data: {
        minPlayers: settings.userGames?.minPlayers || 2,
        maxPlayers: settings.userGames?.maxPlayers || 50,
        minStake: settings.userGames?.minStake || 5,
        maxStake: settings.userGames?.maxStake || 500,
        winCut: settings.userGames?.winCut || 10,
        hostShare: settings.userGames?.hostShare || 5,
      },
    });
  } catch (error) {
    console.error("Error fetching user game settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user game settings",
      error: error.message,
    });
  }
};

// GET /api/settings/banner - Get banner settings (public endpoint)
export const getBanner = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const banner = settings.banner || {};
    
    // Check if banner is expired
    if (banner.expiresAt && new Date(banner.expiresAt) < new Date()) {
      return res.status(200).json({
        success: true,
        data: { enabled: false, images: [], displayOn: {} },
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        enabled: banner.enabled || false,
        images: banner.images || [],
        displayOn: banner.displayOn || { friends: true, waitingRoom: true, playingRoom: true },
        autoPlay: banner.autoPlay !== false,
        interval: banner.interval || 5000,
        expiresAt: banner.expiresAt || null,
      },
    });
  } catch (error) {
    console.error("Error fetching banner settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch banner settings",
      error: error.message,
    });
  }
};
