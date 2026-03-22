import { useState, useCallback } from 'react';
import { uploadProfileImage, type UploadResult } from '@/lib/aws';

export const useS3Upload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAvatar = useCallback(async (file: File, userId?: string): Promise<UploadResult | null> => {
    setIsUploading(true);
    setError(null);
    try {
      return await uploadProfileImage(file, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { isUploading, error, uploadAvatar };
};
