'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Alert,
    Button,
    Label,
    ProgressBar,
    Radio,
    RadioGroup,
} from '@heroui/react';
import {
    ApiError,
    uploadMeetingFile,
    type MeetingFile,
    type MeetingFileKind,
} from '@/lib/api';
import { formatFileSize } from '@/lib/meeting-format';

interface MeetingFileUploadFormProps {
    accessToken: string;
    meetingId: string;
    onUploaded: (file: MeetingFile) => void;
}

// Client-side hint only (pre-filters the OS file picker) — the server is the
// source of truth for what's actually allowed, see apps/api/src/files/upload.constants.ts.
const ACCEPT_BY_KIND: Record<MeetingFileKind, string> = {
    RECORDING: 'video/*,audio/*',
    ATTACHMENT:
        '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.zip,.doc,.docx,.ppt,.pptx,.xls,.xlsx',
};

export default function MeetingFileUploadForm({
    accessToken,
    meetingId,
    onUploaded,
}: MeetingFileUploadFormProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [kind, setKind] = useState<MeetingFileKind>('ATTACHMENT');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        setSelectedFile(file);
        setError(null);
    }

    async function handleUpload() {
        if (!selectedFile) {
            return;
        }

        setIsUploading(true);
        setProgress(0);
        setError(null);
        try {
            const file = await uploadMeetingFile(
                accessToken,
                meetingId,
                selectedFile,
                kind,
                setProgress,
            );
            onUploaded(file);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (uploadError) {
            if (
                uploadError instanceof ApiError &&
                uploadError.statusCode === 401
            ) {
                localStorage.removeItem('accessToken');
                router.replace('/login');
                return;
            }
            setError(
                uploadError instanceof ApiError
                    ? uploadError.messages.join(' ')
                    : 'Что-то пошло не так. Попробуйте ещё раз.',
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <RadioGroup
                isDisabled={isUploading}
                orientation="horizontal"
                value={kind}
                onChange={(value) => setKind(value as MeetingFileKind)}
            >
                <Label>Тип файла</Label>
                <Radio value="ATTACHMENT">
                    <Radio.Content>
                        <Radio.Control>
                            <Radio.Indicator />
                        </Radio.Control>
                        Вложение
                    </Radio.Content>
                </Radio>
                <Radio value="RECORDING">
                    <Radio.Content>
                        <Radio.Control>
                            <Radio.Indicator />
                        </Radio.Control>
                        Запись
                    </Radio.Content>
                </Radio>
            </RadioGroup>

            <div className="flex flex-wrap items-center gap-3">
                <input
                    ref={fileInputRef}
                    accept={ACCEPT_BY_KIND[kind]}
                    className="hidden"
                    disabled={isUploading}
                    type="file"
                    onChange={handleFileChange}
                />
                <Button
                    isDisabled={isUploading}
                    variant="outline"
                    onPress={() => fileInputRef.current?.click()}
                >
                    Выбрать файл
                </Button>
                <span className="text-muted text-sm">
                    {selectedFile ? (
                        <>
                            {selectedFile.name} (
                            {formatFileSize(selectedFile.size)})
                        </>
                    ) : (
                        'Файл не выбран'
                    )}
                </span>
            </div>

            {isUploading ? (
                <ProgressBar aria-label="Загрузка файла" value={progress}>
                    <Label>Загрузка…</Label>
                    <ProgressBar.Output />
                    <ProgressBar.Track>
                        <ProgressBar.Fill />
                    </ProgressBar.Track>
                </ProgressBar>
            ) : null}

            {error ? (
                <Alert aria-live="polite" role="alert" status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Не удалось загрузить файл</Alert.Title>
                        <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                    <Button
                        size="sm"
                        variant="danger"
                        onPress={() => void handleUpload()}
                    >
                        Повторить
                    </Button>
                </Alert>
            ) : null}

            <Button
                className="w-fit"
                isDisabled={!selectedFile}
                isPending={isUploading}
                onPress={() => void handleUpload()}
            >
                {isUploading ? 'Загрузка…' : 'Загрузить'}
            </Button>
        </div>
    );
}
