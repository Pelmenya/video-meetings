import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserDto } from '../../dto/user.dto';
import { toUserDto } from '../../user.mapper';
import { VerifyUserCredentialsQuery } from '../impl';

@QueryHandler(VerifyUserCredentialsQuery)
export class VerifyUserCredentialsHandler implements IQueryHandler<VerifyUserCredentialsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: VerifyUserCredentialsQuery): Promise<UserDto | null> {
        const { email, password } = query;

        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return null;
        }

        return toUserDto(user);
    }
}
