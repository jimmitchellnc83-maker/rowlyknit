import { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import db from '../config/database';

const unlinkAsync = promisify(fs.unlink);

// Configure multer for image uploads (project/yarn photos)
const imageUpload = multer({
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

// Configure multer for pattern files (PDFs, images, documents)
const patternFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for pattern files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/pdf',
      'text/x-pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    // Also check file extension for PDFs as fallback
    const isPdfByExtension = file.originalname.toLowerCase().endsWith('.pdf');

    if (allowedMimes.includes(file.mimetype) || isPdfByExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, images, and documents are allowed.`));
    }
  },
});

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const dirs = [
    'uploads/projects',
    'uploads/projects/thumbnails',
    'uploads/patterns',
    'uploads/yarn',
    'uploads/yarn/thumbnails',
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

// ============================================
// PATTERN FILE UPLOAD FUNCTIONS
// ============================================

// Helper function to determine file type
const getFileType = (mimetype: string, filename?: string): string => {
  // Check MIME type first
  if (mimetype === 'application/pdf' || mimetype.includes('pdf')) return 'pdf';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.includes('word') || mimetype === 'text/plain') return 'document';

  // Fallback to file extension if MIME type is not recognized
  if (filename) {
    const ext = filename.toLowerCase();
    if (ext.endsWith('.pdf')) return 'pdf';
    if (ext.match(/\.(jpg|jpeg|png|webp|gif)$/)) return 'image';
    if (ext.match(/\.(doc|docx|txt)$/)) return 'document';
  }

  return 'other';
};

// Upload pattern file
export const uploadPatternFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { patternId } = req.params;

    // Verify pattern exists and belongs to user
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.pdf';
    const filename = `pattern-${patternId}-${timestamp}${ext}`;
    const filepath = path.join('uploads/patterns', filename);

    // Save the file
    await fs.promises.writeFile(filepath, req.file.buffer);

    // Determine file type
    const fileType = getFileType(req.file.mimetype, req.file.originalname);

    // Save to database
    const [file] = await db('pattern_files')
      .insert({
        pattern_id: patternId,
        user_id: userId,
        filename: filename,
        original_filename: req.file.originalname,
        file_path: `/uploads/patterns/${filename}`,
        mime_type: req.file.mimetype,
        size: req.file.size,
        file_type: fileType,
        description: req.body.description || null,
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Pattern file uploaded successfully',
      data: { file },
    });
  } catch (error: any) {
    console.error('Pattern file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload pattern file',
      error: error.message,
    });
  }
};

// Get pattern files
export const getPatternFiles = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { patternId } = req.params;

    // Verify pattern exists and belongs to user
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    const files = await db('pattern_files')
      .where({ pattern_id: patternId })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: { files },
    });
  } catch (error: any) {
    console.error('Error fetching pattern files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pattern files',
    });
  }
};

// Delete pattern file
export const deletePatternFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { patternId, fileId } = req.params;

    // Verify pattern exists and belongs to user
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    // Get file
    const file = await db('pattern_files')
      .where({ id: fileId, pattern_id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Soft delete
    await db('pattern_files')
      .where({ id: fileId })
      .update({
        deleted_at: db.fn.now(),
      });

    // Delete physical file
    try {
      const filepath = path.join('uploads/patterns', file.filename);
      if (fs.existsSync(filepath)) await unlinkAsync(filepath);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Continue even if file deletion fails
    }

    res.json({
      success: true,
      message: 'Pattern file deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting pattern file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete pattern file',
    });
  }
};

// Download pattern file
export const downloadPatternFile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { patternId, fileId } = req.params;

    // Verify pattern exists and belongs to user
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    // Get file
    const file = await db('pattern_files')
      .where({ id: fileId, pattern_id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const filepath = path.join('uploads/patterns', file.filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server',
      });
    }

    // Set headers for download
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Error downloading pattern file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download pattern file',
    });
  }
};

// ============================================
// YARN PHOTO UPLOAD FUNCTIONS
// ============================================

// Upload yarn photo
export const uploadYarnPhoto = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { yarnId } = req.params;

    // Verify yarn exists and belongs to user
    const yarn = await db('yarn')
      .where({ id: yarnId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!yarn) {
      return res.status(404).json({
        success: false,
        message: 'Yarn not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const timestamp = Date.now();
    const filename = `yarn-${yarnId}-${timestamp}.webp`;
    const thumbnailFilename = `yarn-${yarnId}-${timestamp}-thumb.webp`;

    const filepath = path.join('uploads/yarn', filename);
    const thumbnailPath = path.join('uploads/yarn/thumbnails', thumbnailFilename);

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
    const [photo] = await db('yarn_photos')
      .insert({
        yarn_id: yarnId,
        user_id: userId,
        filename: filename,
        thumbnail_filename: thumbnailFilename,
        original_filename: req.file.originalname,
        file_path: `/uploads/yarn/${filename}`,
        thumbnail_path: `/uploads/yarn/thumbnails/${thumbnailFilename}`,
        mime_type: 'image/webp',
        size: req.file.size,
        width: metadata.width,
        height: metadata.height,
        caption: req.body.caption || null,
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Yarn photo uploaded successfully',
      data: { photo },
    });
  } catch (error: any) {
    console.error('Yarn photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload yarn photo',
      error: error.message,
    });
  }
};

// Get yarn photos
export const getYarnPhotos = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { yarnId } = req.params;

    // Verify yarn exists and belongs to user
    const yarn = await db('yarn')
      .where({ id: yarnId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!yarn) {
      return res.status(404).json({
        success: false,
        message: 'Yarn not found',
      });
    }

    const photos = await db('yarn_photos')
      .where({ yarn_id: yarnId })
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: { photos },
    });
  } catch (error: any) {
    console.error('Error fetching yarn photos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch yarn photos',
    });
  }
};

// Delete yarn photo
export const deleteYarnPhoto = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { yarnId, photoId } = req.params;

    // Verify yarn exists and belongs to user
    const yarn = await db('yarn')
      .where({ id: yarnId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!yarn) {
      return res.status(404).json({
        success: false,
        message: 'Yarn not found',
      });
    }

    // Get photo
    const photo = await db('yarn_photos')
      .where({ id: photoId, yarn_id: yarnId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found',
      });
    }

    // Soft delete
    await db('yarn_photos')
      .where({ id: photoId })
      .update({
        deleted_at: db.fn.now(),
      });

    // Delete physical files
    try {
      const filepath = path.join('uploads/yarn', photo.filename);
      const thumbnailPath = path.join('uploads/yarn/thumbnails', photo.thumbnail_filename);

      if (fs.existsSync(filepath)) await unlinkAsync(filepath);
      if (fs.existsSync(thumbnailPath)) await unlinkAsync(thumbnailPath);
    } catch (fileError) {
      console.error('Error deleting files:', fileError);
      // Continue even if file deletion fails
    }

    res.json({
      success: true,
      message: 'Yarn photo deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting yarn photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete yarn photo',
    });
  }
};

// Export middleware for different upload types
export const uploadImageMiddleware = imageUpload.single('photo');
export const uploadPatternFileMiddleware = patternFileUpload.single('file');
