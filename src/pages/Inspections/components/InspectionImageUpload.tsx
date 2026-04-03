import React, { useState, useRef, useEffect } from 'react';
import { Edit2, RefreshCw, Trash2, X, Loader2, CheckCircle2, Plus } from 'lucide-react';
import FilerobotImageEditor from 'react-filerobot-image-editor';
import { motion, AnimatePresence } from 'framer-motion';
import { inspectionImageService } from '../../../services/inspectionImageService';
import type { InspectionImageUploadResponse } from '../../../services/inspectionImageService';
import { toast } from 'sonner';
import './InspectionImageUpload.css';

export interface InspectionImageUploadProps {
  resultId: number | string;
  initialImages?: InspectionImageUploadResponse[];
  readOnly?: boolean;
}

export interface LocalImageItem {
  id: string; // Temp local uuid until uploaded, then DB ID
  file?: File; // The raw or annotated File object
  previewUrl: string;
  isAnnotated: boolean;
  caption: string;
  sortOrder: number;
  status: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'ERROR';
  backendId?: string; // ID returned from backend
}

/**
 * InspectionImageUpload
 * Premium image upload component with FilerobotImageEditor (Shapes, arrows, etc.),
 * grid-based UI, Framer Motion animations, and background auto-uploading.
 */
export default function InspectionImageUpload({ resultId, initialImages = [], readOnly = false }: InspectionImageUploadProps) {
  const [images, setImages] = useState<LocalImageItem[]>(initialImages.map(img => ({
    id: img.id,
    previewUrl: img.url || img.s3Key || '', // Ensure we use the presigned URL if available
    isAnnotated: img.isAnnotated,
    caption: img.caption || '',
    sortOrder: img.sortOrder,
    status: 'UPLOADED',
    backendId: img.id
  })));

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filerobot Image Editor states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const retakeInputRef = useRef<HTMLInputElement>(null);
  const [retakeTargetId, setRetakeTargetId] = useState<string | null>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
  }, [images]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    e.target.value = '';

    const newItems: LocalImageItem[] = files.map((file, idx) => {
      const tempId = crypto.randomUUID();
      return {
        id: tempId,
        file,
        previewUrl: URL.createObjectURL(file),
        isAnnotated: false,
        caption: '',
        sortOrder: images.length + idx,
        status: 'PENDING'
      };
    });

    setImages(prev => [...prev, ...newItems]);
    newItems.forEach(item => uploadImage(item));
  };

  const handleRetakeSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !retakeTargetId) return;
    const file = e.target.files[0];
    e.target.value = '';

    setImages(prev => prev.map(img => {
      if (img.id === retakeTargetId) {
        if (img.backendId) {
          inspectionImageService.deleteImage(img.backendId).catch(console.error);
        }
        if (img.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.previewUrl);
        }
        const updated: LocalImageItem = {
          ...img,
          file,
          previewUrl: URL.createObjectURL(file),
          isAnnotated: false,
          status: 'PENDING',
          backendId: undefined
        };
        uploadImage(updated);
        return updated;
      }
      return img;
    }));
    setRetakeTargetId(null);
  };

  const uploadImage = async (item: LocalImageItem) => {
    if (!item.file) return;
    setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'UPLOADING' } : img));

    try {
      const res = await inspectionImageService.uploadImage(resultId, item.file, {
        isAnnotated: item.isAnnotated,
        sortOrder: item.sortOrder,
        caption: item.caption
      });

      setImages(prev => prev.map(img => img.id === item.id ? {
        ...img,
        status: 'UPLOADED',
        backendId: res.id,
        // Update previewUrl to the one returned from server (presigned)
        previewUrl: res.url || img.previewUrl
      } : img));
    } catch (error) {
      console.error('Auto-upload failed', error);
      toast.error('Failed to upload an image.');
      setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'ERROR' } : img));
    }
  };

  const retryUpload = (id: string) => {
    const item = images.find(i => i.id === id);
    if (item && item.file) {
      uploadImage(item);
    }
  };

  const handleDelete = async (id: string) => {
    const item = images.find(img => img.id === id);
    if (!item) return;

    setImages(prev => prev.filter(img => img.id !== id));
    if (item.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl);
    }
    if (item.backendId) {
      try {
        await inspectionImageService.deleteImage(item.backendId);
      } catch (error) {
        console.error('Delete failed', error);
        toast.error('Failed to delete image on server');
      }
    }
  };

  const triggerRetake = (id: string) => {
    setRetakeTargetId(id);
    retakeInputRef.current?.click();
  };

  const triggerEdit = async (item: LocalImageItem) => {
    if (item.file && ((item.file as any) instanceof File || (item.file as any) instanceof Blob)) {
      // Local file — use it directly
      setEditingFile(item.file);
      setEditingImageId(item.id);
      setEditorOpen(true);
      return;
    }

    // Remote image (S3 via proxy) — fetch with auth token and convert to blob URL
    // so Filerobot can load it without needing an Authorization header in an img src.
    if (item.previewUrl) {
      try {
        let token: string | null = null;
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            token = parsed?.state?.idToken || parsed?.state?.accessToken || null;
          }
        } catch { /* ignore */ }

        let fetchUrl = item.previewUrl;
        if (!item.previewUrl.startsWith('blob:') && !item.previewUrl.startsWith('data:')) {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
          fetchUrl = `${baseUrl}/inspection-images/proxy?url=${encodeURIComponent(item.previewUrl)}`;
        }

        const response = await fetch(fetchUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);

        const blob = await response.blob();
        setEditingFile(new File([blob], 'edit-image.jpg', { type: blob.type || 'image/jpeg' }));
        setEditingImageId(item.id);
        setEditorOpen(true);
        return;
      } catch (err) {
        console.error('Failed to load image for editing', err);
        toast.error('Could not load image for editing.');
        return;
      }
    }

    setEditingImageId(item.id);
    setEditorOpen(true);
  };

  const handleEditorSave = async (editedObject: any) => {
    const blob = editedObject.imageBase64 ? await (await fetch(editedObject.imageBase64)).blob() : editedObject.imageBlob;
    const editedFile = new File([blob], `annotated-${editingImageId}.jpg`, { type: 'image/jpeg' });

    if (!editingImageId) return;
    setEditorOpen(false);

    const editedPreview = URL.createObjectURL(editedFile);

    setImages(prev => prev.map(img => {
      if (img.id === editingImageId) {
        if (img.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.previewUrl);
        }
        const updated: LocalImageItem = {
          ...img,
          file: editedFile,
          previewUrl: editedPreview,
          isAnnotated: true,
          status: 'PENDING'
        };
        if (img.backendId) {
          inspectionImageService.deleteImage(img.backendId).catch(console.error);
        }
        uploadImage(updated);
        return updated;
      }
      return img;
    }));
  };

  return (
    <div className="inspection-image-upload-root">
      <input type="file" ref={fileInputRef} accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={handleFileSelect} />
      <input type="file" ref={retakeInputRef} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleRetakeSelect} />

      <div className="image-grid">
        <AnimatePresence mode="popLayout">
          {images.map((img, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              key={img.id}
              className="image-card"
            >
              <div className="thumbnail-container group">
                <img
                  src={img.previewUrl}
                  alt="Preview"
                  className={`thumbnail ${img.status === 'UPLOADING' ? 'is-uploading' : ''}`}
                  onClick={() => setLightboxIndex(idx)}
                />

                <div className="status-indicator">
                  {img.status === 'UPLOADING' && (
                    <div className="badge-uploading">
                      <Loader2 className="animate-spin" size={16} />
                    </div>
                  )}
                  {img.status === 'UPLOADED' && (
                    <div className="badge-uploaded">
                      <CheckCircle2 size={12} />
                    </div>
                  )}
                  {img.status === 'ERROR' && (
                    <button className="badge-error shadow-lg" onClick={() => retryUpload(img.id)}>
                      Retry
                    </button>
                  )}
                </div>

                {/* Processing Tray (Premium Glassmorphism) */}
                {!readOnly && (
                  <div className="tray-overlay opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="tray-actions flex gap-2">
                      <button
                        onClick={() => triggerEdit(img)}
                        className="hover:scale-110 active:scale-95 transition-transform"
                        title="Markup"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => triggerRetake(img.id)}
                        className="hover:scale-110 active:scale-95 transition-transform"
                        title="Retake"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <button
                      className="delete-btn hover:scale-110 active:scale-95 transition-transform"
                      onClick={() => handleDelete(img.id)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {!readOnly && (
                <input
                  className="caption-field focus:ring-2 focus:ring-[#1a7bbd]/20"
                  type="text"
                  placeholder="Add caption..."
                  value={img.caption}
                  onChange={e => setImages(prev => prev.map(i => i.id === img.id ? { ...i, caption: e.target.value } : i))}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {!readOnly && (
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 10px 15px -3px rgba(51, 174, 149, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="add-photo-btn border-[#1a7bbd]/30 hover:border-[#1a7bbd]"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="add-icon-circle shadow-sm border-[#1a7bbd]/20 group-hover:border-[#1a7bbd]/40 transition-colors">
              <Plus size={24} className="text-[#1a7bbd]" />
            </div>
            <span className="text-sm font-semibold text-[#263B4F]">Add Photo</span>
          </motion.button>
        )}
      </div>

      {lightboxIndex !== null && (
        <div className="lightbox-portal animate-in fade-in zoom-in-95 duration-200" onClick={() => setLightboxIndex(null)}>
          <button className="close-lightbox"><X size={32} /></button>
          <div className="lightbox-image-wrap">
            <img src={images[lightboxIndex].previewUrl} alt="Fullscreen" onClick={e => e.stopPropagation()} className="shadow-2xl" />
          </div>
        </div>
      )}

      {editorOpen && editingImageId && (() => {
        const img = images.find(i => i.id === editingImageId);
        let src = '';
        if (editingFile && ((editingFile as any) instanceof File || (editingFile as any) instanceof Blob)) {
          src = URL.createObjectURL(editingFile as File | Blob);
        } else if (img && img.previewUrl) {
          if (img.previewUrl.startsWith('blob:') || img.previewUrl.startsWith('data:')) {
            src = img.previewUrl;
          } else {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
            src = `${baseUrl}/inspection-images/proxy?url=${encodeURIComponent(img.previewUrl)}`;
          }
        }

        if (!src) {
          return (
            <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center gap-4 text-white">
              <p>Image source could not be resolved. Please reload.</p>
              <button className="px-4 py-2 bg-white text-black font-semibold rounded" onClick={() => setEditorOpen(false)}>Close</button>
            </div>
          );
        }

        return (
          <div
            className="editor-full-screen-wrapper"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: '#000',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <button
              className="absolute top-4 right-4 z-[100000] text-white p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors"
              onClick={() => setEditorOpen(false)}
            >
              <X size={24} />
            </button>
            <FilerobotImageEditor
              source={src}
              onSave={(editedImageObject: any) => handleEditorSave(editedImageObject)}
              onClose={() => setEditorOpen(false)}
              savingPixelRatio={3}
              previewPixelRatio={window.devicePixelRatio}
            />
          </div>
        );
      })()}

    </div>
  );
}
