export const ALLOWED_RECORDING_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
];

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

export const DEFAULT_FILE_STORAGE_ROOT = './storage/uploads';

export function getMaxUploadSizeBytes(): number {
    const raw = process.env.MAX_UPLOAD_SIZE_BYTES;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_MAX_UPLOAD_SIZE_BYTES;
}
