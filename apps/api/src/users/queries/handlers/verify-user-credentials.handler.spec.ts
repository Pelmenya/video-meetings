import * as bcrypt from 'bcrypt';
import { VerifyUserCredentialsQuery } from '../impl';
import { VerifyUserCredentialsHandler } from './verify-user-credentials.handler';

jest.mock('bcrypt');

describe('VerifyUserCredentialsHandler', () => {
    const prisma = { user: { findUnique: jest.fn() } };
    let handler: VerifyUserCredentialsHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new VerifyUserCredentialsHandler(prisma as any);
    });

    it('returns the safe user when credentials are valid', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
            password: 'hashed-password',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        const result = await handler.execute(
            new VerifyUserCredentialsQuery(
                'user@example.com',
                'plain-password',
            ),
        );

        expect(result).toMatchObject({
            id: 'user-1',
            email: 'user@example.com',
        });
        expect(result).not.toHaveProperty('password');
    });

    it('returns null for an unknown email', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await handler.execute(
            new VerifyUserCredentialsQuery(
                'missing@example.com',
                'plain-password',
            ),
        );

        expect(result).toBeNull();
    });

    it('returns null for a wrong password', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
            password: 'hashed-password',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        const result = await handler.execute(
            new VerifyUserCredentialsQuery(
                'user@example.com',
                'wrong-password',
            ),
        );

        expect(result).toBeNull();
    });
});
