'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, Skeleton } from '@heroui/react';
import {
    ApiError,
    getMeetingFiles,
    type MeetingFile,
    type MeetingFileKind,
    type MeetingFileStatus,
} from '@/lib/api';
import { formatFileSize, type ChipColor } from '@/lib/meeting-format';

interface MeetingFilesListProps {
    accessToken: string;
    meetingId: string;
    refreshSignal: number;
}

const FILE_STATUS_LABELS: Record<MeetingFileStatus, string> = {
    QUEUED: 'В очереди',
    PROCESSING: 'Обрабатывается',
    READY: 'Готово',
    ERROR: 'Ошибка',
};

const FILE_STATUS_COLORS: Record<MeetingFileStatus, ChipColor> = {
    QUEUED: 'default',
    PROCESSING: 'accent',
    READY: 'success',
    ERROR: 'danger',
};

const FILE_KIND_LABELS: Record<MeetingFileKind, string> = {
    RECORDING: 'Запись',
    ATTACHMENT: 'Вложение',
};

const POLL_INTERVAL_MS = 4000;

function isTerminal(file: MeetingFile): boolean {
    return file.status === 'READY' || file.status === 'ERROR';
}

export default function MeetingFilesList({
    accessToken,
    meetingId,
    refreshSignal,
}: MeetingFilesListProps) {
    const router = useRouter();
    const [files, setFiles] = useState<MeetingFile[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | undefined;

        function stopPolling() {
            if (intervalId !== undefined) {
                clearInterval(intervalId);
                intervalId = undefined;
            }
        }

        function load() {
            getMeetingFiles(accessToken, meetingId)
                .then((result) => {
                    if (cancelled) {
                        return;
                    }
                    setFiles(result);
                    setLoadError(null);
                    // Nothing left to change until a new upload bumps
                    // refreshSignal and restarts this effect (and polling).
                    if (result.every(isTerminal)) {
                        stopPolling();
                    }
                })
                .catch((error: unknown) => {
                    if (cancelled) {
                        return;
                    }
                    if (error instanceof ApiError && error.statusCode === 401) {
                        localStorage.removeItem('accessToken');
                        router.replace('/login');
                        return;
                    }
                    setLoadError('Не удалось загрузить список файлов.');
                });
        }

        load();
        intervalId = setInterval(load, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            stopPolling();
        };
    }, [accessToken, meetingId, refreshSignal, router]);

    if (loadError) {
        return (
            <p className="text-danger text-sm" role="alert">
                {loadError}
            </p>
        );
    }

    if (files === null) {
        return (
            <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (files.length === 0) {
        return <p className="text-muted text-sm">Файлов пока нет.</p>;
    }

    return (
        <ul className="flex flex-col gap-3">
            {files.map((file) => (
                <li
                    key={file.id}
                    className="border-border flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                    <div className="min-w-0">
                        <p className="truncate font-medium">
                            {file.originalName}
                        </p>
                        <p className="text-muted text-sm">
                            {FILE_KIND_LABELS[file.kind]} ·{' '}
                            {formatFileSize(file.sizeBytes)}
                        </p>
                        {file.status === 'ERROR' && file.errorMessage ? (
                            <p className="text-danger text-sm">
                                {file.errorMessage}
                            </p>
                        ) : null}
                    </div>
                    <Chip color={FILE_STATUS_COLORS[file.status]}>
                        {FILE_STATUS_LABELS[file.status]}
                    </Chip>
                </li>
            ))}
        </ul>
    );
}
