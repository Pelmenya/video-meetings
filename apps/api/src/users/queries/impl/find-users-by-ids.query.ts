import { Query } from '@nestjs/cqrs';

export class FindUsersByIdsQuery extends Query<string[]> {
    constructor(public readonly ids: string[]) {
        super();
    }
}
