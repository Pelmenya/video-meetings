'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, Chip, Skeleton } from '@heroui/react';
import MeetingFileUploadForm from '@/components/MeetingFileUploadForm';
import MeetingFilesList from '@/components/MeetingFilesList';
import { ApiError, getMeetingById, type Meeting } from '@/lib/api';
import { decodeAccessToken } from '@/lib/auth';
import {
    STATUS_COLORS,
    STATUS_LABELS,
    formatDate,
    pluralize,
} from '@/lib/meeting-format';

export default function MeetingPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const meetingId = params.id;

    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshSignal, setRefreshSignal] = useState(0);

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

        // accessToken lives in localStorage, unavailable during render/SSR —
        // this effect is the earliest point it can be read, so the setState
        // here can't be moved out of the effect body (see apps/web/CLAUDE.md).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAccessToken(token);

        getMeetingById(token, meetingId)
            .then(setMeeting)
            .catch((error: unknown) => {
                if (error instanceof ApiError && error.statusCode === 401) {
                    localStorage.removeItem('accessToken');
                    router.replace('/login');
                    return;
                }
                setLoadError(
                    error instanceof ApiError && error.statusCode === 404
                        ? 'Встреча не найдена.'
                        : 'Не удалось загрузить встречу. Попробуйте позже.',
                );
            });
    }, [router, meetingId]);

    if (!accessToken) {
        return null;
    }

    const participantsCount = meeting ? meeting.participants.length + 1 : 0;

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
            {loadError ? (
                <p className="text-danger text-sm" role="alert">
                    {loadError}
                </p>
            ) : meeting === null ? (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-8 w-2/3 rounded" />
                    <Skeleton className="h-4 w-1/3 rounded" />
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold">
                                {meeting.title}
                            </h1>
                            <p className="text-muted text-sm">
                                {formatDate(meeting.date)} ·{' '}
                                {participantsCount}{' '}
                                {pluralize(
                                    participantsCount,
                                    'участник',
                                    'участника',
                                    'участников',
                                )}
                            </p>
                        </div>
                        <Chip color={STATUS_COLORS[meeting.status]}>
                            {STATUS_LABELS[meeting.status]}
                        </Chip>
                    </div>

                    <Card>
                        <Card.Header>
                            <Card.Title>Загрузить файл</Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <MeetingFileUploadForm
                                accessToken={accessToken}
                                meetingId={meetingId}
                                onUploaded={() =>
                                    setRefreshSignal((value) => value + 1)
                                }
                            />
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header>
                            <Card.Title>Файлы встречи</Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <MeetingFilesList
                                accessToken={accessToken}
                                meetingId={meetingId}
                                refreshSignal={refreshSignal}
                            />
                        </Card.Content>
                    </Card>
                </>
            )}
        </main>
    );
}
