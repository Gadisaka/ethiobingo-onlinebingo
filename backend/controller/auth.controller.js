import User from "../model/user.js";
import OTP from "../model/otp.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
};

// Send OTP for signup
export const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Validate phone number
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this phone number" });
    }

    // Delete any existing OTP for this phone number
    await OTP.deleteMany({ phoneNumber });

    // Generate and store new OTP
    const otpCode = OTP.generateCode();
    const otp = new OTP({
      phoneNumber,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    await otp.save();

    // In a real app, you would send this OTP via SMS
    console.log(`OTP for ${phoneNumber}: ${otpCode}`);

    res.json({
      message: "OTP sent successfully",
      // In development, return OTP for testing
      otp: process.env.NODE_ENV === "development" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    if (error.stack) console.error(error.stack);
    console.error("Request body:", req.body);
    // Always return error details for debugging
    res.status(500).json({
      message: "Server error",
      error: String(error.message || error),
      stack: error.stack,
    });
  }
};

// Verify OTP and complete signup
export const verifyOTPAndSignup = async (req, res) => {
  try {
    const { phoneNumber, otp, pin, name } = req.body;

    if (!phoneNumber || !otp || !pin) {
      return res
        .status(400)
        .json({ message: "Phone number, OTP, and PIN are required" });
    }

    // Find and verify OTP
    const otpRecord = await OTP.findOne({
      phoneNumber,
      code: otp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if user already exists (shouldn't happen, but safety check)
    let user = await User.findOne({ phoneNumber });

    if (user) {
      // User already exists, just delete the OTP
      await OTP.deleteOne({ _id: otpRecord._id });
      return res
        .status(400)
        .json({ message: "User already exists with this phone number" });
    }

    // Create new user
    user = new User({
      phoneNumber,
      name: name || `User_${phoneNumber.slice(-4)}`,
      pin: pin,
      isVerified: true,
    });

    await user.save();

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user._id);

    res.json({
      message: "Signup successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        isVerified: user.isVerified,
        points: user.points,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login with phone and PIN
export const login = async (req, res) => {
  try {
    const { phoneNumber, pin } = req.body;

    if (!phoneNumber || !pin) {
      return res
        .status(400)
        .json({ message: "Phone number and PIN are required" });
    }

    // Find user
    const user = await User.findOne({ phoneNumber, isVerified: true });
    if (!user) {
      return res.status(401).json({ message: "Invalid phone number or PIN" });
    }

    // Verify PIN
    const isPinValid = await user.comparePin(pin);
    if (!isPinValid) {
      return res.status(401).json({ message: "Invalid phone number or PIN" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Update last login timestamp (especially for sub-admins, but track for all users)
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        isVerified: user.isVerified,
        role: user.role || "user",
        points: user.points,
        current_streak: user.current_streak,
        last_active_date: user.last_active_date,
        available_spins: user.available_spins,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Resend OTP
export const resendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this phone number" });
    }

    // Delete any existing OTP for this phone number
    await OTP.deleteMany({ phoneNumber });

    // Generate and store new OTP
    const otpCode = OTP.generateCode();
    const otp = new OTP({
      phoneNumber,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    await otp.save();

    // In a real app, you would send this OTP via SMS
    console.log(`Resent OTP for ${phoneNumber}: ${otpCode}`);

    res.json({
      message: "OTP resent successfully",
      // In development, return OTP for testing
      otp: process.env.NODE_ENV === "development" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify token middleware
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Optional token verification middleware (doesn't fail if no token)
export const verifyTokenOptional = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        phoneNumber: req.user.phoneNumber,
        balance: req.user.balance,
        isVerified: req.user.isVerified,
        role: req.user.role || "user",
        points: req.user.points,
        cashierCode: req.user.cashierCode,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Generate frontend token for cashier auto-login from admin panel
export const generateFrontendToken = async (req, res) => {
  try {
    // This endpoint expects the user to be authenticated via admin token
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (user.role !== "cashier") {
      return res.status(403).json({ message: "Only cashiers can generate frontend tokens" });
    }

    // Generate a frontend token
    const frontendToken = generateToken(user._id);

    res.json({
      token: frontendToken,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        cashierCode: user.cashierCode,
      },
    });
  } catch (error) {
    console.error("Error generating frontend token:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Validate and login with token (for auto-login from admin)
export const tokenLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    res.json({
      message: "Token login successful",
      token, // Return the same token since it's already valid
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        isVerified: user.isVerified,
        role: user.role || "user",
        points: user.points,
        current_streak: user.current_streak,
        last_active_date: user.last_active_date,
        available_spins: user.available_spins,
        cashierCode: user.cashierCode,
      },
    });
  } catch (error) {
    console.error("Token login error:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Create or get local player (for players who don't sign up with phone/OTP)
export const getOrCreateLocalPlayer = async (req, res) => {
  try {
    const { localPlayerId, name } = req.body;

    if (!localPlayerId || !name) {
      return res.status(400).json({ message: "localPlayerId and name are required" });
    }

    // Check if local player already exists
    let user = await User.findOne({ localPlayerId });

    if (user) {
      // Update name if changed
      if (user.name !== name) {
        user.name = name;
        await user.save();
      }
      
      return res.json({
        message: "Local player found",
        user: {
          id: user._id,
          _id: user._id,
          name: user.name,
          role: user.role,
          isLocalPlayer: true,
          localPlayerId: user.localPlayerId,
        },
      });
    }

    // Create new local player with a generated phone number
    const generatedPhone = `local-${localPlayerId}`;
    
    user = new User({
      name,
      phoneNumber: generatedPhone,
      isVerified: true,
      isLocalPlayer: true,
      localPlayerId,
      role: "user",
    });

    await user.save();

    res.status(201).json({
      message: "Local player created",
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        role: user.role,
        isLocalPlayer: true,
        localPlayerId: user.localPlayerId,
      },
    });
  } catch (error) {
    console.error("Error creating local player:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};