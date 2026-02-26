'use client';

import React from 'react';

interface SidebarLinkProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    collapsed?: boolean;
    onClick?: () => void;
}

export function SidebarLink({ icon, label, active = false, collapsed = false, onClick }: SidebarLinkProps) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-4 w-full px-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 relative group ${active
                ? 'bg-emerald-500 text-slate-900 shadow-[0_10px_20px_rgba(16,185,129,0.2)]'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}>
            <div className={`flex-shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                {icon}
            </div>
            {!collapsed && (
                <span className="truncate transition-all duration-300">
                    {label}
                </span>
            )}

            {collapsed && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-slate-700">
                    {label}
                </div>
            )}
        </button>
    );
}
