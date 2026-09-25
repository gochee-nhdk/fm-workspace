/**
 * Service to handle Image compression, Screen Capture, and Clipboard operations for Notes
 */

export interface ProcessedImage {
  dataUrl: string;
  name: string;
  size: number;
}

/**
 * Format bytes to readable string (e.g. 150 KB, 1.2 MB)
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Compress and resize an image file or blob to prevent browser memory bloat and save storage
 */
export const compressImageFile = async (
  file: File | Blob,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85
): Promise<{ dataUrl: string; size: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Không thể đọc dữ liệu hình ảnh'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: src, size: file.size });
          return;
        }

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Estimate size from base64 length
        const estimatedSize = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

        resolve({
          dataUrl,
          size: estimatedSize > 0 ? estimatedSize : file.size,
        });
      };
      img.onerror = () => reject(new Error('Định dạng hình ảnh không hợp lệ hoặc bị lỗi'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Lỗi khi tải tập tin hình ảnh'));
    reader.readAsDataURL(file);
  });
};

/**
 * Capture current screen / window / tab using standard Web Screen Capture API
 */
export const captureScreenViaMedia = async (): Promise<ProcessedImage | null> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Trình duyệt của bạn chưa hỗ trợ tính năng chụp màn hình trực tiếp.');
  }

  let stream: MediaStream | null = null;
  try {
    // Prompt browser screen / window picker
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
      },
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('Không nhận được luồng hình ảnh từ màn hình.');
    }

    // Render frame to offscreen video element
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // Small delay to ensure the video frame renders
    await new Promise((resolve) => setTimeout(resolve, 350));

    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể khởi tạo canvas đồ họa');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, width, height);

    // Stop all media tracks immediately so the recording/sharing indicator in browser closes
    track.stop();
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    stream = null;

    // Convert to dataUrl (JPEG 88% quality)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const estimatedSize = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const name = `Screenshot_${timeStr}.jpg`;

    return {
      dataUrl,
      name,
      size: estimatedSize,
    };
  } catch (err: any) {
    // If stream is open on error, ensure it stops
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    // User cancelled native prompt
    if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
      return null;
    }
    throw err;
  }
};

/**
 * Capture raw screen frame as high-res dataUrl for Snipping Tool interactive cropping
 */
export const captureScreenSnapshot = async (): Promise<string | null> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Trình duyệt của bạn chưa hỗ trợ tính năng chụp màn hình trực tiếp.');
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
      },
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('Không nhận được luồng hình ảnh từ màn hình.');
    }

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    await new Promise((resolve) => setTimeout(resolve, 350));

    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không thể khởi tạo canvas đồ họa');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, width, height);

    track.stop();
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    stream = null;

    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (err: any) {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
      return null;
    }
    throw err;
  }
};

/**
 * Trigger download of image to local disk
 */
export const downloadImage = (dataUrl: string, filename = 'note-image.jpg'): void => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Copy image directly to system clipboard
 */
export const copyImageToClipboard = async (dataUrl: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) return false;

    // Convert dataUrl to blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // ClipboardItem usually requires image/png
    let targetBlob = blob;
    if (blob.type !== 'image/png') {
      const img = new Image();
      targetBlob = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject();
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => (b ? resolve(b) : reject()), 'image/png');
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': targetBlob,
      }),
    ]);
    return true;
  } catch (err) {
    console.warn('Could not copy image to clipboard:', err);
    return false;
  }
};
