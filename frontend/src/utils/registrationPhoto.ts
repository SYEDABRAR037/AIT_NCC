export const MAX_PROFILE_PHOTO_DATA_URL_BYTES = 48 * 1024;
export const MAX_REGISTRATION_JSON_BYTES = 80 * 1024;
export const MAX_PROFILE_PHOTO_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;

export interface RegistrationPhotoImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  close?: () => void;
}

export interface RegistrationPhotoDependencies {
  decode: (file: File) => Promise<RegistrationPhotoImage>;
  createCanvas: () => HTMLCanvasElement;
  encode: (canvas: HTMLCanvasElement, quality: number) => Promise<Blob>;
  toDataUrl: (blob: Blob) => Promise<string>;
}

const browserPhotoDependencies: RegistrationPhotoDependencies = {
  decode: async (file) => {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
  },
  createCanvas: () => document.createElement('canvas'),
  encode: (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PHOTO_ENCODING_FAILED')), 'image/jpeg', quality);
  }),
  toDataUrl: (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('PHOTO_ENCODING_FAILED'));
    reader.onerror = () => reject(new Error('PHOTO_ENCODING_FAILED'));
    reader.readAsDataURL(blob);
  }),
};

export async function compressRegistrationPhoto(
  file: File,
  dependencies: RegistrationPhotoDependencies = browserPhotoDependencies,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('PHOTO_TYPE_UNSUPPORTED');
  if (file.size > MAX_PROFILE_PHOTO_INPUT_BYTES) throw new Error('PHOTO_INPUT_TOO_LARGE');

  const image = await dependencies.decode(file);
  try {
    if (!image.width || !image.height) throw new Error('PHOTO_DECODE_FAILED');

    let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    let quality = 0.82;
    const encoder = new TextEncoder();

    for (let attempt = 0; attempt < 12; attempt++) {
      const canvas = dependencies.createCanvas();
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PHOTO_CANVAS_UNAVAILABLE');
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

      const blob = await dependencies.encode(canvas, quality);
      const dataUrl = await dependencies.toDataUrl(blob);
      if (encoder.encode(dataUrl).byteLength <= MAX_PROFILE_PHOTO_DATA_URL_BYTES) return dataUrl;

      if (quality > 0.5) {
        quality = Math.max(0.45, quality - 0.12);
      } else {
        scale *= 0.8;
        quality = 0.82;
      }
    }

    throw new Error('PHOTO_TOO_LARGE');
  } finally {
    image.close?.();
  }
}

export function createRegistrationPayload(
  formData: Record<string, unknown>,
  emailChallengeId: string,
  profilePhotoUrl: string | null,
): Record<string, unknown> {
  const { profilePhoto: _redundantPhoto, ...registrationFields } = formData;
  return { ...registrationFields, emailChallengeId, profilePhotoUrl };
}

export function registrationPayloadByteLength(payload: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export function isRegistrationPayloadWithinBudget(payload: Record<string, unknown>): boolean {
  return registrationPayloadByteLength(payload) <= MAX_REGISTRATION_JSON_BYTES;
}
