import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_FILE_STORAGE_ROOT } from './upload.constants';

export function resolveStorageRoot(config: ConfigService): string {
    return path.resolve(
        process.cwd(),
        config.get<string>('FILE_STORAGE_ROOT', DEFAULT_FILE_STORAGE_ROOT),
    );
}

export function sanitizeFilename(originalName: string): string {
    const base = path.basename(originalName);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function saveFileToDisk(
    storageRoot: string,
    meetingId: string,
    originalName: string,
    buffer: Buffer,
): Promise<string> {
    const safeName = sanitizeFilename(originalName);
    const relativePath = path.join(meetingId, `${randomUUID()}-${safeName}`);
    const absolutePath = path.join(storageRoot, relativePath);

    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, buffer);

    return relativePath;
}

export function resolveAbsolutePath(
    storageRoot: string,
    relativePath: string,
): string {
    return path.join(storageRoot, relativePath);
}
