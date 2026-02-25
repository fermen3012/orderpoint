import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppWatchdog from "@/components/system/AppWatchdog";
import { Analytics } from "@vercel/analytics/next";

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
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
                <AppWatchdog />
                {children}
                <Analytics />
            </body>
        </html>
    )
}
