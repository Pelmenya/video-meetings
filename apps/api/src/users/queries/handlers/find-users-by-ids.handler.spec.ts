import { PrismaService } from '../../../prisma/prisma.service';
import { FindUsersByIdsQuery } from '../impl';
import { FindUsersByIdsHandler } from './find-users-by-ids.handler';

describe('FindUsersByIdsHandler', () => {
    const prisma = { user: { findMany: jest.fn() } };
    let handler: FindUsersByIdsHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new FindUsersByIdsHandler(prisma as unknown as PrismaService);
    });

    it('returns the ids that exist among the requested ids', async () => {
        prisma.user.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

        const result = await handler.execute(
            new FindUsersByIdsQuery(['a', 'b', 'missing']),
        );

        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: { id: { in: ['a', 'b', 'missing'] } },
            select: { id: true },
        });
        expect(result).toEqual(['a', 'b']);
    });
});
