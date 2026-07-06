'use client';

import { useState, useEffect } from 'react';
import { 
    Settings, 
    Key, 
    Sparkles, 
    CreditCard, 
    Loader2, 
    Save, 
    Bot, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle 
} from 'lucide-react';
import { getSystemSettings, updateSystemSetting, SystemSetting } from '@/actions/settings';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [savingStripe, setSavingStripe] = useState(false);
    const [savingAI, setSavingAI] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Stripe State
    const [stripeSecret, setStripeSecret] = useState('');
    const [stripePublishable, setStripePublishable] = useState('');
    const [stripeWebhook, setStripeWebhook] = useState('');

    // AI State
    const [geminiKey, setGeminiKey] = useState('');
    const [aiProvider, setAiProvider] = useState('gemini');
    const [aiPrompt, setAiPrompt] = useState('');

    // Load settings from DB on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await getSystemSettings();
                
                // Populate states from DB settings list
                data.forEach((item: SystemSetting) => {
                    switch (item.key) {
                        case 'stripe_secret_key':
                            setStripeSecret(item.value || '');
                            break;
                        case 'stripe_publishable_key':
                            setStripePublishable(item.value || '');
                            break;
                        case 'stripe_webhook_secret':
                            setStripeWebhook(item.value || '');
                            break;
                        case 'gemini_api_key':
                            setGeminiKey(item.value || '');
                            break;
                        case 'ai_provider':
                            setAiProvider(item.value || 'gemini');
                            break;
                        case 'ai_system_prompt':
                            setAiPrompt(item.value || '');
                            break;
                    }
                });
            } catch (err) {
                console.error('Error fetching settings:', err);
                setErrorMsg('No se pudieron cargar las configuraciones del sistema.');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Show temporary messages
    const triggerNotification = (type: 'success' | 'error', text: string) => {
        if (type === 'success') {
            setSuccessMsg(text);
            setTimeout(() => setSuccessMsg(''), 5000);
        } else {
            setErrorMsg(text);
            setTimeout(() => setErrorMsg(''), 5000);
        }
    };

    // Save Stripe Configurations
    const handleSaveStripe = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingStripe(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const results = await Promise.all([
                updateSystemSetting('stripe_secret_key', stripeSecret, 'Clave secreta de Stripe para cobros'),
                updateSystemSetting('stripe_publishable_key', stripePublishable, 'Clave pública de Stripe para el frontend'),
                updateSystemSetting('stripe_webhook_secret', stripeWebhook, 'Firma secreta del webhook de Stripe')
            ]);

            const failed = results.find(r => !r.success);
            if (failed) {
                throw new Error(failed.error || 'Error al guardar algunas configuraciones de Stripe.');
            }

            triggerNotification('success', 'Configuraciones de Stripe guardadas exitosamente.');
        } catch (err: any) {
            triggerNotification('error', err.message || 'Error al guardar los credenciales de Stripe.');
        } finally {
            setSavingStripe(false);
        }
    };

    // Save AI Configurations
    const handleSaveAI = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingAI(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const results = await Promise.all([
                updateSystemSetting('gemini_api_key', geminiKey, 'Clave de API de Google Gemini para procesamiento de lenguaje natural'),
                updateSystemSetting('ai_provider', aiProvider, 'Proveedor de inteligencia artificial activo'),
                updateSystemSetting('ai_system_prompt', aiPrompt, 'Instrucciones del sistema y comportamiento del agente de IA')
            ]);

            const failed = results.find(r => !r.success);
            if (failed) {
                throw new Error(failed.error || 'Error al guardar algunas configuraciones de IA.');
            }

            triggerNotification('success', 'Configuraciones de Inteligencia Artificial guardadas exitosamente.');
        } catch (err: any) {
            triggerNotification('error', err.message || 'Error al guardar los credenciales de IA.');
        } finally {
            setSavingAI(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest animate-pulse">Cargando Configuraciones del Sistema...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 p-1 md:p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-900">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        <Settings className="w-8 h-8 text-emerald-500" />
                        Configuraciones del Sistema
                    </h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                        Administración global de APIs, pasarelas de pago y motores de inteligencia artificial
                    </p>
                </div>
            </div>

            {/* Notifications */}
            {successMsg && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold uppercase tracking-wider flex items-center gap-3 animate-in fade-in duration-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}
            {errorMsg && (
                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold uppercase tracking-wider flex items-center gap-3 animate-in fade-in duration-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Stripe Config Card */}
                <div className="p-8 rounded-[2rem] bg-slate-900/40 border border-slate-800 relative overflow-hidden group shadow-2xl flex flex-col justify-between">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-500/5 blur-3xl"></div>
                    
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                <CreditCard className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">Pasarela de Cobros (Stripe)</h3>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Configuración del motor de suscripciones y facturación</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveStripe} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Stripe Secret Key (sk_test_...)
                                </label>
                                <input
                                    type="password"
                                    value={stripeSecret}
                                    onChange={(e) => setStripeSecret(e.target.value)}
                                    placeholder="sk_test_••••••••••••••••••••••••"
                                    className="w-full px-6 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono text-white text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Stripe Publishable Key (pk_test_...)
                                </label>
                                <input
                                    type="text"
                                    value={stripePublishable}
                                    onChange={(e) => setStripePublishable(e.target.value)}
                                    placeholder="pk_test_••••••••••••••••••••••••"
                                    className="w-full px-6 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono text-white text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Stripe Webhook Secret (whsec_...)
                                </label>
                                <input
                                    type="password"
                                    value={stripeWebhook}
                                    onChange={(e) => setStripeWebhook(e.target.value)}
                                    placeholder="whsec_••••••••••••••••••••••••"
                                    className="w-full px-6 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono text-white text-sm"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={savingStripe}
                                    className="w-full py-4.5 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                                >
                                    {savingStripe ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Guardando configuraciones...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Guardar Configuraciones de Stripe</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* AI / Gemini Config Card */}
                <div className="p-8 rounded-[2rem] bg-slate-900/40 border border-slate-800 relative overflow-hidden group shadow-2xl flex flex-col justify-between">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-500/5 blur-3xl"></div>
                    
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/50">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                <Bot className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">Inteligencia Artificial (IA)</h3>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Preparación de agentes y claves de soporte al cliente</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveAI} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Proveedor de Inteligencia Artificial (IA)
                                </label>
                                <select
                                    value={aiProvider}
                                    onChange={(e) => setAiProvider(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-sans font-bold text-white text-sm"
                                >
                                    <option value="gemini" className="bg-slate-900 text-white font-bold">Google Gemini API (Recomendado)</option>
                                    <option value="openai" className="bg-slate-900 text-white font-bold">OpenAI ChatGPT API</option>
                                    <option value="disabled" className="bg-slate-900 text-white font-bold">Deshabilitado / Off</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    Gemini API Key (AI Key)
                                </label>
                                <input
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="AIzaSy••••••••••••••••••••••••"
                                    className="w-full px-6 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-mono text-white text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    System Prompt (Instrucciones del Agente de IA)
                                </label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder="Escribe las directrices de atención del agente aquí... (ej: Eres un asistente virtual experto para la plataforma OrderPoint...)"
                                    rows={4}
                                    className="w-full px-6 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-emerald-500 outline-none transition-all font-sans font-medium text-white text-sm resize-none"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={savingAI}
                                    className="w-full py-4.5 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                                >
                                    {savingAI ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Guardando configuraciones...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            <span>Guardar Configuraciones de IA</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
