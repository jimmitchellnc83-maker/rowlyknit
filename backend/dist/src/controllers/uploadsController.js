"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadHandwrittenMiddleware = exports.uploadAudioMiddleware = exports.uploadPatternFileMiddleware = exports.uploadImageMiddleware = exports.deleteYarnPhoto = exports.getYarnPhotos = exports.uploadPatternThumbnailFromUrl = exports.uploadYarnPhotoFromUrl = exports.uploadYarnPhoto = exports.downloadPatternFile = exports.deletePatternFile = exports.getPatternFiles = exports.uploadPatternFile = exports.deleteProjectPhoto = exports.getProjectPhotos = exports.uploadProjectPhoto = void 0;
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const util_1 = require("util");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const inputSanitizer_1 = require("../utils/inputSanitizer");
const unlinkAsync = (0, util_1.promisify)(fs_1.default.unlink);
// Configure multer for image uploads (project/yarn photos)
const imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    },
});
// Configure multer for pattern files (PDFs, images, documents)
const patternFileUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, images, and documents are allowed.`));
        }
    },
});
// Configure multer for audio note uploads
const audioUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/webm',
            'audio/mp3',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/m4a',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
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
        'uploads/audio',
    ];
    dirs.forEach(dir => {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    });
};
ensureUploadDirs();
// Upload project photo
const uploadProjectPhoto = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;
        // Verify project exists and belongs to user
        const project = await (0, database_1.default)('projects')
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
        const filepath = path_1.default.join('uploads/projects', filename);
        const thumbnailPath = path_1.default.join('uploads/projects/thumbnails', thumbnailFilename);
        // Process and save original image as WebP
        await (0, sharp_1.default)(req.file.buffer)
            .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);
        // Generate thumbnail
        await (0, sharp_1.default)(req.file.buffer)
            .resize(400, 400, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(thumbnailPath);
        // Get image metadata
        const metadata = await (0, sharp_1.default)(req.file.buffer).metadata();
        // Save to database
        const [photo] = await (0, database_1.default)('project_photos')
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
    }
    catch (error) {
        logger_1.default.error('Upload error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to upload photo',
            error: error.message,
        });
    }
};
exports.uploadProjectPhoto = uploadProjectPhoto;
// Get project photos
const getProjectPhotos = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId } = req.params;
        // Verify project exists and belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found',
            });
        }
        const photos = await (0, database_1.default)('project_photos')
            .where({ project_id: projectId })
            .whereNull('deleted_at')
            .orderBy('created_at', 'desc');
        res.json({
            success: true,
            data: { photos },
        });
    }
    catch (error) {
        logger_1.default.error('Error fetching photos', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch photos',
        });
    }
};
exports.getProjectPhotos = getProjectPhotos;
// Delete project photo
const deleteProjectPhoto = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { projectId, photoId } = req.params;
        // Verify project exists and belongs to user
        const project = await (0, database_1.default)('projects')
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
        const photo = await (0, database_1.default)('project_photos')
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
        await (0, database_1.default)('project_photos')
            .where({ id: photoId })
            .update({
            deleted_at: database_1.default.fn.now(),
        });
        // Delete physical files
        try {
            const filepath = path_1.default.join(photo.filename);
            const thumbnailPath = path_1.default.join('uploads/projects/thumbnails', photo.thumbnail_filename);
            if (fs_1.default.existsSync(filepath))
                await unlinkAsync(filepath);
            if (fs_1.default.existsSync(thumbnailPath))
                await unlinkAsync(thumbnailPath);
        }
        catch (fileError) {
            logger_1.default.error('Error deleting files', { error: fileError.message });
            // Continue even if file deletion fails
        }
        res.json({
            success: true,
            message: 'Photo deleted successfully',
        });
    }
    catch (error) {
        logger_1.default.error('Error deleting photo', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to delete photo',
        });
    }
};
exports.deleteProjectPhoto = deleteProjectPhoto;
// ============================================
// PATTERN FILE UPLOAD FUNCTIONS
// ============================================
// Helper function to determine file type
const getFileType = (mimetype, filename) => {
    // Check MIME type first
    if (mimetype === 'application/pdf' || mimetype.includes('pdf'))
        return 'pdf';
    if (mimetype.startsWith('image/'))
        return 'image';
    if (mimetype.includes('word') || mimetype === 'text/plain')
        return 'document';
    // Fallback to file extension if MIME type is not recognized
    if (filename) {
        const ext = filename.toLowerCase();
        if (ext.endsWith('.pdf'))
            return 'pdf';
        if (ext.match(/\.(jpg|jpeg|png|webp|gif)$/))
            return 'image';
        if (ext.match(/\.(doc|docx|txt)$/))
            return 'document';
    }
    return 'other';
};
// Upload pattern file
const uploadPatternFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { patternId } = req.params;
        // Verify pattern exists and belongs to user
        const pattern = await (0, database_1.default)('patterns')
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
        const ext = path_1.default.extname(req.file.originalname) || '.pdf';
        const filename = `pattern-${patternId}-${timestamp}${ext}`;
        const filepath = path_1.default.join('uploads/patterns', filename);
        // Save the file
        await fs_1.default.promises.writeFile(filepath, req.file.buffer);
        // Determine file type
        const fileType = getFileType(req.file.mimetype, req.file.originalname);
        // Save to database
        const [file] = await (0, database_1.default)('pattern_files')
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
    }
    catch (error) {
        logger_1.default.error('Pattern file upload error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to upload pattern file',
            error: error.message,
        });
    }
};
exports.uploadPatternFile = uploadPatternFile;
// Get pattern files
const getPatternFiles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { patternId } = req.params;
        // Verify pattern exists and belongs to user
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!pattern) {
            return res.status(404).json({
                success: false,
                message: 'Pattern not found',
            });
        }
        const files = await (0, database_1.default)('pattern_files')
            .where({ pattern_id: patternId })
            .whereNull('deleted_at')
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'desc');
        res.json({
            success: true,
            data: { files },
        });
    }
    catch (error) {
        logger_1.default.error('Error fetching pattern files', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pattern files',
        });
    }
};
exports.getPatternFiles = getPatternFiles;
// Delete pattern file
const deletePatternFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { patternId, fileId } = req.params;
        // Verify pattern exists and belongs to user
        const pattern = await (0, database_1.default)('patterns')
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
        const file = await (0, database_1.default)('pattern_files')
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
        await (0, database_1.default)('pattern_files')
            .where({ id: fileId })
            .update({
            deleted_at: database_1.default.fn.now(),
        });
        // Delete physical file
        try {
            const filepath = path_1.default.join('uploads/patterns', file.filename);
            if (fs_1.default.existsSync(filepath))
                await unlinkAsync(filepath);
        }
        catch (fileError) {
            logger_1.default.error('Error deleting file', { error: fileError.message });
            // Continue even if file deletion fails
        }
        res.json({
            success: true,
            message: 'Pattern file deleted successfully',
        });
    }
    catch (error) {
        logger_1.default.error('Error deleting pattern file', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to delete pattern file',
        });
    }
};
exports.deletePatternFile = deletePatternFile;
// Download pattern file
const downloadPatternFile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { patternId, fileId } = req.params;
        // Verify pattern exists and belongs to user
        const pattern = await (0, database_1.default)('patterns')
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
        const file = await (0, database_1.default)('pattern_files')
            .where({ id: fileId, pattern_id: patternId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found',
            });
        }
        const filepath = path_1.default.join('uploads/patterns', file.filename);
        if (!fs_1.default.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server',
            });
        }
        // Set headers for download/viewing
        res.setHeader('Content-Type', file.mime_type);
        // Sanitize filename to prevent header injection attacks
        const sanitizedFilename = (0, inputSanitizer_1.sanitizeHeaderValue)(file.original_filename);
        // Use inline disposition for PDFs and images to allow browser viewing
        // Use attachment for other file types to trigger download
        const forceDownload = req.query.download === 'true';
        const isViewableInBrowser = file.file_type === 'pdf' || file.file_type === 'image';
        if (isViewableInBrowser && !forceDownload) {
            res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
        }
        else {
            res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
        }
        // Stream the file
        const fileStream = fs_1.default.createReadStream(filepath);
        fileStream.pipe(res);
    }
    catch (error) {
        logger_1.default.error('Error downloading pattern file', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to download pattern file',
        });
    }
};
exports.downloadPatternFile = downloadPatternFile;
// ============================================
// YARN PHOTO UPLOAD FUNCTIONS
// ============================================
// Upload yarn photo
const uploadYarnPhoto = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { yarnId } = req.params;
        // Verify yarn exists and belongs to user
        const yarn = await (0, database_1.default)('yarn')
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
        const filepath = path_1.default.join('uploads/yarn', filename);
        const thumbnailPath = path_1.default.join('uploads/yarn/thumbnails', thumbnailFilename);
        // Process and save original image as WebP
        await (0, sharp_1.default)(req.file.buffer)
            .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);
        // Generate thumbnail
        await (0, sharp_1.default)(req.file.buffer)
            .resize(400, 400, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(thumbnailPath);
        // Get image metadata
        const metadata = await (0, sharp_1.default)(req.file.buffer).metadata();
        // Save to database
        const [photo] = await (0, database_1.default)('yarn_photos')
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
    }
    catch (error) {
        logger_1.default.error('Yarn photo upload error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to upload yarn photo',
            error: error.message,
        });
    }
};
exports.uploadYarnPhoto = uploadYarnPhoto;
// Upload yarn photo from external URL (e.g. Ravelry)
const uploadYarnPhotoFromUrl = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { yarnId } = req.params;
        const { photoUrl } = req.body;
        if (!photoUrl || typeof photoUrl !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Photo URL is required',
            });
        }
        try {
            const parsedUrl = new URL(photoUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid protocol');
            }
        }
        catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid photo URL',
            });
        }
        const yarn = await (0, database_1.default)('yarn')
            .where({ id: yarnId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!yarn) {
            return res.status(404).json({ success: false, message: 'Yarn not found' });
        }
        const imageResponse = await axios_1.default.get(photoUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: 10 * 1024 * 1024,
            headers: { 'User-Agent': 'Rowly/1.0' },
        });
        const buffer = Buffer.from(imageResponse.data);
        const metadata = await (0, sharp_1.default)(buffer).metadata();
        if (!metadata.width || !metadata.height) {
            return res.status(400).json({ success: false, message: 'Invalid image' });
        }
        const timestamp = Date.now();
        const filename = `yarn-${yarnId}-${timestamp}.webp`;
        const thumbnailFilename = `yarn-${yarnId}-${timestamp}-thumb.webp`;
        const filepath = path_1.default.join('uploads/yarn', filename);
        const thumbnailPath = path_1.default.join('uploads/yarn/thumbnails', thumbnailFilename);
        await (0, sharp_1.default)(buffer)
            .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);
        await (0, sharp_1.default)(buffer)
            .resize(400, 400, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(thumbnailPath);
        const [photo] = await (0, database_1.default)('yarn_photos')
            .insert({
            yarn_id: yarnId,
            user_id: userId,
            filename,
            thumbnail_filename: thumbnailFilename,
            original_filename: 'ravelry-import.webp',
            file_path: `/uploads/yarn/${filename}`,
            thumbnail_path: `/uploads/yarn/thumbnails/${thumbnailFilename}`,
            mime_type: 'image/webp',
            size: buffer.length,
            width: metadata.width,
            height: metadata.height,
            caption: 'Imported from Ravelry',
        })
            .returning('*');
        res.status(201).json({
            success: true,
            message: 'Yarn photo imported successfully',
            data: { photo },
        });
    }
    catch (error) {
        logger_1.default.error('Yarn photo URL import error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to import photo from URL',
            error: error.message,
        });
    }
};
exports.uploadYarnPhotoFromUrl = uploadYarnPhotoFromUrl;
// Upload pattern thumbnail from external URL (e.g. Ravelry)
const uploadPatternThumbnailFromUrl = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { patternId } = req.params;
        const { photoUrl } = req.body;
        if (!photoUrl || typeof photoUrl !== 'string') {
            return res.status(400).json({ success: false, message: 'Photo URL is required' });
        }
        try {
            const parsedUrl = new URL(photoUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid protocol');
            }
        }
        catch {
            return res.status(400).json({ success: false, message: 'Invalid photo URL' });
        }
        const pattern = await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!pattern) {
            return res.status(404).json({ success: false, message: 'Pattern not found' });
        }
        const imageResponse = await axios_1.default.get(photoUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: 10 * 1024 * 1024,
            headers: { 'User-Agent': 'Rowly/1.0' },
        });
        const buffer = Buffer.from(imageResponse.data);
        const metadata = await (0, sharp_1.default)(buffer).metadata();
        if (!metadata.width || !metadata.height) {
            return res.status(400).json({ success: false, message: 'Invalid image' });
        }
        const timestamp = Date.now();
        const filename = `pattern-${patternId}-${timestamp}.webp`;
        const filepath = path_1.default.join('uploads/patterns', filename);
        await (0, sharp_1.default)(buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);
        const thumbnailUrl = `/uploads/patterns/${filename}`;
        await (0, database_1.default)('patterns')
            .where({ id: patternId, user_id: userId })
            .update({ thumbnail_url: thumbnailUrl, updated_at: database_1.default.fn.now() });
        res.status(201).json({
            success: true,
            message: 'Pattern thumbnail imported successfully',
            data: { thumbnailUrl },
        });
    }
    catch (error) {
        logger_1.default.error('Pattern thumbnail URL import error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Failed to import pattern thumbnail',
            error: error.message,
        });
    }
};
exports.uploadPatternThumbnailFromUrl = uploadPatternThumbnailFromUrl;
// Get yarn photos
const getYarnPhotos = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { yarnId } = req.params;
        // Verify yarn exists and belongs to user
        const yarn = await (0, database_1.default)('yarn')
            .where({ id: yarnId, user_id: userId })
            .whereNull('deleted_at')
            .first();
        if (!yarn) {
            return res.status(404).json({
                success: false,
                message: 'Yarn not found',
            });
        }
        const photos = await (0, database_1.default)('yarn_photos')
            .where({ yarn_id: yarnId })
            .whereNull('deleted_at')
            .orderBy('sort_order', 'asc')
            .orderBy('created_at', 'desc');
        res.json({
            success: true,
            data: { photos },
        });
    }
    catch (error) {
        logger_1.default.error('Error fetching yarn photos', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to fetch yarn photos',
        });
    }
};
exports.getYarnPhotos = getYarnPhotos;
// Delete yarn photo
const deleteYarnPhoto = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { yarnId, photoId } = req.params;
        // Verify yarn exists and belongs to user
        const yarn = await (0, database_1.default)('yarn')
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
        const photo = await (0, database_1.default)('yarn_photos')
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
        await (0, database_1.default)('yarn_photos')
            .where({ id: photoId })
            .update({
            deleted_at: database_1.default.fn.now(),
        });
        // Delete physical files
        try {
            const filepath = path_1.default.join('uploads/yarn', photo.filename);
            const thumbnailPath = path_1.default.join('uploads/yarn/thumbnails', photo.thumbnail_filename);
            if (fs_1.default.existsSync(filepath))
                await unlinkAsync(filepath);
            if (fs_1.default.existsSync(thumbnailPath))
                await unlinkAsync(thumbnailPath);
        }
        catch (fileError) {
            logger_1.default.error('Error deleting files', { error: fileError.message });
            // Continue even if file deletion fails
        }
        res.json({
            success: true,
            message: 'Yarn photo deleted successfully',
        });
    }
    catch (error) {
        logger_1.default.error('Error deleting yarn photo', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: 'Failed to delete yarn photo',
        });
    }
};
exports.deleteYarnPhoto = deleteYarnPhoto;
// Export middleware for different upload types
exports.uploadImageMiddleware = imageUpload.single('photo');
exports.uploadPatternFileMiddleware = patternFileUpload.single('file');
exports.uploadAudioMiddleware = audioUpload.single('audio');
exports.uploadHandwrittenMiddleware = imageUpload.single('image');
