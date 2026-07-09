const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ApiErrorBody {
    statusCode: number;
    message: string | string[];
    error: string;
}

export interface AuthResponse {
    accessToken: string;
}

export class ApiError extends Error {
    readonly statusCode: number;
    readonly messages: string[];

    constructor(statusCode: number, messages: string[]) {
        super(messages.join(' '));
        this.statusCode = statusCode;
        this.messages = messages;
    }
}

async function parseErrorResponse(response: Response): Promise<never> {
    const body = (await response.json()) as ApiErrorBody;
    const messages = Array.isArray(body.message)
        ? body.message
        : [body.message];
    throw new ApiError(response.status, messages);
}

export async function registerUser(
    email: string,
    password: string,
): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        return parseErrorResponse(response);
    }

    return response.json() as Promise<AuthResponse>;
}

export async function loginUser(
    email: string,
    password: string,
): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        return parseErrorResponse(response);
    }

    return response.json() as Promise<AuthResponse>;
}

export type MeetingStatus = 'SCHEDULED' | 'ONGOING' | 'ENDED' | 'CANCELLED';

export interface Meeting {
    id: string;
    title: string;
    date: string;
    status: MeetingStatus;
    hostId: string;
    participants: string[];
    createdAt: string;
    updatedAt: string;
}

export async function getMeetings(accessToken: string): Promise<Meeting[]> {
    const response = await fetch(`${API_URL}/meetings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        return parseErrorResponse(response);
    }

    return response.json() as Promise<Meeting[]>;
}

export async function getMeetingById(
    accessToken: string,
    id: string,
): Promise<Meeting> {
    const response = await fetch(`${API_URL}/meetings/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        return parseErrorResponse(response);
    }

    return response.json() as Promise<Meeting>;
}

export type MeetingFileKind = 'RECORDING' | 'ATTACHMENT';
export type MeetingFileStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'ERROR';

export interface MeetingFile {
    id: string;
    meetingId: string;
    uploaderId: string;
    kind: MeetingFileKind;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    status: MeetingFileStatus;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
}

export async function getMeetingFiles(
    accessToken: string,
    meetingId: string,
): Promise<MeetingFile[]> {
    const response = await fetch(`${API_URL}/meetings/${meetingId}/files`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        return parseErrorResponse(response);
    }

    return response.json() as Promise<MeetingFile[]>;
}

export function getMeetingFileContentUrl(
    meetingId: string,
    fileId: string,
): string {
    return `${API_URL}/meetings/${meetingId}/files/${fileId}/content`;
}

function parseErrorResponseBody(body: unknown): string[] {
    if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        (body as ApiErrorBody).message
    ) {
        const { message } = body as ApiErrorBody;
        return Array.isArray(message) ? message : [message];
    }
    return ['Не удалось загрузить файл. Попробуйте ещё раз.'];
}

/**
 * Uses XMLHttpRequest (not fetch) so upload progress can be reported via
 * `xhr.upload.onprogress` — fetch has no equivalent for request bodies.
 */
export function uploadMeetingFile(
    accessToken: string,
    meetingId: string,
    file: File,
    kind: MeetingFileKind,
    onProgress?: (percent: number) => void,
): Promise<MeetingFile> {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('kind', kind);
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/meetings/${meetingId}/files`);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

        xhr.upload.onprogress = (event) => {
            if (onProgress && event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        xhr.onload = () => {
            let body: unknown = null;
            try {
                body = JSON.parse(xhr.responseText) as unknown;
            } catch {
                body = null;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(body as MeetingFile);
            } else {
                reject(new ApiError(xhr.status, parseErrorResponseBody(body)));
            }
        };

        xhr.onerror = () => {
            reject(
                new ApiError(0, [
                    'Ошибка сети. Проверьте подключение и попробуйте ещё раз.',
                ]),
            );
        };

        xhr.send(formData);
    });
}
