'use client';

import { useState } from 'react';
import { uploadRestaurantLogo } from '@/app/[locale]/(super-admin)/super-admin/restaurants/actions';
import { X, Upload, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';

interface RestaurantLogoModalProps {
    restaurantId: string;
    restaurantName: string;
    currentLogoUrl?: string | null;
    onClose: () => void;
    onSuccess: (newUrl: string) => void;
}

export default function RestaurantLogoModal({
    restaurantId,
    restaurantName,
    currentLogoUrl,
    onClose,
    onSuccess
}: RestaurantLogoModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'image/png') {
                setError('Solo se permiten archivos PNG.');
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('restaurantId', restaurantId);

            const result = await uploadRestaurantLogo(formData);

            if (result.error) {
                setError(result.error);
            } else if (result.success && result.url) {
                onSuccess(result.url);
                onClose();
            }
        } catch (err: any) {
            console.error(err);
            setError('Error inesperado al subir la imagen.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in flex flex-col">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Logo del Restaurante</h2>
                        <p className="text-slate-500 font-bold text-xs mt-0.5 truncate max-w-[200px]">{restaurantName}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center gap-6">
                    {/* Preview Area */}
                    <div className="relative group w-48 h-48 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all hover:border-primary-300">
                        {preview ? (
                            <img src={preview} alt="Preview" className="w-full h-full object-contain p-4" />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-300 p-4 text-center">
                                <ImageIcon className="w-12 h-12" />
                                <span className="text-[10px] uppercase font-black tracking-widest">Sin imagen</span>
                            </div>
                        )}

                        <label className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 flex items-center justify-center cursor-pointer transition-all">
                            <input type="file" className="hidden" accept="image/png" onChange={handleFileChange} />
                            <div className="bg-white/90 backdrop-blur text-slate-900 px-4 py-2 rounded-xl font-bold text-xs shadow-lg opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Seleccionar PNG
                            </div>
                        </label>
                    </div>

                    <div className="text-center">
                        <p className="text-xs font-bold text-slate-500 max-w-[250px] mx-auto leading-relaxed">
                            Sube un archivo PNG con fondo transparente para obtener el mejor resultado visual.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 w-full">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="w-full flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-100 transition-colors text-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Subiendo...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Guardar Logo
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
