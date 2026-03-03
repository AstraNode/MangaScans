import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'MangaScans — AI Manga Translation',
    description: 'Automatically translate manga and manhwa with AI-powered OCR, translation, and typesetting. Premium quality scanlation at scale.',
    keywords: ['manga', 'translation', 'scanlation', 'AI', 'manhwa', 'OCR'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-surface-900 text-white antialiased min-h-screen">
                {children}
            </body>
        </html>
    );
}
