'use client';

import { useState } from 'react';
import {
    Search,
    KeyRound,
    MoreVertical,
    User,
    Building2,
    Shield,
    AlertCircle,
    CheckCircle2,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
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
            {/* Header / Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-secondary-100">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                    <Input
                        placeholder="Buscar por nombre, email o restaurante..."
                        className="pl-12"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-secondary-500 text-sm font-bold">
                    <span className="bg-secondary-100 px-3 py-1 rounded-full">{filteredUsers.length} Usuarios</span>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-secondary-200/20 border border-secondary-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-secondary-50/50 border-b border-secondary-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-secondary-400">Usuario</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-secondary-400">Rol</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-secondary-400">Restaurante</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-secondary-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-secondary-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600">
                                                <User className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-secondary-900 leading-tight tracking-tight">
                                                    {user.full_name || 'Sin Nombre'}
                                                </p>
                                                <p className="text-secondary-500 text-sm font-medium italic">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className={cn(
                                            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            user.role === 'owner' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                user.role === 'admin' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                    "bg-secondary-50 text-secondary-600 border-secondary-100"
                                        )}>
                                            <Shield className="w-3 h-3" />
                                            {user.role}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-secondary-700 font-bold">
                                            <Building2 className="w-4 h-4 text-secondary-400" />
                                            {user.restaurant_name}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setSelectedUser(user)}
                                            className="rounded-2xl hover:bg-primary-50 hover:text-primary-600 gap-2 h-12 px-6"
                                        >
                                            <KeyRound className="w-4 h-4" />
                                            <span className="font-black text-xs uppercase tracking-widest">Reset Pass</span>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reset Password Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden bg-white border-none shadow-2xl sm:rounded-[3rem] animate-scale-in">
                    <div className="bg-secondary-900 p-8 text-white relative h-32 flex items-end">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <KeyRound className="w-24 h-24" />
                        </div>
                        <DialogHeader className="relative z-10 w-full">
                            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                                <KeyRound className="w-6 h-6 text-primary-400" />
                                Restaurar Contraseña
                            </DialogTitle>
                        </DialogHeader>
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="absolute top-6 right-6 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    <div className="p-8 space-y-6">
                        {selectedUser && (
                            <div className="p-4 bg-secondary-50 rounded-2xl border border-secondary-100 mb-6">
                                <p className="text-[10px] font-black text-secondary-400 uppercase tracking-widest mb-1">Usuario seleccionado</p>
                                <p className="font-black text-secondary-900">{selectedUser.full_name}</p>
                                <p className="text-sm font-medium text-secondary-500 italic">{selectedUser.email}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-sm font-black text-secondary-700 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                            <Input
                                type="password"
                                placeholder="Escribe la nueva contraseña..."
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <p className="text-[10px] text-secondary-400 font-bold px-1 italic">
                                * Se recomienda usar al menos 8 caracteres con letras y símbolos.
                            </p>
                        </div>

                        {status && (
                            <div className={cn(
                                "p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300",
                                status.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                            )}>
                                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                <p className="text-sm font-bold">{status.message}</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-8 bg-secondary-50/50 flex flex-col sm:flex-row gap-3 border-t border-secondary-100">
                        <Button
                            variant="ghost"
                            className="rounded-2xl font-black h-12 uppercase tracking-widest flex-1"
                            onClick={() => setSelectedUser(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="rounded-2xl font-black h-12 uppercase tracking-widest flex-1 bg-primary-600 hover:bg-primary-700"
                            onClick={handleResetPassword}
                            disabled={!newPassword || isResetting}
                        >
                            {isResetting ? 'Restaurando...' : 'Guardar Nueva'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
