'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Chip, Skeleton } from '@heroui/react';
import { ApiError, getMeetings, type Meeting } from '@/lib/api';
import { decodeAccessToken } from '@/lib/auth';
import { STATUS_COLORS, STATUS_LABELS, formatDate } from '@/lib/meeting-format';

export default function Home() {
    const router = useRouter();
    const [email, setEmail] = useState<string | null>(null);
    const [meetings, setMeetings] = useState<Meeting[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            router.replace('/login');
            return;
        }
        const payload = decodeAccessToken(token);
        if (!payload) {
            localStorage.removeItem('accessToken');
            router.replace('/login');
            return;
        }

        // accessToken/email live in localStorage, unavailable during
        // render/SSR — this effect is the earliest point they can be read,
        // so the setState here can't be moved out of the effect body.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEmail(payload.email);

        getMeetings(token)
            .then(setMeetings)
            .catch((error: unknown) => {
                if (error instanceof ApiError && error.statusCode === 401) {
                    localStorage.removeItem('accessToken');
                    router.replace('/login');
                    return;
                }
                setLoadError('Не удалось загрузить встречи. Попробуйте позже.');
            });
    }, [router]);

    function handleLogout() {
        localStorage.removeItem('accessToken');
        router.replace('/login');
    }

    if (!email) {
        return null;
    }

    const recentMeetings = meetings
        ? [...meetings]
              .sort(
                  (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
              )
              .slice(0, 3)
        : null;

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Привет, {email}!</h1>
                    <p className="text-muted text-sm">
                        {meetings
                            ? `Всего встреч: ${meetings.length}`
                            : 'Загружаем ваши встречи…'}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-2">
                        <Button isDisabled>Создать встречу</Button>
                        <Button variant="outline" onPress={handleLogout}>
                            Выйти
                        </Button>
                    </div>
                    <p className="text-muted text-xs">
                        Создание встреч скоро появится
                    </p>
                </div>
            </div>

            <Card>
                <Card.Header>
                    <Card.Title>Последние встречи</Card.Title>
                </Card.Header>
                <Card.Content>
                    {loadError ? (
                        <p className="text-danger text-sm" role="alert">
                            {loadError}
                        </p>
                    ) : recentMeetings === null ? (
                        <div className="flex flex-col gap-4">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-3"
                                >
                                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-3 w-3/5 rounded" />
                                        <Skeleton className="h-3 w-2/5 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : recentMeetings.length === 0 ? (
                        <p className="text-muted text-sm">
                            У вас пока нет встреч.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {recentMeetings.map((meeting) => (
                                <li key={meeting.id}>
                                    <NextLink
                                        href={`/meetings/${meeting.id}`}
                                        className="border-border hover:bg-surface-secondary flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {meeting.title}
                                            </p>
                                            <p className="text-muted text-sm">
                                                {formatDate(meeting.date)}
                                            </p>
                                        </div>
                                        <Chip
                                            color={
                                                STATUS_COLORS[meeting.status]
                                            }
                                        >
                                            {STATUS_LABELS[meeting.status]}
                                        </Chip>
                                    </NextLink>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card.Content>
            </Card>
        </main>
    );
}
