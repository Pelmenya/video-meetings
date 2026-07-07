'use client';

import { Eye, EyeSlash } from '@gravity-ui/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    Button,
    Card,
    FieldError,
    Form,
    Input,
    InputGroup,
    Label,
    TextField,
} from '@heroui/react';
import { ApiError, registerUser } from '@/lib/api';

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function RegisterPage() {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
    const [touchedFields, setTouchedFields] = useState({
        email: false,
        password: false,
    });

    function touch(field: keyof typeof touchedFields) {
        setTouchedFields((prev) => ({ ...prev, [field]: true }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        setHasAttemptedSubmit(true);
        setFormError(null);
        setFieldErrors({});

        const formData = new FormData(form);
        const email = String(formData.get('email') ?? '');
        const password = String(formData.get('password') ?? '');

        setIsPending(true);
        try {
            const { accessToken } = await registerUser(email, password);
            localStorage.setItem('accessToken', accessToken);
            router.push('/');
        } catch (error) {
            if (error instanceof ApiError) {
                const nextFieldErrors: Record<string, string> = {};
                for (const message of error.messages) {
                    if (/пароль/i.test(message)) {
                        nextFieldErrors.password = message;
                    } else if (/email/i.test(message)) {
                        nextFieldErrors.email = message;
                    }
                }
                if (Object.keys(nextFieldErrors).length > 0) {
                    setFieldErrors(nextFieldErrors);
                    const firstInvalidField = form.elements.namedItem(
                        'email' in nextFieldErrors ? 'email' : 'password',
                    );
                    if (firstInvalidField instanceof HTMLElement) {
                        firstInvalidField.focus();
                    }
                } else {
                    setFormError(error.messages.join(' '));
                }
            } else {
                setFormError('Что-то пошло не так. Попробуйте ещё раз.');
            }
        } finally {
            setIsPending(false);
        }
    }

    return (
        <main className="flex min-h-full flex-1 items-center justify-center p-6">
            <h1 className="sr-only">Регистрация</h1>
            <Card className="w-full max-w-md">
                <Card.Header>
                    <Card.Title>Создайте аккаунт</Card.Title>
                    <Card.Description>
                        Зарегистрируйтесь по email и паролю, чтобы начать
                        планировать встречи.
                    </Card.Description>
                </Card.Header>
                <Form
                    validationBehavior="aria"
                    validationErrors={fieldErrors}
                    onSubmit={handleSubmit}
                >
                    <Card.Content>
                        <div className="flex flex-col gap-4">
                            <TextField
                                isRequired
                                name="email"
                                type="email"
                                onBlur={() => touch('email')}
                                validate={(value) => {
                                    if (
                                        !touchedFields.email &&
                                        !hasAttemptedSubmit
                                    ) {
                                        return null;
                                    }
                                    if (!value) {
                                        return 'Введите email';
                                    }
                                    if (!EMAIL_PATTERN.test(value)) {
                                        return 'Введите корректный email';
                                    }
                                    return null;
                                }}
                            >
                                <Label>Email</Label>
                                <Input
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    variant="secondary"
                                />
                                <FieldError />
                            </TextField>
                            <TextField
                                isRequired
                                minLength={8}
                                name="password"
                                onBlur={() => touch('password')}
                                validate={(value) => {
                                    if (
                                        !touchedFields.password &&
                                        !hasAttemptedSubmit
                                    ) {
                                        return null;
                                    }
                                    if (!value) {
                                        return 'Введите пароль';
                                    }
                                    if (value.length < 8) {
                                        return 'Пароль должен содержать минимум 8 символов';
                                    }
                                    return null;
                                }}
                            >
                                <Label>Пароль</Label>
                                <InputGroup variant="secondary">
                                    <InputGroup.Input
                                        autoComplete="new-password"
                                        placeholder="Минимум 8 символов"
                                        type={
                                            isPasswordVisible
                                                ? 'text'
                                                : 'password'
                                        }
                                    />
                                    <InputGroup.Suffix className="pr-0">
                                        <Button
                                            isIconOnly
                                            aria-label={
                                                isPasswordVisible
                                                    ? 'Скрыть пароль'
                                                    : 'Показать пароль'
                                            }
                                            className="relative before:absolute before:-inset-2 before:content-['']"
                                            size="sm"
                                            variant="ghost"
                                            onPress={() =>
                                                setIsPasswordVisible(
                                                    (visible) => !visible,
                                                )
                                            }
                                        >
                                            {isPasswordVisible ? (
                                                <EyeSlash className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </Button>
                                    </InputGroup.Suffix>
                                </InputGroup>
                                <FieldError />
                            </TextField>
                            {formError ? (
                                <p className="text-danger text-sm" role="alert">
                                    {formError}
                                </p>
                            ) : null}
                        </div>
                    </Card.Content>
                    <Card.Footer className="mt-4">
                        <Button
                            className="w-full"
                            isPending={isPending}
                            type="submit"
                        >
                            {isPending
                                ? 'Создание аккаунта...'
                                : 'Создать аккаунт'}
                        </Button>
                    </Card.Footer>
                </Form>
            </Card>
        </main>
    );
}
