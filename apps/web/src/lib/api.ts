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
        const body = (await response.json()) as ApiErrorBody;
        const messages = Array.isArray(body.message)
            ? body.message
            : [body.message];
        throw new ApiError(response.status, messages);
    }

    return response.json() as Promise<AuthResponse>;
}
