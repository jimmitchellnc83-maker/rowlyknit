import { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import db from '../config/database';

const unlinkAsync = promisify(fs.unlink);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const dirs = [
    'uploads/projects',
    'uploads/projects/thumbnails',
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureUploadDirs();

// Upload project photo
export const uploadProjectPhoto = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { projectId } = req.params;

    // Verify project exists and belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const timestamp = Date.now();
    const filename = `project-${projectId}-${timestamp}.webp`;
    const thumbnailFilename = `project-${projectId}-${timestamp}-thumb.webp`;

    const filepath = path.join('uploads/projects', filename);
    const thumbnailPath = path.join('uploads/projects/thumbnails', thumbnailFilename);

    // Process and save original image as WebP
    await sharp(req.file.buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(filepath);

    // Generate thumbnail
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    // Get image metadata
    const metadata = await sharp(req.file.buffer).metadata();

    // Save to database
    const [photo] = await db('project_photos')
      .insert({
        project_id: projectId,
        filename: filename,
        thumbnail_filename: thumbnailFilename,
        original_filename: req.file.originalname,
        file_path: `/uploads/projects/${filename}`,
        thumbnail_path: `/uploads/projects/thumbnails/${thumbnailFilename}`,
        mime_type: 'image/webp',
        size: req.file.size,
        width: metadata.width,
        height: metadata.height,
        caption: req.body.caption || null,
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: { photo },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      error: error.message,
    });
  }
};

// Get project photos
export const getProjectPhotos = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { projectId } = req.params;

    // Verify project exists and belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const photos = await db('project_photos')
      .where({ project_id: projectId })
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: { photos },
    });
  } catch (error: any) {
    console.error('Error fetching photos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photos',
    });
  }
};

// Delete project photo
export const deleteProjectPhoto = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { projectId, photoId } = req.params;

    // Verify project exists and belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Get photo
    const photo = await db('project_photos')
      .where({ id: photoId, project_id: projectId })
      .whereNull('deleted_at')
      .first();

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found',
      });
    }

    // Soft delete
    await db('project_photos')
      .where({ id: photoId })
      .update({
        deleted_at: db.fn.now(),
      });

    // Delete physical files
    try {
      const filepath = path.join(photo.filename);
      const thumbnailPath = path.join('uploads/projects/thumbnails', photo.thumbnail_filename);

      if (fs.existsSync(filepath)) await unlinkAsync(filepath);
      if (fs.existsSync(thumbnailPath)) await unlinkAsync(thumbnailPath);
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
      // Continue even if file deletion fails
    }

    res.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo',
    });
  }
};

export const uploadMiddleware = upload.single('photo');
