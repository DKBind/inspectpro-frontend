import { useRef, useCallback, type ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import { useS3Upload } from '@/hooks/useS3Upload';
import type { UploadResult } from '@/lib/aws';
import styles from './AvatarUpload.module.css';

export interface AvatarUploadProps {
  currentUrl?: string | null;
  initials?: string;
  userId?: string;
  onUploadComplete?: (url: string, result: UploadResult) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const AvatarUpload = ({
  currentUrl,
  initials = 'U',
  userId,
  onUploadComplete,
  onError,
  disabled = false,
}: AvatarUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isUploading, error, uploadAvatar } = useS3Upload();

  const handleChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      const result = await uploadAvatar(file, userId);
      if (result) {
        onUploadComplete?.(result.url, result);
      } else if (error) {
        onError?.(error);
      }
    },
    [userId, uploadAvatar, onUploadComplete, onError, error],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={styles.avatarUpload}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      title="Change profile photo"
    >
      {currentUrl ? (
        <img src={currentUrl} alt="Profile" className={styles.avatarImage} />
      ) : (
        <div className={styles.avatarInitials}>{initials}</div>
      )}

      {!isUploading && (
        <div className={styles.avatarOverlay}>
          <Camera />
        </div>
      )}

      {isUploading && (
        <div className={styles.avatarSpinner}>
          <div className={styles.spinner} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
};

export default AvatarUpload;
