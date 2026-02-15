import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'hello-team-s3-live';

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
  // Check if it's an S3 URL from our bucket
  if (!storedUrl.includes(BUCKET_NAME) && !storedUrl.includes('profile-photos/')) {
    return storedUrl; // Return as-is if not an S3 URL
  }

  const key = getKeyFromUrl(storedUrl);
  if (!key) return storedUrl;

  return await getPresignedUrl(key);
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

    const fileExtension = file.originalname.split('.').pop();
    const uniqueFilename = `chat-attachments/${uuidv4()}.${fileExtension}`;

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

export default {
  uploadToS3,
  uploadChatFile,
  deleteFromS3,
  getKeyFromUrl,
  getPresignedUrl,
  refreshPresignedUrl,
};
