import { FindUsersByIdsHandler } from './find-users-by-ids.handler';
import { VerifyUserCredentialsHandler } from './verify-user-credentials.handler';

export const UserQueryHandlers = [
    FindUsersByIdsHandler,
    VerifyUserCredentialsHandler,
];
