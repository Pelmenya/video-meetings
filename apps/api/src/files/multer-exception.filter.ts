import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
    catch(exception: MulterError, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();
        const message =
            exception.code === 'LIMIT_FILE_SIZE'
                ? 'Размер файла превышает допустимый лимит'
                : 'Ошибка загрузки файла';

        response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: HttpStatus.BAD_REQUEST,
            message,
        });
    }
}
