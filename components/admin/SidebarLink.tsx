'use client';

import React from 'react';

interface SidebarLinkProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

export function SidebarLink({ icon, label, active = false, onClick }: SidebarLinkProps) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-4 w-full px-6 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all duration-300 ${active
                ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/20'
                : 'text-secondary-400 hover:bg-secondary-50 hover:text-secondary-900'
                }`}>
            {icon}
            <span>{label}</span>
        </button>
    );
}
