'use client';

import { use, useState, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { 
    ArrowLeft, 
    Upload, 
    Download, 
    FileSpreadsheet, 
    CheckCircle2, 
    AlertTriangle, 
    Loader2, 
    Trash2,
    Check
} from 'lucide-react';
import Papa from 'papaparse';
import { bulkInsertIngredientsAction } from '@/actions/products';
import { useTranslations } from 'next-intl';

interface ManageImportIngredientsPageProps {
    params: Promise<{
        id: string;
    }>;
}

interface ParsedIngredient {
    name: string;
    isValid: boolean;
    errors: string[];
}

export default function ManageImportIngredientsPage({ params }: ManageImportIngredientsPageProps) {
    const resolvedParams = use(params);
    const restaurantId = resolvedParams.id;
    const router = useRouter();
    const t = useTranslations('admin');
    
    const [file, setFile] = useState<File | null>(null);
    const [parsedIngredients, setParsedIngredients] = useState<ParsedIngredient[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const [importing, setImporting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadSampleCSV = () => {
        const csvContent = "nombre\n" +
            "Queso Cheddar\n" +
            "Tocineta Crujiente\n" +
            "Cebolla Caramelizada\n" +
            "Pepinillos\n" +
            "Salsa Especial";

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_ingredientes.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const processFile = (file: File) => {
        setErrorMsg(null);
        setSuccessCount(null);
        setFile(file);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as any[];
                const fileHeaders = results.meta.fields || [];
                
                // Find matching name header
                const nameHeader = fileHeaders.find(h => ['nombre', 'name', 'ingrediente', 'ingredient'].includes(h.toLowerCase().trim()));

                if (!nameHeader) {
                    setErrorMsg(t('errorMissingNameHeader'));
                    setFile(null);
                    setParsedIngredients([]);
                    return;
                }

                const ingredientsList: ParsedIngredient[] = rows.map((row) => {
                    const name = (row[nameHeader] || '').trim();
                    const errors: string[] = [];

                    if (!name) {
                        errors.push(t('errorIngredientNameEmpty'));
                    }

                    return {
                        name,
                        isValid: errors.length === 0,
                        errors
                    };
                });

                setParsedIngredients(ingredientsList);
            },
            error: (err) => {
                console.error('Error parsing CSV:', err);
                setErrorMsg(t('errorParsingCsv'));
            }
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragActive(true);
        } else if (e.type === "dragleave") {
            setIsDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            if (droppedFile.name.endsWith('.csv')) {
                processFile(droppedFile);
            } else {
                setErrorMsg(t('onlyCsvAllowed'));
            }
        }
    };

    const removeFile = () => {
        setFile(null);
        setParsedIngredients([]);
        setErrorMsg(null);
        setSuccessCount(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleImportSubmit = async () => {
        if (parsedIngredients.length === 0) return;
        
        const invalidCount = parsedIngredients.filter(p => !p.isValid).length;
        if (invalidCount > 0) {
            if (!confirm(t('confirmIgnoreErrorsIngredients', { count: invalidCount }))) {
                return;
            }
        }

        const validIngredients = parsedIngredients
            .filter(p => p.isValid)
            .map(p => p.name);

        if (validIngredients.length === 0) {
            alert(t('noValidIngredients'));
            return;
        }

        setImporting(true);
        setErrorMsg(null);

        try {
            const result = await bulkInsertIngredientsAction(restaurantId, validIngredients);

            if (result.success) {
                setSuccessCount(result.count);
                setFile(null);
                setParsedIngredients([]);
                
                setTimeout(() => {
                    router.push(`/super-admin/restaurants/${restaurantId}/menu`);
                }, 2000);
            } else {
                setErrorMsg(result.error || t('errorBulkImport'));
            }
        } catch (err: any) {
            console.error('Bulk upload error:', err);
            setErrorMsg(err.message || t('errorBulkImport'));
        } finally {
            setImporting(false);
        }
    };

    const validCount = parsedIngredients.filter(p => p.isValid).length;
    const invalidCount = parsedIngredients.filter(p => !p.isValid).length;

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 w-full overflow-hidden">
            {/* Navigation Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/30 gap-4">
                <button
                    onClick={() => router.push(`/super-admin/restaurants/${restaurantId}/menu`)}
                    className="group flex items-center gap-3 px-6 py-3.5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px]"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    {t('backToMenu')}
                </button>

                <button
                    onClick={downloadSampleCSV}
                    className="group flex items-center gap-3 px-6 py-3.5 bg-slate-900/50 hover:bg-orange-500/10 border border-slate-800 hover:border-orange-500/20 text-slate-300 hover:text-orange-400 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px]"
                >
                    <Download className="w-4 h-4 text-orange-500" />
                    {t('downloadSample')}
                </button>
            </div>

            {/* Title */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-1 bg-orange-500 rounded-full"></span>
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">{t('bulkImportIngredientsTitle')}</span>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                    {t('bulkImportIngredientsTitle')}
                </h1>
                <p className="text-slate-500 font-bold text-xs mt-3 max-w-2xl">
                    {t('bulkImportIngredientsDesc')}
                </p>
            </div>

            {/* Notifications */}
            {errorMsg && (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-start gap-4">
                    <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">{t('validationError')}</h4>
                        <p className="text-slate-400 font-medium text-xs leading-relaxed">{errorMsg}</p>
                    </div>
                </div>
            )}

            {successCount !== null && (
                <div className="p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] flex items-center gap-5">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Check className="w-6 h-6 text-slate-900 stroke-[3]" />
                    </div>
                    <div>
                        <h4 className="text-base font-black text-white uppercase tracking-widest">{t('importSuccess')}</h4>
                        <p className="text-slate-400 font-bold text-xs mt-1">{t('ingredientsImportedSuccess', { count: successCount })}</p>
                    </div>
                </div>
            )}

            {/* CSV File Selection Zone */}
            {!file && successCount === null && (
                <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-[3rem] p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 relative group
                        ${isDragActive 
                            ? 'border-orange-500 bg-orange-500/5 shadow-inner' 
                            : 'border-slate-800 bg-slate-900/10 hover:border-slate-700 hover:bg-slate-900/30'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-orange-500/30 transition-all duration-500 group-hover:scale-105">
                        <Upload className="w-8 h-8 text-slate-600 group-hover:text-orange-500 transition-colors" />
                    </div>

                    <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-2">{t('dragCsvHere')}</h3>
                    <p className="text-slate-500 font-bold text-xs">{t('clickToBrowse')}</p>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-6 bg-slate-950 px-4 py-2 rounded-xl border border-slate-900">{t('csvFileLimit')}</p>
                </div>
            )}

            {/* Mapped Pre-visualization Table */}
            {file && parsedIngredients.length > 0 && (
                <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                    <div className="bg-slate-900/40 backdrop-blur-sm rounded-[2.5rem] border border-slate-850 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800">
                                <FileSpreadsheet className="w-6 h-6 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-base leading-none truncate max-w-xs">{file.name}</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex gap-4">
                                <div className="text-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <span className="block text-lg font-black text-emerald-500 leading-none">{validCount}</span>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('valid')}</span>
                                </div>
                                {invalidCount > 0 && (
                                    <div className="text-center px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                                        <span className="block text-lg font-black text-red-500 leading-none">{invalidCount}</span>
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('withError')}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={removeFile}
                                className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/25 active:scale-95"
                                title={t('deleteFile')}
                                disabled={importing}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Pre-visualization Data Table */}
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-[3rem] border border-slate-850 overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-slate-850 bg-slate-900/10">
                            <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{t('mappedIngredientsPreview')}</h3>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{t('reviewIngredientsBeforeProcessing')}</p>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar max-h-[50vh]">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950/20 border-b border-slate-850/80 sticky top-0 backdrop-blur-md z-10">
                                    <tr>
                                        <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest w-1/4">{t('status')}</th>
                                        <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('ingredientName')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850/50">
                                    {parsedIngredients.map((p, idx) => (
                                        <tr 
                                            key={idx} 
                                            className={`transition-colors 
                                                ${p.isValid 
                                                    ? 'hover:bg-slate-900/20' 
                                                    : 'bg-red-500/5 hover:bg-red-500/10'
                                                }`}
                                        >
                                            <td className="px-8 py-5">
                                                {p.isValid ? (
                                                    <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        {t('ready')}
                                                    </span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <span className="flex items-center gap-1.5 text-xs text-red-500 font-black uppercase tracking-wider">
                                                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                            {t('invalid')}
                                                        </span>
                                                        {p.errors.map((err, errIdx) => (
                                                            <span key={errIdx} className="block text-[9px] text-red-400/80 leading-normal font-bold">
                                                                • {err}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="block text-white text-sm uppercase italic font-black">{p.name || '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex justify-end gap-4">
                        <button
                            onClick={removeFile}
                            className="px-8 py-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] active:scale-95"
                            disabled={importing}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleImportSubmit}
                            disabled={importing || validCount === 0}
                            className="group flex items-center justify-center gap-3 px-10 py-4 bg-orange-500 disabled:bg-slate-800 text-slate-900 disabled:text-slate-500 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_25px_rgba(249,115,22,0.2)] disabled:shadow-none hover:-translate-y-0.5 disabled:hover:translate-y-0 transition-all active:scale-95 whitespace-nowrap"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>{t('importing')}</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>{t('processIngredients', { count: validCount })}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
