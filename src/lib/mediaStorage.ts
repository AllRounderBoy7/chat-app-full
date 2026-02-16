// Media Storage using Origin Private File System (OPFS) and Blob Storage
import imageCompression from 'browser-image-compression';
import { encode as encodeBlurHash } from 'blurhash';
import { db, type DBMediaFile } from './database';

// OPFS Root Directory
let opfsRoot: FileSystemDirectoryHandle | null = null;

export async function initMediaStorage(): Promise<void> {
  try {
    opfsRoot = await navigator.storage.getDirectory();
    
    // Create subdirectories
    await opfsRoot.getDirectoryHandle('images', { create: true });
    await opfsRoot.getDirectoryHandle('videos', { create: true });
    await opfsRoot.getDirectoryHandle('audio', { create: true });
    await opfsRoot.getDirectoryHandle('documents', { create: true });
    await opfsRoot.getDirectoryHandle('thumbnails', { create: true });
    
    console.log('OPFS initialized successfully');
  } catch (error) {
    console.error('OPFS not supported, falling back to IndexedDB:', error);
  }
}

// Image compression options
const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg' as const
};

const THUMBNAIL_OPTIONS = {
  maxSizeMB: 0.05,
  maxWidthOrHeight: 200,
  useWebWorker: true,
  fileType: 'image/jpeg' as const
};

// Compress image before upload
export async function compressImage(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
    console.log(`Compressed image from ${file.size} to ${compressed.size} bytes`);
    return compressed;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file;
  }
}

// Generate thumbnail
export async function generateThumbnail(file: File): Promise<string> {
  try {
    const thumbnail = await imageCompression(file, THUMBNAIL_OPTIONS);
    return await fileToBase64(thumbnail);
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return '';
  }
}

// Generate BlurHash for instant preview
export async function generateBlurHash(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      const width = 32;
      const height = Math.round((img.height / img.width) * 32);
      canvas.width = width;
      canvas.height = height;
      
      ctx?.drawImage(img, 0, 0, width, height);
      const imageData = ctx?.getImageData(0, 0, width, height);
      
      if (imageData) {
        const hash = encodeBlurHash(imageData.data, width, height, 4, 3);
        resolve(hash);
      } else {
        resolve('');
      }
      
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      resolve('');
      URL.revokeObjectURL(img.src);
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Convert file to base64
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Store file in OPFS
export async function storeFileInOPFS(
  file: File | Blob,
  fileId: string,
  type: 'images' | 'videos' | 'audio' | 'documents' | 'thumbnails'
): Promise<string | null> {
  if (!opfsRoot) {
    console.warn('OPFS not available');
    return null;
  }
  
  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(type, { create: true });
    const fileHandle = await dirHandle.getFileHandle(fileId, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    
    return `opfs://${type}/${fileId}`;
  } catch (error) {
    console.error('Failed to store file in OPFS:', error);
    return null;
  }
}

// Get file from OPFS
export async function getFileFromOPFS(
  fileId: string,
  type: 'images' | 'videos' | 'audio' | 'documents' | 'thumbnails'
): Promise<File | null> {
  if (!opfsRoot) {
    return null;
  }
  
  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(type);
    const fileHandle = await dirHandle.getFileHandle(fileId);
    return await fileHandle.getFile();
  } catch (error) {
    console.error('Failed to get file from OPFS:', error);
    return null;
  }
}

// Delete file from OPFS
export async function deleteFileFromOPFS(
  fileId: string,
  type: 'images' | 'videos' | 'audio' | 'documents' | 'thumbnails'
): Promise<boolean> {
  if (!opfsRoot) {
    return false;
  }
  
  try {
    const dirHandle = await opfsRoot.getDirectoryHandle(type);
    await dirHandle.removeEntry(fileId);
    return true;
  } catch (error) {
    console.error('Failed to delete file from OPFS:', error);
    return false;
  }
}

// Save media to device Downloads folder
export async function saveToDevice(file: File | Blob, filename: string): Promise<boolean> {
  try {
    // Try File System Access API first
    if ('showSaveFilePicker' in window) {
      const handle = await (window as Window & { showSaveFilePicker: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Files',
          accept: {
            [file.type || 'application/octet-stream']: [`.${filename.split('.').pop() || 'bin'}`]
          }
        }]
      });
      
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return true;
    }
    
    // Fallback to download anchor
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Failed to save file to device:', error);
    return false;
  }
}

// Process and store media file with all optimizations
export async function processAndStoreMedia(
  file: File,
  messageId?: string,
  storyId?: string
): Promise<DBMediaFile> {
  const fileId = crypto.randomUUID();
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  
  let processedFile = file;
  let thumbnail = '';
  
  // Compress images
  if (isImage) {
    processedFile = await compressImage(file);
    thumbnail = await generateBlurHash(file);
  }
  
  // Generate video thumbnail (first frame)
  if (isVideo) {
    thumbnail = await generateVideoThumbnail(file);
  }
  
  // Store in OPFS
  const type = isImage ? 'images' : isVideo ? 'videos' : file.type.startsWith('audio/') ? 'audio' : 'documents';
  const localPath = await storeFileInOPFS(processedFile, fileId, type);
  
  // Create media file record
  const mediaFile: DBMediaFile = {
    id: fileId,
    messageId,
    storyId,
    type: isImage ? 'image' : isVideo ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document',
    mimeType: processedFile.type,
    size: processedFile.size,
    name: file.name,
    thumbnail,
    localPath: localPath || undefined,
    isDownloaded: true,
    downloadProgress: 100,
    createdAt: Date.now()
  };
  
  // Store in IndexedDB
  await db.mediaFiles.add(mediaFile);
  
  return mediaFile;
}

// Generate video thumbnail from first frame
export async function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = () => {
      video.currentTime = 0.5; // Get frame at 0.5 seconds
    };
    
    video.onseeked = () => {
      canvas.width = 200;
      canvas.height = (video.videoHeight / video.videoWidth) * 200;
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      resolve('');
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(file);
  });
}

// Get total media storage size
export async function getMediaStorageSize(): Promise<number> {
  const files = await db.mediaFiles.toArray();
  return files.reduce((total, file) => total + file.size, 0);
}

// Clear all downloaded media
export async function clearMediaStorage(): Promise<void> {
  if (opfsRoot) {
    const dirs = ['images', 'videos', 'audio', 'documents', 'thumbnails'];
    for (const dir of dirs) {
      try {
        const dirHandle = await opfsRoot.getDirectoryHandle(dir);
        // @ts-expect-error - entries() is not in types yet
        for await (const [name] of dirHandle.entries()) {
          await dirHandle.removeEntry(name);
        }
      } catch (error) {
        console.error(`Failed to clear ${dir}:`, error);
      }
    }
  }
  
  await db.mediaFiles.clear();
}
