import { Prisma } from '@prisma/client';
import { UserDto } from './dto/user.dto';

export const USER_SAFE_SELECT = Prisma.validator<Prisma.UserDefaultArgs>()({
    select: { id: true, email: true, createdAt: true, updatedAt: true },
});

export type SafeUser = Prisma.UserGetPayload<typeof USER_SAFE_SELECT>;

export function toUserDto(user: SafeUser): UserDto {
    return {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
