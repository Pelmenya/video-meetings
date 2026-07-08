import { ConflictException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserCommand } from '../impl';
import { CreateUserHandler } from './create-user.handler';

jest.mock('bcrypt');

describe('CreateUserHandler', () => {
    const prisma = {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    };
    const eventBus = { publish: jest.fn() };
    let handler: CreateUserHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new CreateUserHandler(
            prisma as unknown as PrismaService,
            eventBus as unknown as EventBus,
        );
    });

    it('creates a user with a hashed password and publishes UserRegisteredEvent', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
        prisma.user.create.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
            password: 'hashed-password',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        });

        const result = await handler.execute(
            new CreateUserCommand('user@example.com', 'plain-password'),
        );

        expect(prisma.user.create).toHaveBeenCalledWith({
            data: { email: 'user@example.com', password: 'hashed-password' },
        });
        expect(eventBus.publish).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            id: 'user-1',
            email: 'user@example.com',
            createdAt: expect.any(Date) as Date,
            updatedAt: expect.any(Date) as Date,
        });
        expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when the email is already registered', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

        await expect(
            handler.execute(
                new CreateUserCommand('user@example.com', 'plain-password'),
            ),
        ).rejects.toThrow(ConflictException);
        expect(prisma.user.create).not.toHaveBeenCalled();
    });
});
