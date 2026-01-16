import { getAllUsersWithRestaurants } from '@/actions/users';
import UsersClient from './UsersClient';
import { Users, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function GlobalUsersPage() {
    const { data: users, error } = await getAllUsersWithRestaurants();

    if (error) {
        return (
            <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
                    <ShieldAlert className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-secondary-900 tracking-tight">Error al cargar datos</h2>
                <p className="text-secondary-500 mt-2 max-w-md">
                    Hubo un problema de conexión con el servicio de autenticación. Por favor, intenta de nuevo en unos minutos.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-secondary-900 tracking-tight flex items-center gap-3">
                    <Users className="w-10 h-10 text-primary-500" />
                    Usuarios Globales
                </h1>
                <p className="text-secondary-500 font-medium mt-2">
                    Administra las cuentas de todos los restaurantes, cambia roles y restaura contraseñas.
                </p>
            </div>

            {/* Client Component */}
            <UsersClient initialUsers={users || []} />
        </div>
    );
}
