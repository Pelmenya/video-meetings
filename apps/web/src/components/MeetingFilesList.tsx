'use client';

import { useEffect, useState } from 'react';
import { Chip, Skeleton } from '@heroui/react';
import {
    getMeetingFiles,
    type MeetingFile,
    type MeetingFileKind,
    type MeetingFileStatus,
} from '@/lib/api';
import type { ChipColor } from '@/lib/meeting-format';

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

function formatFileSize(bytes: number): string {
    const megabytes = bytes / (1024 * 1024);
    return megabytes >= 1
        ? `${megabytes.toFixed(1)} МБ`
        : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export default function MeetingFilesList({
    accessToken,
    meetingId,
    refreshSignal,
}: MeetingFilesListProps) {
    const [files, setFiles] = useState<MeetingFile[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        function load() {
            getMeetingFiles(accessToken, meetingId)
                .then((result) => {
                    if (cancelled) {
                        return;
                    }
                    setFiles(result);
                    setLoadError(null);
                })
                .catch(() => {
                    if (!cancelled) {
                        setLoadError('Не удалось загрузить список файлов.');
                    }
                });
        }

        load();
        const intervalId = setInterval(load, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [accessToken, meetingId, refreshSignal]);

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
