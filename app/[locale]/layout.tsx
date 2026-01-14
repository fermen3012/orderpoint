import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "OrderPoint - Restaurant Ordering System",
    description: "Modern restaurant ordering kiosk, kitchen display, and admin system",
};

export default async function RootLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    let messages;
    try {
        messages = await getMessages();
    } catch (error) {
        console.error('Failed to load messages:', error);
        notFound();
    }

    return (
        <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
        </NextIntlClientProvider>
    );
}
