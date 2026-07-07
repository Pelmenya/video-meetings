import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Введите корректный email' })
    email: string;

    @ApiProperty({ example: 'Sup3rSecret!', minLength: 8 })
    @IsString({ message: 'Пароль должен быть строкой' })
    @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
    password: string;
}
