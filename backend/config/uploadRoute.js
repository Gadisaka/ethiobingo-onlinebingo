// uploadRoute.js - ES Module version
import express from "express";
import multer from "multer";
import { uploadImageToCloudinary } from "./cloudinary.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Single image upload
router.post("/image", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await uploadImageToCloudinary(file);
    return res.status(200).json({ 
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Multiple images upload
router.post("/images", upload.array("images", 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploads = await Promise.all(
      files.map((file) => uploadImageToCloudinary(file))
    );
    const images = uploads.map((u) => ({
      url: u.secure_url,
      publicId: u.public_id,
    }));
    return res.status(200).json({ success: true, images });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
