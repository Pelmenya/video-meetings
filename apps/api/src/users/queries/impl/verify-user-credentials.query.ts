import { Query } from '@nestjs/cqrs';
import { UserDto } from '../../dto/user.dto';

export class VerifyUserCredentialsQuery extends Query<UserDto | null> {
    constructor(
        public readonly email: string,
        public readonly password: string,
    ) {
        super();
    }
}
