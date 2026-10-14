import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppWatchdog from "@/components/system/AppWatchdog";
import { Analytics } from "@vercel/analytics/next";
import PwaInstallPrompt from "@/components/pwa/PwaInstallPrompt";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "OrderPoint",
    },
};

export const viewport: Viewport = {
    themeColor: "#f97316",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
                <AppWatchdog />
                {children}
                <PwaInstallPrompt />
                <Analytics />
            </body>
        </html>
    )
}
