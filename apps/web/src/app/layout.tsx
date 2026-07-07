import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin', 'cyrillic'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
    title: {
        template: '%s · Видеовстречи',
        default: 'Видеовстречи',
    },
    description: 'Планирование и проведение видеовстреч.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="ru"
            suppressHydrationWarning
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
