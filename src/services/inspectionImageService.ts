import { api } from './api';

export interface InspectionImageUploadResponse {
  id: string; // The UUID or ID from the DB
  s3Key: string;
  isAnnotated: boolean;
  sortOrder: number;
  caption?: string;
  url?: string;
}

export const inspectionImageService = {
  /**
   * Uploads an image (either original or annotated) to the backend.
   * Uses multipart/form-data.
   */
  uploadImage: async (
    resultId: number | string,
    file: File,
    metadata: {
      isAnnotated: boolean;
      sortOrder: number;
      caption: string;
    }
  ): Promise<InspectionImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resultId', resultId.toString());
    formData.append('isAnnotated', metadata.isAnnotated.toString());
    formData.append('sortOrder', metadata.sortOrder.toString());
    if (metadata.caption) {
      formData.append('caption', metadata.caption);
    }

    // api.postFormData assumes an implementation that sets the correct headers for FormData
    // Since 'api.ts' might only have json post, we use native fetch if postFormData isn't available,
    // or standard api.post if it's configured to handle FormData automatically.
    // For now, we'll implement a custom fetch just in case `api` doesn't handle FormData well.
    // Extract auth token using the same logic as API Client
    let token = null;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        token = parsed?.state?.idToken || parsed?.state?.accessToken || null;
      }
    } catch (e) {
      console.error('Failed to parse auth token', e);
    }

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/inspection-images`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload inspection image');
    }

    const data = await response.json();
    return data.object as InspectionImageUploadResponse;
  },

  /**
   * Deletes an uploaded image from the backend.
   */
  deleteImage: async (imageId: string): Promise<void> => {
    const res = await api.delete(`/inspection-images/${imageId}`);
    if (!(res as any).status) {
      throw new Error('Failed to delete inspection image');
    }
  }
};
