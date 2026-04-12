// js/utils/image.js
// Client-side image compression for Bingo photo uploads.
// Uses <canvas> re-encode to JPEG, which also drops all EXIF metadata
// (location, camera, timestamps) — the re-encoded bitstream contains
// nothing beyond the pixel data. Spec Section 5.6 requires EXIF-free
// blobs before they enter IndexedDB.

/**
 * Compress and re-encode an input file or Blob to a JPEG Blob.
 *
 *   await compressImage(fileFromInput)
 *
 * maxDim: bounding box for the longest side (default 800 px)
 * quality: JPEG quality 0..1 (default 0.7)
 */
export async function compressImage(file, maxDim = 800, quality = 0.7) {
  if (!file) throw new Error('[image] file required');
  const bitmap = await loadBitmap(file);
  const { width, height } = fitInside(bitmap.width, bitmap.height, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('[image] toBlob failed'))),
      'image/jpeg',
      quality
    );
  });
}

/** Defensive fallback used by callers that already have a Blob. */
export async function stripExif(blob) {
  return compressImage(blob, 2048, 0.92);
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file); } catch (e) { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function fitInside(w, h, maxDim) {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = w / h;
  if (w >= h) return { width: maxDim, height: Math.round(maxDim / ratio) };
  return { width: Math.round(maxDim * ratio), height: maxDim };
}
