'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from '@/i18n/routing';
import { Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const t = useTranslations('admin');
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        console.log('Login: Starting login process for', email);

        const supabase = createClient();

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                console.error('Login: Auth error', authError);
                setError(authError.message === 'Invalid login credentials' ? t('invalidCredentials') : t('error'));
            } else if (data.user) {
                console.log('Login: Auth successful for user', data.user.id);
                // Fetch user role for redirection
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, is_super_admin')
                    .eq('id', data.user.id)
                    .single() as { data: any; error: any };

                if (profileError) {
                    console.error('Login: Profile fetch error', profileError);
                    setError('Error al obtener el perfil: ' + profileError.message);
                    return;
                }

                console.log('Login: Profile found', profile);

                if (profile?.is_super_admin) {
                    console.log('Login: Redirecting to Super Admin Dashboard');
                    router.push('/super-admin/dashboard');
                } else if (profile?.role === 'kitchen') {
                    console.log('Login: Redirecting to Kitchen');
                    router.push('/kitchen');
                } else if (profile?.role === 'kiosk') {
                    console.log('Login: Redirecting to Kiosk');
                    router.push('/');
                } else if (profile?.role === 'owner' || profile?.role === 'admin') {
                    console.log('Login: Redirecting to Admin Dashboard');
                    router.push('/admin/dashboard');
                } else {
                    console.log('Login: Redirecting to Admin Dashboard (fallback)');
                    router.push('/admin/dashboard');
                }
            }
        } catch (err) {
            console.error('Login: Unexpected error', err);
            setError(t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                        <Lock className="w-8 h-8 text-primary-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">{t('login')}</h1>
                    <p className="text-slate-500 mt-2">OrderPoint Administration</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {t('email')}
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="admin@orderpoint.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {t('password')}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 transition-colors p-1"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            t('signIn')
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
