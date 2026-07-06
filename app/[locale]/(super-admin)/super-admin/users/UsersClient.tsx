'use client';

import { useState } from 'react';
import {
    Search,
    KeyRound,
    User,
    Building2,
    Shield,
    AlertCircle,
    CheckCircle2,
    X,
    MoreVertical
} from 'lucide-react';
import { resetUserPassword } from '@/actions/users';
import { cn } from '@/lib/utils';

interface GlobalUser {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    restaurant_name: string;
}

export default function UsersClient({ initialUsers }: { initialUsers: GlobalUser[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const filteredUsers = initialUsers.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.restaurant_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) return;

        setIsResetting(true);
        const result = await resetUserPassword(selectedUser.id, newPassword);
        setIsResetting(false);

        if (result.success) {
            setStatus({ type: 'success', message: 'Contraseña restaurada correctamente.' });
            setNewPassword('');
            setTimeout(() => {
                setSelectedUser(null);
                setStatus(null);
            }, 2000);
        } else {
            setStatus({ type: 'error', message: result.error || 'Error al restaurar contraseña.' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="relative group flex-1 max-w-xl">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="BUSCAR USUARIO O RESTAURANTE..."
                        className="w-full pl-16 pr-8 py-5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white text-xs uppercase tracking-widest"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-slate-400 font-bold">
                    <span className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                        {filteredUsers.length} Usuarios Encontrados
                    </span>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/40 backdrop-blur-sm rounded-[3.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950/20 border-b border-slate-800/50">
                            <tr>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Usuario</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Rol / Permisos</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-left">Tenant</th>
                                <th className="px-12 py-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="group hover:bg-slate-800/20 transition-all duration-300">
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-[1.25rem] bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-emerald-500/30 transition-all duration-500 shadow-xl overflow-hidden">
                                                <User className="w-6 h-6 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                                            </div>
                                            <div>
                                                <p className="font-black text-white text-xl italic tracking-tighter uppercase group-hover:text-emerald-500 transition-colors leading-none">
                                                    {user.full_name || 'Sin Nombre'}
                                                </p>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className={cn(
                                            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                                            user.role === 'owner' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                user.role === 'admin' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                                    "bg-slate-800/50 text-slate-400 border-slate-700"
                                        )}>
                                            <Shield className="w-3 h-3" />
                                            {user.role}
                                        </div>
                                    </td>
                                    <td className="px-12 py-8">
                                        <div className="flex items-center gap-3 text-slate-400 font-bold bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 w-fit">
                                            <Building2 className="w-4 h-4 text-emerald-500/50" />
                                            <span className="font-black text-xs uppercase tracking-widest text-slate-300">{user.restaurant_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-12 py-8 text-right">
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => setSelectedUser(user)}
                                                className="group relative flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-slate-900 rounded-2xl font-black uppercase tracking-widest border border-emerald-500/20 hover:border-emerald-500 transition-all active:scale-95 whitespace-nowrap"
                                            >
                                                <KeyRound className="w-4 h-4" />
                                                <span className="text-[10px]">Restablecer</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="p-32 text-center">
                            <User className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                            <h2 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">No se encontraron usuarios</h2>
                        </div>
                    )}
                </div>
            </div>

            {/* Reset Password Dialog */}
            {selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-500">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-300 overflow-hidden">

                        <div className="bg-slate-900 p-10 md:p-12 relative flex items-end border-b border-slate-800/50">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <KeyRound className="w-32 h-32 text-emerald-500" />
                            </div>
                            <div className="relative z-10 w-full">
                                <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-white flex items-center gap-3">
                                    <KeyRound className="w-8 h-8 text-emerald-500" />
                                    Restaurar Acceso
                                </h2>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Nueva Contraseña para Usuario</p>
                            </div>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="absolute top-6 right-6 p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-10 md:p-12 space-y-8">
                            {selectedUser && (
                                <div className="p-6 bg-slate-950 rounded-[2rem] border border-slate-800 mb-6 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 shrink-0">
                                        <User className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Usuario Seleccionado</p>
                                        <p className="font-black text-white text-lg italic uppercase tracking-tighter leading-none">{selectedUser.full_name}</p>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{selectedUser.email}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    placeholder="ESCRÍBELA AQUÍ..."
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-8 py-6 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-white uppercase tracking-widest text-sm shadow-inner placeholder:text-slate-700"
                                />
                                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest px-2">
                                    * Se recomienda usar al menos 8 caracteres.
                                </p>
                            </div>

                            {status && (
                                <div className={cn(
                                    "p-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 font-black text-[10px] uppercase tracking-widest border",
                                    status.type === 'success'
                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                )}>
                                    {status.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                    <p>{status.message}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-10 md:p-12 bg-slate-900/50 flex flex-col sm:flex-row gap-6 border-t border-slate-800/50">
                            <button
                                className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest transition-all active:scale-95 text-xs shadow-xl"
                                onClick={() => setSelectedUser(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="flex-[2] py-6 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(16,185,129,0.3)] hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 text-xs text-center"
                                onClick={handleResetPassword}
                                disabled={!newPassword || isResetting}
                            >
                                {isResetting ? 'Aplicando Cambios...' : 'Guardar Nueva Contraseña'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
