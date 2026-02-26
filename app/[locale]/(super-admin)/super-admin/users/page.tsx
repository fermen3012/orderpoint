import { getAllUsersWithRestaurants } from '@/actions/users';
import UsersClient from './UsersClient';
import { Users, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GlobalUsersPage() {
    const { data: users, error } = await getAllUsersWithRestaurants();

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-6 border border-rose-500/20 shadow-2xl">
                    <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Error al cargar datos</h2>
                <p className="text-slate-500 font-black uppercase tracking-widest text-[10px] max-w-md text-center">
                    Hubo un problema de conexión con el servicio de autenticación. Por favor, intenta de nuevo en unos minutos.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700 w-full overflow-hidden">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Gestión Global</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Usuarios
                    </h1>
                </div>
            </div>

            <UsersClient initialUsers={users || []} />
        </div>
    );
}
