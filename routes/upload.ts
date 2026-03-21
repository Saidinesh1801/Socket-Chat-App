import { Router, Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import httpAuth from '../middleware/httpAuth';

let sharp: typeof import('sharp') | null;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

const allowedMimes = [
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4',
  'video/mp4','video/webm','video/ogg',
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv','application/zip','application/json'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed') as unknown as null, false);
    }
  }
});

const router = Router();

router.post('/', httpAuth, (req: Request, res: Response): void => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Max 5MB.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (sharp && req.file.mimetype.startsWith('image/') && !req.file.mimetype.includes('svg') && !req.file.mimetype.includes('gif')) {
      try {
        const compressed = path.join('uploads', 'c-' + req.file.filename);
        await sharp(req.file.path).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(compressed);
        fs.unlinkSync(req.file.path);
        fs.renameSync(compressed, req.file.path);
      } catch (e) { /* use original */ }
    }

    res.json({
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`
    });
  });
});

export default router;
