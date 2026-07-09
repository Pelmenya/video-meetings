'use client';

import { useRef, useState } from 'react';
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

interface MeetingFileUploadFormProps {
    accessToken: string;
    meetingId: string;
    onUploaded: (file: MeetingFile) => void;
}

function formatFileSize(bytes: number): string {
    const megabytes = bytes / (1024 * 1024);
    return megabytes >= 1
        ? `${megabytes.toFixed(1)} МБ`
        : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export default function MeetingFileUploadForm({
    accessToken,
    meetingId,
    onUploaded,
}: MeetingFileUploadFormProps) {
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
                {isUploading ? 'Загрузка...' : 'Загрузить'}
            </Button>
        </div>
    );
}
