'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button, Modal } from 'shared/components';
import { RotateCw } from 'lucide-react';

type PhotoCropModalProps = {
  open: boolean;
  imageFile?: File | null;
  imageUrl?: string | null;
  title: string;
  onClose: () => void;
  onConfirm: (result: { originalFile?: File; crop: { x: number; y: number; width: number; height: number; rotation: number; zoom: number } }) => Promise<void> | void;
};

type CropPixels = { x: number; y: number; width: number; height: number };

function getRadianAngle(deg: number) {
  return (deg * Math.PI) / 180;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (e) => reject(e));
    img.setAttribute('crossOrigin', 'anonymous');
    img.src = url;
  });
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: CropPixels,
  rotation: number,
  outputSize: number
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxW, height: bBoxH } = rotateSize(image.width, image.height, rotation);

  // Draw rotated image to an "unsafe" canvas (bounding box)
  const safeCanvas = document.createElement('canvas');
  const safeCtx = safeCanvas.getContext('2d');
  if (!safeCtx) throw new Error('Canvas not supported');
  safeCanvas.width = Math.round(bBoxW);
  safeCanvas.height = Math.round(bBoxH);
  safeCtx.translate(safeCanvas.width / 2, safeCanvas.height / 2);
  safeCtx.rotate(rotRad);
  safeCtx.translate(-image.width / 2, -image.height / 2);
  safeCtx.drawImage(image, 0, 0);

  // Crop from the rotated image
  const sx = Math.round(pixelCrop.x);
  const sy = Math.round(pixelCrop.y);
  const sWidth = Math.round(pixelCrop.width);
  const sHeight = Math.round(pixelCrop.height);

  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    safeCanvas,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
}

export default function PhotoCropModal({ open, imageFile = null, imageUrl = null, title, onClose, onConfirm }: PhotoCropModalProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropPixels | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectUrl = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  const effectiveImageSrc = imageUrl || objectUrl;

  useEffect(() => {
    if (!open) return;
    // reset UI each open
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setSubmitting(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels({
      x: croppedPixels.x,
      y: croppedPixels.y,
      width: croppedPixels.width,
      height: croppedPixels.height,
    });
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm({
        originalFile: imageFile || undefined,
        crop: {
          x: croppedAreaPixels.x,
          y: croppedAreaPixels.y,
          width: croppedAreaPixels.width,
          height: croppedAreaPixels.height,
          rotation,
          zoom,
        },
      });
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to crop image';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="large">
      <div className="space-y-4">
        <div className="relative w-full h-[380px] bg-black/90 rounded-lg overflow-hidden">
          {effectiveImageSrc && (
            <>
              <Cropper
                image={effectiveImageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onRotationChange={setRotation}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
              {/* subtle circular mask hint */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[280px] h-[280px] rounded-full border-2 border-white/60" />
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Zoom</div>
            <div className="text-xs text-gray-500">{Math.round(zoom * 100)}%</div>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />

          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Rotation</div>
            <div className="text-xs text-gray-500">{rotation}°</div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full"
            />
            <Button
              variant="secondary"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              disabled={submitting}
              className="whitespace-nowrap"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              90°
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !croppedAreaPixels}>
            {submitting ? 'Saving…' : 'Save & Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


