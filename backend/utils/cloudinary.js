const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer config for memory storage (we'll upload buffer to Cloudinary)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload to Cloudinary from buffer
const uploadToCloudinary = (buffer, folder = 'receipts') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: `usls-batch-2003/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

// Delete from Cloudinary
const deleteFromCloudinary = (publicId) => {
  return cloudinary.uploader.destroy(publicId);
};

module.exports = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
  cloudinary
};