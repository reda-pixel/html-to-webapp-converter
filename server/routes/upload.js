import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mkdir } from 'fs/promises';

const router = express.Router();

// Configure multer
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'server/uploads');
    await mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/html', 'application/zip', 'application/x-zip-compressed'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only HTML and ZIP files are allowed'));
    }
  }
});

// Upload endpoint
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const projectId = uuidv4();
  const fileInfo = {
    projectId,
    filename: req.file.originalname,
    size: req.file.size,
    path: req.file.path,
    uploadedAt: new Date().toISOString()
  };

  res.json({
    success: true,
    message: 'File uploaded successfully',
    data: fileInfo
  });
});

export default router;
