'use client';

import { use } from 'react';
import ProductsPageContent from '@/components/admin/ProductsPageContent';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from '@/i18n/routing';

interface ManageMenuPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function ManageMenuPage({ params }: ManageMenuPageProps) {
    const resolvedParams = use(params);
    const restaurantId = resolvedParams.id;
    const router = useRouter();

    return (
        <div className="space-y-6">
            {/* Back to Restaurants List Button */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/30">
                <button
                    onClick={() => router.push('/super-admin/restaurants')}
                    className="group flex items-center gap-3 px-6 py-3 bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px]"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Volver a Tenants
                </button>
            </div>

            {/* Reuse the exact products page passing the target restaurantId */}
            <ProductsPageContent restaurantId={restaurantId} />
        </div>
    );
}
