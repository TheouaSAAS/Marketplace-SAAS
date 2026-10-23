/**
 * Contrôles d'une photo avant envoi (navigateur) et après (serveur) : format,
 * poids, résolution. Les doublons se repèrent par l'empreinte SHA-256.
 */

export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 10;
/** En dessous, la photo est signalée « faible » (lisible, mais peu détaillée). */
export const PHOTO_MIN_SIDE = 800;

export interface PhotoFacts {
  type: string;
  bytes: number;
  width: number;
  height: number;
}

export interface PhotoAssessment {
  /** Refus : la photo n'est pas envoyée. */
  errors: string[];
  /** Signaux : la photo est acceptée, l'auteur est prévenu. */
  warnings: string[];
}

export function isPhotoType(type: string): type is PhotoType {
  return Object.hasOwn(PHOTO_TYPES, type);
}

export function assessPhoto(photo: PhotoFacts): PhotoAssessment {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isPhotoType(photo.type)) errors.push("Format non accepté : JPEG, PNG ou WebP.");
  if (photo.bytes > PHOTO_MAX_BYTES) errors.push("Photo trop lourde : 5 Mo au plus.");
  if (photo.width < 200 || photo.height < 200) errors.push("Photo trop petite pour être utile (200 pixels au moins).");
  else if (Math.min(photo.width, photo.height) < PHOTO_MIN_SIDE) warnings.push(`Photo de faible résolution (moins de ${PHOTO_MIN_SIDE} pixels de côté).`);
  const ratio = photo.width / Math.max(photo.height, 1);
  if (ratio > 3 || ratio < 1 / 3) warnings.push("Photo très allongée : elle sera recadrée dans les vignettes.");
  return { errors, warnings };
}

export const isSha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
