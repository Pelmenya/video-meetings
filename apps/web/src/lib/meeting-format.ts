import type { MeetingStatus } from './api';

export type ChipColor =
    | 'accent'
    | 'default'
    | 'success'
    | 'warning'
    | 'danger';

export const STATUS_LABELS: Record<MeetingStatus, string> = {
    SCHEDULED: 'Запланирована',
    ONGOING: 'Идёт',
    ENDED: 'Завершена',
    CANCELLED: 'Отменена',
};

export const STATUS_COLORS: Record<MeetingStatus, ChipColor> = {
    SCHEDULED: 'accent',
    ONGOING: 'success',
    ENDED: 'default',
    CANCELLED: 'danger',
};

export function formatDate(date: string): string {
    return new Date(date).toLocaleString('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export function pluralize(
    count: number,
    one: string,
    few: string,
    many: string,
): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
        return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
        return few;
    }
    return many;
}
