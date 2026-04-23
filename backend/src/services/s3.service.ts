import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// Check if S3 is configured
const isS3Configured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

// Local uploads directory (fallback for development)
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Initialize S3 client (only used when S3 is configured)
const s3Client = isS3Configured
  ? new S3Client({
      region: process.env.AWS_S3_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    })
  : (null as unknown as S3Client);

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'hello-team-s3-live';

if (!isS3Configured) {
  console.warn('AWS S3 credentials not configured. Using local file storage fallback.');
}

// Allowed image types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Save file locally (development fallback)
 */
const saveLocally = (file: Express.Multer.File, folder: string): { url: string; key: string } => {
  const fileExtension = file.originalname.split('.').pop();
  const uniqueFilename = `${uuidv4()}.${fileExtension}`;
  const folderPath = path.join(UPLOADS_DIR, folder);

  // Ensure directory exists
  fs.mkdirSync(folderPath, { recursive: true });

  const filePath = path.join(folderPath, uniqueFilename);
  fs.writeFileSync(filePath, file.buffer);

  const key = `${folder}/${uniqueFilename}`;
  const url = `${API_BASE_URL}/uploads/${key}`;

  return { url, key };
};

/**
 * Upload a file to S3
 */
export const uploadToS3 = async (
  file: Express.Multer.File,
  folder: string = 'profile-photos'
): Promise<UploadResult> => {
  try {
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        success: false,
        error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF',
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File too large. Maximum size is 5MB',
      };
    }

    // Use local storage fallback if S3 is not configured
    if (!isS3Configured) {
      const { url, key } = saveLocally(file, folder);
      return { success: true, url, key };
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const uniqueFilename = `${folder}/${uuidv4()}.${fileExtension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);

    // Generate presigned URL (valid for 7 days)
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
    });
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 7 days

    return {
      success: true,
      url,
      key: uniqueFilename,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: 'Failed to upload file to S3',
    };
  }
};

/**
 * Delete a file from S3
 */
export const deleteFromS3 = async (key: string): Promise<boolean> => {
  try {
    if (!isS3Configured) {
      const filePath = path.join(UPLOADS_DIR, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
};

/**
 * Extract S3 key from URL
 */
export const getKeyFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
};

/**
 * Generate a presigned URL for an existing S3 object
 */
export const getPresignedUrl = async (key: string, expiresIn: number = 604800): Promise<string | null> => {
  try {
    if (!isS3Configured) {
      // Local files don't need presigned URLs
      return `${API_BASE_URL}/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return null;
  }
};

/**
 * Generate presigned URL from a stored URL
 */
export const refreshPresignedUrl = async (storedUrl: string): Promise<string | null> => {
  if (!isS3Configured) {
    return storedUrl; // Local URLs don't expire
  }

  // Check if it's an S3 URL from our bucket
  if (!storedUrl.includes(BUCKET_NAME) && !storedUrl.includes('profile-photos/')) {
    return storedUrl; // Return as-is if not an S3 URL
  }

  const key = getKeyFromUrl(storedUrl);
  if (!key) return storedUrl;

  return await getPresignedUrl(key);
};

// Government ID upload - supports images + PDF, 10MB limit
const GOV_ID_ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
];
const GOV_ID_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const uploadGovernmentIdFile = async (
  file: Express.Multer.File
): Promise<UploadResult> => {
  try {
    if (!GOV_ID_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        success: false,
        error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF',
      };
    }

    if (file.size > GOV_ID_MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File too large. Maximum size is 10MB',
      };
    }

    // Use local storage fallback if S3 is not configured
    if (!isS3Configured) {
      const { url, key } = saveLocally(file, 'government-ids');
      return { success: true, url, key };
    }

    const fileExtension = file.originalname.split('.').pop();
    const uniqueFilename = `government-ids/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
    });
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 });

    return {
      success: true,
      url,
      key: uniqueFilename,
    };
  } catch (error) {
    console.error('S3 government ID upload error:', error);
    return {
      success: false,
      error: 'Failed to upload government ID to S3',
    };
  }
};

// Chat file upload - supports broader MIME types and larger files
const CHAT_ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  // Audio
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
  // Video
  'video/webm', 'video/mp4',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];
const CHAT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const uploadChatFile = async (
  file: Express.Multer.File
): Promise<UploadResult & { fileName?: string; fileSize?: number; fileMimeType?: string }> => {
  try {
    if (!CHAT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        success: false,
        error: 'File type not supported for chat',
      };
    }

    if (file.size > CHAT_MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File too large. Maximum size is 25MB',
      };
    }

    // Use local storage fallback if S3 is not configured
    if (!isS3Configured) {
      const { url, key } = saveLocally(file, 'chat-attachments');
      return {
        success: true,
        url,
        key,
        fileName: file.originalname,
        fileSize: file.size,
        fileMimeType: file.mimetype,
      };
    }

    const fileExtension = file.originalname.split('.').pop();
    const uniqueFilename = `chat-attachments/${uuidv4()}.${fileExtension}`;

    const isInlineType = file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: isInlineType ? 'inline' : `attachment; filename="${file.originalname}"`,
    });

    await s3Client.send(command);

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
      ResponseContentType: file.mimetype,
    });
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 });

    return {
      success: true,
      url,
      key: uniqueFilename,
      fileName: file.originalname,
      fileSize: file.size,
      fileMimeType: file.mimetype,
    };
  } catch (error) {
    console.error('S3 chat upload error:', error);
    return {
      success: false,
      error: 'Failed to upload chat file to S3',
    };
  }
};

/**
 * Stream a file from S3 directly as a Node.js Readable.
 * Use this to proxy S3 content through the backend to avoid browser CORS issues.
 */
export const streamFromS3 = async (key: string): Promise<Readable | null> => {
  if (!isS3Configured) return null;
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    if (!response.Body) return null;
    return response.Body as unknown as Readable;
  } catch (error) {
    console.error('Error streaming from S3:', error);
    return null;
  }
};

// CMS document upload - PDF only, 20MB limit
export const uploadCmsDocument = async (
  file: Express.Multer.File
): Promise<UploadResult> => {
  try {
    if (file.mimetype !== 'application/pdf') {
      return { success: false, error: 'Only PDF files are allowed' };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { success: false, error: 'File too large. Maximum size is 20MB' };
    }

    if (!isS3Configured) {
      const { url, key } = saveLocally(file, 'cms-documents');
      return { success: true, url, key };
    }

    const uniqueFilename = `cms-documents/${uuidv4()}.pdf`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
      Body: file.buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
    });
    await s3Client.send(command);

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFilename,
    });
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 });

    return { success: true, url, key: uniqueFilename };
  } catch (error) {
    console.error('S3 CMS document upload error:', error);
    return { success: false, error: 'Failed to upload document' };
  }
};

export { isS3Configured };

export default {
  uploadToS3,
  uploadGovernmentIdFile,
  uploadChatFile,
  uploadCmsDocument,
  streamFromS3,
  deleteFromS3,
  getKeyFromUrl,
  getPresignedUrl,
  refreshPresignedUrl,
};
