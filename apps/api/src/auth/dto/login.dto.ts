import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Введите корректный email' })
    email: string;

    @ApiProperty({ example: 'Sup3rSecret!' })
    @IsString({ message: 'Пароль должен быть строкой' })
    @MinLength(1, { message: 'Введите пароль' })
    password: string;
}
