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
    Check,
    Camera,
    Sparkles,
    ImagePlus,
    Plus,
    X
} from 'lucide-react';
import Papa from 'papaparse';
import { bulkInsertProductsAction } from '@/actions/products';
import { extractMenuFromImagesWithGemini, MenuImagePayload } from '@/actions/translate-gemini';
import { useTranslations } from 'next-intl';

interface ManageImportPageProps {
    params: Promise<{
        id: string;
    }>;
}

interface ParsedProduct {
    nombre_es: string;
    nombre_en: string;
    descripcion_es: string;
    descripcion_en: string;
    precio: string;
    categoria: string;
    isValid: boolean;
    errors: string[];
}

interface SelectedPhoto {
    file: File;
    previewUrl: string;
}

export default function ManageImportPage({ params }: ManageImportPageProps) {
    const resolvedParams = use(params);
    const restaurantId = resolvedParams.id;
    const router = useRouter();
    const t = useTranslations('admin');
    
    const [activeMode, setActiveMode] = useState<'ai' | 'csv'>('ai');
    const [file, setFile] = useState<File | null>(null);
    const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
    const [scanningAi, setScanningAi] = useState(false);
    const [aiSourceCount, setAiSourceCount] = useState<number | null>(null);
    const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const [importing, setImporting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const validateProductFields = (row: {
        nombre_es: string;
        nombre_en: string;
        descripcion_es: string;
        descripcion_en: string;
        precio: string;
        categoria: string;
    }): ParsedProduct => {
        const nombre_es = (row.nombre_es || '').trim();
        const nombre_en = (row.nombre_en || '').trim();
        const descripcion_es = (row.descripcion_es || '').trim();
        const descripcion_en = (row.descripcion_en || '').trim();
        const precio = String(row.precio ?? '').trim();
        const categoria = (row.categoria || '').trim();

        const errors: string[] = [];

        if (!nombre_es) {
            errors.push(t('errorNameEs'));
        }
        if (!precio) {
            errors.push(t('errorPriceMissing'));
        } else if (isNaN(Number(precio)) || Number(precio) < 0) {
            errors.push(t('errorPriceInvalid'));
        }
        if (!categoria) {
            errors.push(t('errorCategoryMissing'));
        }

        return {
            nombre_es: row.nombre_es,
            nombre_en: row.nombre_en,
            descripcion_es: row.descripcion_es,
            descripcion_en: row.descripcion_en,
            precio: row.precio,
            categoria: row.categoria,
            isValid: errors.length === 0,
            errors
        };
    };

    const downloadSampleCSV = () => {
        const csvContent = "\uFEFFnombre_es,nombre_en,descripcion_es,descripcion_en,precio,categoria\n" +
            "Tacos al Pastor,Pastor Tacos,Tres deliciosos tacos de cerdo con piña y cilantro,Three delicious pork tacos with pineapple and cilantro,3.50,Tacos\n" +
            "Hamburguesa Clásica,Classic Burger,Carne de res de 150g con queso cheddar y papas fritas,150g beef patty with cheddar cheese and french fries,6.99,Hamburguesas\n" +
            "Limonada Natural,Fresh Lemonade,Limonada refrescante hecha al momento,Refreshing freshly made lemonade,2.00,Bebidas";

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_platos.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadGeneratedCSV = () => {
        if (parsedProducts.length === 0) return;

        const cleanRows = parsedProducts.map(p => ({
            nombre_es: (p.nombre_es || '').trim(),
            nombre_en: (p.nombre_en || p.nombre_es || '').trim(),
            descripcion_es: (p.descripcion_es || '').trim(),
            descripcion_en: (p.descripcion_en || '').trim(),
            precio: !isNaN(Number(p.precio)) && p.precio !== '' ? Number(p.precio).toFixed(2) : p.precio,
            categoria: (p.categoria || 'General').trim()
        }));

        const csvString = Papa.unparse(cleanRows, {
            columns: ['nombre_es', 'nombre_en', 'descripcion_es', 'descripcion_en', 'precio', 'categoria']
        });

        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_platos.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const compressImageToBase64 = (imageFile: File): Promise<MenuImagePayload> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_DIM = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height && width > MAX_DIM) {
                        height = Math.round((height * MAX_DIM) / width);
                        width = MAX_DIM;
                    } else if (height > MAX_DIM) {
                        width = Math.round((width * MAX_DIM) / height);
                        height = MAX_DIM;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        reject(new Error('No se pudo inicializar el compresor de imagen.'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
                    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
                    resolve({
                        mimeType: 'image/jpeg',
                        base64Data
                    });
                };
                img.onerror = () => reject(new Error('Error al leer la imagen seleccionada.'));
                img.src = event.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Error al cargar el archivo de imagen.'));
            reader.readAsDataURL(imageFile);
        });
    };

    const handlePhotosSelected = (filesList: FileList | null) => {
        if (!filesList || filesList.length === 0) return;
        setErrorMsg(null);
        setSuccessCount(null);

        const validFiles: SelectedPhoto[] = [];
        for (let i = 0; i < filesList.length; i++) {
            const f = filesList[i];
            if (f.type.startsWith('image/')) {
                validFiles.push({
                    file: f,
                    previewUrl: URL.createObjectURL(f)
                });
            }
        }

        if (validFiles.length === 0) {
            setErrorMsg(t('onlyImagesAllowed'));
            return;
        }

        setSelectedPhotos(prev => [...prev, ...validFiles]);
    };

    const removePhotoAt = (index: number) => {
        setSelectedPhotos(prev => {
            const copy = [...prev];
            if (copy[index]?.previewUrl) {
                URL.revokeObjectURL(copy[index].previewUrl);
            }
            copy.splice(index, 1);
            return copy;
        });
    };

    const clearAllPhotos = () => {
        selectedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
        setSelectedPhotos([]);
        if (photoInputRef.current) photoInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleScanWithAi = async () => {
        if (selectedPhotos.length === 0) return;

        setScanningAi(true);
        setErrorMsg(null);
        setSuccessCount(null);

        try {
            const compressedImages: MenuImagePayload[] = [];
            for (const item of selectedPhotos) {
                const payload = await compressImageToBase64(item.file);
                compressedImages.push(payload);
            }

            // Process in batches of 2 images per Server Action call to stay well below 1MB body limit
            const BATCH_SIZE = 2;
            const allExtractedDishes: ParsedProduct[] = [];

            for (let i = 0; i < compressedImages.length; i += BATCH_SIZE) {
                const batch = compressedImages.slice(i, i + BATCH_SIZE);
                const res = await extractMenuFromImagesWithGemini(batch);

                if (!res.success) {
                    setErrorMsg(res.error || t('errorBulkImport'));
                    setScanningAi(false);
                    return;
                }

                for (const dish of res.dishes) {
                    allExtractedDishes.push(validateProductFields(dish));
                }
            }

            if (allExtractedDishes.length === 0) {
                setErrorMsg(t('noDishesDetectedInPhoto'));
                setScanningAi(false);
                return;
            }

            setAiSourceCount(selectedPhotos.length);
            setFile(null);
            setParsedProducts(allExtractedDishes);
        } catch (err: any) {
            console.error('AI Menu Scan error:', err);
            setErrorMsg(err.message || t('errorBulkImport'));
        } finally {
            setScanningAi(false);
        }
    };

    const processFile = (file: File) => {
        setErrorMsg(null);
        setSuccessCount(null);
        setAiSourceCount(null);
        setFile(file);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as any[];
                
                // Validate headers
                const expectedHeaders = ['nombre_es', 'nombre_en', 'descripcion_es', 'descripcion_en', 'precio', 'categoria'];
                const fileHeaders = results.meta.fields || [];
                const missingHeaders = expectedHeaders.filter(h => !fileHeaders.includes(h));

                if (missingHeaders.length > 0) {
                    setErrorMsg(t('errorMissingHeaders', { missing: missingHeaders.join(', ') }));
                    setFile(null);
                    setParsedProducts([]);
                    return;
                }

                const productsList: ParsedProduct[] = rows.map((row) =>
                    validateProductFields({
                        nombre_es: (row.nombre_es || '').trim(),
                        nombre_en: (row.nombre_en || '').trim(),
                        descripcion_es: (row.descripcion_es || '').trim(),
                        descripcion_en: (row.descripcion_en || '').trim(),
                        precio: (row.precio || '').trim(),
                        categoria: (row.categoria || '').trim()
                    })
                );

                setParsedProducts(productsList);
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

        if (activeMode === 'ai') {
            handlePhotosSelected(e.dataTransfer.files);
            return;
        }

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
        setAiSourceCount(null);
        clearAllPhotos();
        setParsedProducts([]);
        setErrorMsg(null);
        setSuccessCount(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFieldChange = (
        index: number,
        field: 'nombre_es' | 'nombre_en' | 'descripcion_es' | 'descripcion_en' | 'precio' | 'categoria',
        value: string
    ) => {
        setParsedProducts(prev => {
            const updated = [...prev];
            const current = { ...updated[index], [field]: value };
            updated[index] = validateProductFields(current);
            return updated;
        });
    };

    const handleDeleteRow = (index: number) => {
        setParsedProducts(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleAddRow = () => {
        setParsedProducts(prev => [
            ...prev,
            validateProductFields({
                nombre_es: '',
                nombre_en: '',
                descripcion_es: '',
                descripcion_en: '',
                precio: '0.00',
                categoria: 'General'
            })
        ]);
    };

    const handleImportSubmit = async () => {
        if (parsedProducts.length === 0) return;
        
        const invalidCount = parsedProducts.filter(p => !p.isValid).length;
        if (invalidCount > 0) {
            if (!confirm(t('confirmIgnoreErrorsDishes', { count: invalidCount }))) {
                return;
            }
        }

        const validProducts = parsedProducts
            .filter(p => p.isValid)
            .map(p => ({
                name: {
                    es: p.nombre_es.trim(),
                    en: (p.nombre_en || p.nombre_es).trim()
                },
                description: {
                    es: (p.descripcion_es || '').trim(),
                    en: (p.descripcion_en || '').trim()
                },
                price: parseFloat(p.precio),
                category: (p.categoria || 'General').trim()
            }));

        if (validProducts.length === 0) {
            alert(t('noValidDishes'));
            return;
        }

        setImporting(true);
        setErrorMsg(null);

        try {
            const result = await bulkInsertProductsAction(restaurantId, validProducts);

            if (result.success) {
                setSuccessCount(result.count);
                setFile(null);
                setAiSourceCount(null);
                clearAllPhotos();
                setParsedProducts([]);
                
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

    const validCount = parsedProducts.filter(p => p.isValid).length;
    const invalidCount = parsedProducts.filter(p => !p.isValid).length;
    const hasPreviewData = parsedProducts.length > 0;

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 w-full overflow-hidden">
            {/* Navigation Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800/30 gap-4">
                <button
                    onClick={() => router.push('/super-admin/restaurants')}
                    className="group flex items-center gap-3 px-6 py-3.5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px]"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    {t('backToTenants')}
                </button>

                <button
                    onClick={downloadSampleCSV}
                    className="group flex items-center gap-3 px-6 py-3.5 bg-slate-900/50 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/20 text-slate-300 hover:text-emerald-400 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px]"
                >
                    <Download className="w-4 h-4 text-emerald-500" />
                    {t('downloadSample')}
                </button>
            </div>

            {/* Title & Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">{t('bulkImporter')}</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {t('bulkImportDishesTitle')}
                    </h1>
                    <p className="text-slate-500 font-bold text-xs mt-3 max-w-2xl">
                        {t('bulkImportDishesDesc')}
                    </p>
                </div>

                {!hasPreviewData && successCount === null && (
                    <div className="inline-flex p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl self-start lg:self-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveMode('ai');
                                setErrorMsg(null);
                            }}
                            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
                                activeMode === 'ai'
                                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Sparkles className="w-4 h-4" />
                            {t('modeAiScanner')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveMode('csv');
                                setErrorMsg(null);
                            }}
                            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
                                activeMode === 'csv'
                                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            {t('modeCsvUpload')}
                        </button>
                    </div>
                )}
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
                        <p className="text-slate-400 font-bold text-xs mt-1">{t('dishesImportedSuccess', { count: successCount })}</p>
                    </div>
                </div>
            )}

            {/* MODE A: AI Menu Photo Scanner Zone */}
            {!hasPreviewData && successCount === null && activeMode === 'ai' && (
                <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-[3rem] p-8 md:p-14 flex flex-col items-center justify-center text-center transition-all duration-500 relative
                        ${isDragActive 
                            ? 'border-emerald-500 bg-emerald-500/5 shadow-inner' 
                            : 'border-slate-800 bg-slate-900/10 hover:border-slate-700'
                        }`}
                >
                    {/* Hidden Inputs for Gallery (multi) and Direct Mobile Camera */}
                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handlePhotosSelected(e.target.files)}
                        className="hidden"
                    />
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotosSelected(e.target.files)}
                        className="hidden"
                    />

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-6">
                        <Sparkles className="w-3.5 h-3.5" />
                        {t('aiScannerBadge')}
                    </div>

                    {selectedPhotos.length === 0 ? (
                        <>
                            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800">
                                <Camera className="w-9 h-9 text-emerald-500" />
                            </div>

                            <h3 className="text-xl md:text-2xl font-black text-white italic tracking-tighter uppercase mb-2">
                                {t('takeMenuPhotoOrUpload')}
                            </h3>
                            <p className="text-slate-400 font-bold text-xs max-w-xl leading-relaxed mb-8">
                                {t('aiPhotoInstructions')}
                            </p>

                            <div className="flex flex-wrap items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="flex items-center gap-3 px-7 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-[0_10px_25px_rgba(16,185,129,0.25)] transition-all active:scale-95"
                                >
                                    <Camera className="w-4 h-4" />
                                    {t('openCamera')}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    className="flex items-center gap-3 px-7 py-4 bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-95"
                                >
                                    <ImagePlus className="w-4 h-4 text-emerald-500" />
                                    {t('selectPhotos')}
                                </button>
                            </div>

                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-6 bg-slate-950 px-4 py-2 rounded-xl border border-slate-900">
                                {t('photoFormatLimit')}
                            </p>
                        </>
                    ) : (
                        <div className="w-full max-w-4xl space-y-6">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                                <span className="text-xs font-black text-white uppercase tracking-widest">
                                    {t('selectedPhotosCount', { count: selectedPhotos.length })}
                                </span>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={scanningAi}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <Camera className="w-3.5 h-3.5 text-emerald-500" />
                                        {t('openCamera')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        disabled={scanningAi}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5 text-emerald-500" />
                                        {t('addMorePhotos')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearAllPhotos}
                                        disabled={scanningAi}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        {t('clearPhotos')}
                                    </button>
                                </div>
                            </div>

                            {/* Photo Thumbnails Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {selectedPhotos.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[3/4]"
                                    >
                                        <img
                                            src={item.previewUrl}
                                            alt={`Menu page ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end justify-between p-3">
                                            <span className="px-2.5 py-1 bg-slate-900/90 text-white font-black text-[9px] uppercase tracking-widest rounded-lg border border-slate-700">
                                                Pág. #{idx + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removePhotoAt(idx)}
                                                disabled={scanningAi}
                                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Execute AI OCR Button */}
                            <div className="pt-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleScanWithAi}
                                    disabled={scanningAi}
                                    className="flex items-center justify-center gap-3 px-10 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_10px_30px_rgba(16,185,129,0.25)] transition-all active:scale-95"
                                >
                                    {scanningAi ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                                            <span>{t('scanningMenuWithAi')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            <span>{t('scanWithAiBtn')}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODE B: CSV File Selection Zone */}
            {!hasPreviewData && successCount === null && activeMode === 'csv' && (
                <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-[3rem] p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 relative group
                        ${isDragActive 
                            ? 'border-emerald-500 bg-emerald-500/5 shadow-inner' 
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

                    <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-emerald-500/30 transition-all duration-500 group-hover:scale-105">
                        <Upload className="w-8 h-8 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                    </div>

                    <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mb-2">{t('dragCsvHere')}</h3>
                    <p className="text-slate-500 font-bold text-xs">{t('clickToBrowse')}</p>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-6 bg-slate-950 px-4 py-2 rounded-xl border border-slate-900">{t('csvFileLimit')}</p>
                </div>
            )}

            {/* Mapped & Editable Pre-visualization Table */}
            {hasPreviewData && (
                <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                    <div className="bg-slate-900/40 backdrop-blur-sm rounded-[2.5rem] border border-slate-850 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800">
                                {aiSourceCount ? (
                                    <Sparkles className="w-6 h-6 text-emerald-500" />
                                ) : (
                                    <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-black text-white text-base leading-none truncate max-w-xs">
                                    {aiSourceCount
                                        ? t('aiExtractedSource', { count: aiSourceCount })
                                        : file?.name || 'plantilla_platos.csv'}
                                </h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                    {file ? `${(file.size / 1024).toFixed(2)} KB` : `${parsedProducts.length} platos detectados`}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex gap-3">
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
                                type="button"
                                onClick={downloadGeneratedCSV}
                                className="flex items-center gap-2.5 px-5 py-3 bg-slate-950 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 text-emerald-400 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                {t('downloadGeneratedCsv')}
                            </button>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="flex items-center gap-2 px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] active:scale-95"
                            >
                                <Plus className="w-4 h-4 text-emerald-500" />
                                {t('addDishRow')}
                            </button>

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

                    {/* Pre-visualization Editable Data Table */}
                    <div className="bg-slate-900/30 backdrop-blur-sm rounded-[3rem] border border-slate-850 overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-slate-850 bg-slate-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{t('mappedPreview')}</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-1.5">{t('editablePreviewHint')}</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950/60 border-b border-slate-850/80 sticky top-0 backdrop-blur-md z-10">
                                    <tr>
                                        <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('status')}</th>
                                        <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest min-w-[240px]">{t('nameEsEn')}</th>
                                        <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest min-w-[300px]">{t('descEsEn')}</th>
                                        <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest w-[130px]">{t('price')}</th>
                                        <th className="px-6 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest w-[170px]">{t('category')}</th>
                                        <th className="px-4 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center w-[60px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850/50">
                                    {parsedProducts.map((p, idx) => (
                                        <tr 
                                            key={idx} 
                                            className={`transition-colors align-top
                                                ${p.isValid 
                                                    ? 'hover:bg-slate-900/20' 
                                                    : 'bg-red-500/5 hover:bg-red-500/10'
                                                }`}
                                        >
                                            <td className="px-6 py-4">
                                                {p.isValid ? (
                                                    <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold mt-2">
                                                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                                        {t('ready')}
                                                    </span>
                                                ) : (
                                                    <div className="space-y-1 max-w-[160px] mt-1">
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
                                            <td className="px-6 py-4 space-y-1.5">
                                                <input
                                                    type="text"
                                                    value={p.nombre_es}
                                                    onChange={(e) => handleFieldChange(idx, 'nombre_es', e.target.value)}
                                                    placeholder="ES: Nombre del plato"
                                                    className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-white text-xs font-black uppercase italic outline-none transition-colors"
                                                />
                                                <input
                                                    type="text"
                                                    value={p.nombre_en}
                                                    onChange={(e) => handleFieldChange(idx, 'nombre_en', e.target.value)}
                                                    placeholder="EN: Dish name"
                                                    className="w-full px-3 py-1 bg-slate-950/40 border border-slate-800/70 focus:border-emerald-500/50 rounded-xl text-slate-400 text-[11px] font-bold outline-none transition-colors"
                                                />
                                            </td>
                                            <td className="px-6 py-4 space-y-1.5">
                                                <input
                                                    type="text"
                                                    value={p.descripcion_es}
                                                    onChange={(e) => handleFieldChange(idx, 'descripcion_es', e.target.value)}
                                                    placeholder="ES: Descripción en español"
                                                    className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-200 text-xs font-medium outline-none transition-colors"
                                                />
                                                <input
                                                    type="text"
                                                    value={p.descripcion_en}
                                                    onChange={(e) => handleFieldChange(idx, 'descripcion_en', e.target.value)}
                                                    placeholder="EN: English description"
                                                    className="w-full px-3 py-1 bg-slate-950/40 border border-slate-800/70 focus:border-emerald-500/50 rounded-xl text-slate-400 text-[11px] font-medium outline-none transition-colors"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-500">$</span>
                                                    <input
                                                        type="text"
                                                        value={p.precio}
                                                        onChange={(e) => handleFieldChange(idx, 'precio', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-full pl-7 pr-3 py-2 bg-slate-950/70 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-emerald-400 font-black text-xs outline-none transition-colors"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={p.categoria}
                                                    onChange={(e) => handleFieldChange(idx, 'categoria', e.target.value)}
                                                    placeholder="Categoría"
                                                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 focus:border-emerald-500/50 rounded-xl text-slate-300 font-black text-[10px] uppercase tracking-widest outline-none transition-colors"
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRow(idx)}
                                                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all mt-1"
                                                    title={t('delete')}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex flex-wrap justify-end gap-4">
                        <button
                            onClick={removeFile}
                            className="px-8 py-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] active:scale-95"
                            disabled={importing}
                        >
                            {t('cancel')}
                        </button>

                        <button
                            type="button"
                            onClick={downloadGeneratedCSV}
                            disabled={importing}
                            className="flex items-center gap-2.5 px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-400 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                            {t('downloadGeneratedCsv')}
                        </button>

                        <button
                            onClick={handleImportSubmit}
                            disabled={importing || validCount === 0}
                            className="group flex items-center justify-center gap-3 px-10 py-4 bg-emerald-500 disabled:bg-slate-800 text-slate-900 disabled:text-slate-500 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_25px_rgba(16,185,129,0.2)] disabled:shadow-none hover:-translate-y-0.5 disabled:hover:translate-y-0 transition-all active:scale-95 whitespace-nowrap"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>{t('importing')}</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>{t('processDishes', { count: validCount })}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
