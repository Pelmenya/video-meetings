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
