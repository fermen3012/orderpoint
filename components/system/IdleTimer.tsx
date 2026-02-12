'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';

const IDLE_TIMEOUT = 30000; // 30 seconds total
const WARNING_TIMEOUT = 20000; // Warning appears at 20 seconds (10s remaining)

export default function IdleTimer() {
    const router = useRouter();
    const pathname = usePathname();
    const { clearCart, items } = useCartStore();

    const [timeLeft, setTimeLeft] = useState(10);
    const [showWarning, setShowWarning] = useState(false);

    // Refs to store timers and preventing dependency cycles
    const timeoutId = useRef<NodeJS.Timeout | null>(null);
    const warningId = useRef<NodeJS.Timeout | null>(null);
    const countdownId = useRef<NodeJS.Timeout | null>(null);

    // Refs for latest data values to avoid effect resetting
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const clearCartRef = useRef(clearCart);
    clearCartRef.current = clearCart;

    const handleIdle = useCallback(() => {
        // Clear cart if needed
        if (itemsRef.current.length > 0) {
            clearCartRef.current();
        }

        // Navigate to welcome screen
        // Extract locale strictly from pathname or default to 'es' if complex
        const locale = pathname.split('/')[1] || 'es';
        router.push(`/${locale}`);

        // Reset local state (optional, as we are navigating away)
        setShowWarning(false);
    }, [router, pathname]);

    const startTimer = useCallback(() => {
        // Clear existing timers
        if (timeoutId.current) clearTimeout(timeoutId.current);
        if (warningId.current) clearTimeout(warningId.current);
        if (countdownId.current) clearInterval(countdownId.current);

        // Reset UI state
        setShowWarning(false);
        setTimeLeft(10);

        // Schedule Warning (appears after 20s)
        warningId.current = setTimeout(() => {
            setShowWarning(true);

            // Start Countdown (ticks every 1s)
            countdownId.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        if (countdownId.current) clearInterval(countdownId.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, WARNING_TIMEOUT);

        // Schedule Final Action (happens after 30s)
        timeoutId.current = setTimeout(() => {
            handleIdle();
        }, IDLE_TIMEOUT);

    }, [handleIdle]);

    useEffect(() => {
        // Start timers on mount
        startTimer();

        // Event listeners to reset timer on activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => startTimer();

        events.forEach((event) => {
            window.addEventListener(event, handleActivity);
        });

        // Cleanup
        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, handleActivity);
            });
            if (timeoutId.current) clearTimeout(timeoutId.current);
            if (warningId.current) clearTimeout(warningId.current);
            if (countdownId.current) clearInterval(countdownId.current);
        };
    }, [startTimer]);

    if (!showWarning) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6 animate-scale-in">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2 shadow-inner">
                    <span className="text-4xl font-black">!</span>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">¿Sigues ahí?</h2>
                    <p className="text-slate-500 font-bold mt-2">
                        Tu sesión se cerrará en <span className="text-rose-500 text-xl font-black">{timeLeft}</span> segundos.
                    </p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent ensuring bubble
                        startTimer();
                    }}
                    className="w-full py-5 bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-xl shadow-primary-500/30 active:scale-95"
                >
                    Seguir Ordenando
                </button>
            </div>
        </div>
    );
}
