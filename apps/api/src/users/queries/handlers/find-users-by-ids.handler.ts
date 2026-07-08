import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { FindUsersByIdsQuery } from '../impl';

@QueryHandler(FindUsersByIdsQuery)
export class FindUsersByIdsHandler implements IQueryHandler<FindUsersByIdsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: FindUsersByIdsQuery): Promise<string[]> {
        const users = await this.prisma.user.findMany({
            where: { id: { in: query.ids } },
            select: { id: true },
        });
        return users.map((u) => u.id);
    }
}
