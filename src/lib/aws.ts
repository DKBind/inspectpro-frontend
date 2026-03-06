import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// To be used for client side uploads directly to S3
// Note: In a real-world scenario with secure credentials, 
// you would typically fetch a pre-signed URL from your backend
// and use that to upload to S3 from the frontend, rather than 
// exposing AWS credentials in the frontend code.

// Defaulting to empty strings - these would need to be populated in .env if doing direct uploads
const REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';
const BUCKET = import.meta.env.VITE_AWS_S3_BUCKET || '';
const ACCESS_KEY_ID = import.meta.env.VITE_AWS_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '';

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

export const uploadFileToS3 = async (file: File, folderPath: string = 'uploads'): Promise<string> => {
  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    console.warn('AWS credentials are not configured. Returning mock URL.');
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${folderPath}/${file.name}`;
  }

  const fileName = `${Date.now()}-${file.name.replace(/\\s+/g, '-')}`;
  const key = `${folderPath}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: file.type,
    // Add ACL if needed based on your S3 bucket settings, e.g., ACL: 'public-read'
  });

  try {
    await s3Client.send(command);
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};
