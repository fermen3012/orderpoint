'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ScrollText, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
    const params = useParams();
    const currentLocale = (params?.locale as string) || 'es';
    const [language, setLanguage] = useState<'es' | 'en'>(currentLocale === 'en' ? 'en' : 'es');

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-14 border border-slate-100">

                {/* Header with Language Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                            <ScrollText className="w-8 h-8" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-100/60 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                                Legal & Florida SaaS Agreement
                            </span>
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
                                {language === 'es' ? 'Términos y Condiciones de Servicio' : 'Terms & Conditions of Service'}
                            </h1>
                        </div>
                    </div>

                    {/* Language Switch Toggle */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl self-start sm:self-auto border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setLanguage('es')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                language === 'es'
                                    ? 'bg-white text-slate-900 shadow-md'
                                    : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            Español
                        </button>
                        <button
                            type="button"
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                language === 'en'
                                    ? 'bg-white text-slate-900 shadow-md'
                                    : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            English
                        </button>
                    </div>
                </div>

                {/* Notice Box */}
                <div className="mt-8 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3.5">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {language === 'es' ? (
                            <>
                                <strong>Marco Jurídico del Estado de Florida, EE. UU.:</strong> Este documento constituye un contrato legalmente vinculante entre su establecimiento gastronómico y <strong>Exo Advance LLC</strong> (compañía titular y proveedora de la plataforma y software <strong>OrderPoint</strong>). Su aceptación electrónica es plena y exigible conforme al Capítulo 668 de los Estatutos de Florida (UETA) y la ley federal E-SIGN.
                            </>
                        ) : (
                            <>
                                <strong>Governing Law (State of Florida, USA):</strong> This document constitutes a legally binding B2B contract between your restaurant business and <strong>Exo Advance LLC</strong> (the owning company and provider of the <strong>OrderPoint</strong> software platform). Electronic acceptance is fully valid and enforceable under Chapter 668 of the Florida Statutes (UETA) and the federal E-SIGN Act.
                            </>
                        )}
                    </p>
                </div>

                {/* Content */}
                <div className="mt-10 space-y-8 text-slate-600 font-medium leading-relaxed text-sm">
                    {language === 'es' ? (
                        <>
                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">1. Aceptación y Firma Electrónica</h2>
                                <p>
                                    Al suscribirse, crear una cuenta de propietario (Owner), acceder o utilizar la plataforma OrderPoint ("el Servicio" o "el Software"), usted acepta someterse irrevocablemente a estos Términos y Condiciones. Su consentimiento otorgado a través de casillas de verificación electrónica o formularios en línea tiene el mismo efecto y exigibilidad legal que una firma manuscrita, de conformidad con la <strong>Ley de Transacciones Electrónicas Uniformes de Florida (Florida Uniform Electronic Transaction Act - UETA, Fla. Stat. § 668.50)</strong> y la Ley Federal E-SIGN (15 U.S.C. § 7001).
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">2. Objeto y Licencia de Software SaaS B2B</h2>
                                <p>
                                    OrderPoint otorga al Restaurante una licencia no exclusiva, revocable, intransferible y sujeta a suscripción para utilizar nuestra plataforma en la nube para restaurantes. El Servicio comprende:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-3 text-xs text-slate-600">
                                    <li>Kiosko de Autoservicio interactivo para comensales.</li>
                                    <li>Sistema de visualización de cocina (Kitchen Display System - KDS reactivo en tiempo real).</li>
                                    <li>Módulo móvil de servicio y toma de comandas para meseros (Exo Server).</li>
                                    <li>Gestión de catálogo, categorías, modificadores, ingredientes y menús QR para mesas.</li>
                                    <li>Integración de impresión de tickets térmicos Bluetooth y red (protocolo ESC/POS).</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">3. Operaciones Gastronómicas, Salubridad y Alérgenos (Florida DBPR / DOH)</h2>
                                <p>
                                    El Restaurante opera de forma independiente y asume la responsabilidad exclusiva sobre el negocio de comida y bebidas:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-3 text-xs text-slate-600">
                                    <li><strong>Inocuidad Alimentaria:</strong> El Restaurante es el único responsable de la preparación, temperaturas, frescura y cocción de los alimentos de conformidad con las normativas sanitarias del <strong>Departamento de Salud de Florida (Florida Department of Health)</strong> y la División de Hoteles y Restaurantes del <strong>Departamento de Regulación Comercial y Profesional de Florida (DBPR)</strong>.</li>
                                    <li><strong>Alérgenos y Advertencias:</strong> El Restaurante es exclusivamente responsable de especificar ingredientes y advertencias obligatorias sobre alérgenos mayores (mariscos, frutos secos, lácteos, soja, trigo, etc.) y avisos al consumidor sobre carnes crudas o poco cocidas.</li>
                                    <li><strong>Deslinde de Responsabilidad:</strong> OrderPoint es una empresa proveedora de software y <strong>no asume responsabilidad alguna</strong> por enfermedades de origen alimentario, quejas de clientes, intoxicaciones o incidentes en el salón.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">4. Facturación, Suscripciones (Stripe) e Impuestos de Florida</h2>
                                <p>
                                    Las tarifas por el uso de OrderPoint se abonan de forma periódica a través de la pasarela de pagos Stripe Subscriptions. En relación con las órdenes de comida cobradas a sus clientes:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-3 text-xs text-slate-600">
                                    <li>El Restaurante es el Comerciante Registrado (Merchant of Record).</li>
                                    <li>El Restaurante es el único obligado tributario responsable de recaudar y remitir el Impuesto sobre las Ventas de Florida (<strong>Florida Sales and Use Tax, Fla. Stat. Cap. 212</strong>) ante el Departamento de Rentas de Florida (Florida Department of Revenue).</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">5. Seguridad de Datos y Privacidad (Florida FIPA)</h2>
                                <p>
                                    OrderPoint protege la información confidencial mediante estándares de la industria y en cumplimiento de la <strong>Ley de Protección de Información de Florida (Florida Information Protection Act - FIPA, Fla. Stat. § 501.171)</strong>. Los datos de tarjetas bancarias son tokenizados y procesados directamente por Stripe; ningún número completo de tarjeta de crédito/débito se guarda en los servidores de OrderPoint. El Restaurante es el propietario de sus datos de ventas y menú.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">6. Herramientas de Inteligencia Artificial (Google Gemini API)</h2>
                                <p>
                                    El software integra funciones automatizadas por IA para apoyo de traducción de cartas y asistencia. Estas herramientas se entregan "tal cual". El Restaurante tiene la obligación inexcusable de revisar y confirmar la exactitud de cualquier texto traducido o sugerido antes de que sea visualizado por sus comensales.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">7. Exclusión de Garantías y Limitación de Responsabilidad</h2>
                                <p className="uppercase text-xs font-bold leading-relaxed">
                                    EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY DEL ESTADO DE FLORIDA, EL SERVICIO SE ENTREGA "TAL CUAL" ("AS IS") Y "SEGÚN DISPONIBILIDAD" ("AS AVAILABLE"), SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS, INCLUIDAS LAS GARANTÍAS DE COMERCIABILIDAD, APTITUD PARA UN PROPÓSITO PARTICULAR O LIBRE DE ERRORES. EN NINGÚN CASO LA RESPONSABILIDAD TOTAL DE ORDERPOINT EXCEDERÁ EL MONTO TOTAL PAGADO POR EL CLIENTE POR EL SERVICIO EN LOS TRES (3) MESES ANTERIORES AL EVENTO QUE ORIGINÓ LA RECLAMACIÓN.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">8. Indemnización</h2>
                                <p>
                                    El Restaurante acepta indemnizar, defender y eximir de toda responsabilidad a OrderPoint, sus desarrolladores, directivos, empleados y afiliados, frente a cualquier reclamo, pérdida, daño, demanda o gasto (incluidos honorarios razonables de abogados) derivados de la operación gastronómica del cliente, preparación de alimentos, relaciones con empleados o reclamos tributarios.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">9. Ley Aplicable, Jurisdicción y Renuncia a Juicio por Jurado</h2>
                                <p>
                                    Este Acuerdo se rige e interpreta exclusivamente según las leyes del <strong>Estado de Florida, Estados Unidos de América</strong>. Cualquier controversia legal será sometida a la jurisdicción exclusiva de los tribunales estatales o federales con sede en el Estado de Florida. <strong>AMBAS PARTES RENUNCIAN IRREVOCABLEMENTE AL DERECHO A JUICIO POR JURADO Y A CUALQUIER PARTICIPACIÓN EN ACCIONES O DEMANDAS COLECTIVAS (CLASS ACTION WAIVER).</strong>
                                </p>
                            </section>
                        </>
                    ) : (
                        <>
                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">1. Acceptance and Electronic Execution</h2>
                                <p>
                                    By subscribing, creating an Owner administrator account, accessing, or using the OrderPoint platform ("the Service" or "Software"), you irrevocably agree to be bound by these Terms and Conditions. Your electronic consent provided via online checkboxes or forms carries the same legal weight, enforceability, and validity as a physical handwritten signature under the <strong>Florida Uniform Electronic Transaction Act (Fla. Stat. § 668.50)</strong> and the Federal E-SIGN Act (15 U.S.C. § 7001).
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">2. Scope & B2B SaaS Software License</h2>
                                <p>
                                    OrderPoint grants the Restaurant a non-exclusive, revocable, non-transferable, subscription-based license to access our cloud-hosted restaurant management platform. The Service includes:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-3 text-xs text-slate-600">
                                    <li>Interactive touchscreen Self-Service Kiosk for guests.</li>
                                    <li>Real-time reactive Kitchen Display System (KDS).</li>
                                    <li>Mobile waiter ordering and table service management (Exo Server).</li>
                                    <li>Menu management, modifier groups, removable ingredients, and QR table menus.</li>
                                    <li>ESC/POS thermal ticket printing integration over Bluetooth and network.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">3. Restaurant Operations, Food Safety & Allergens (Florida DBPR / DOH)</h2>
                                <p>
                                    The Restaurant operates independently and retains sole and exclusive responsibility for its food and beverage business:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-3 text-xs text-slate-600">
                                    <li><strong>Food Safety & Sanitation:</strong> The Restaurant is solely responsible for food preparation, proper storage temperatures, sanitation, and compliance with the <strong>Florida Department of Health</strong> and the Division of Hotels and Restaurants under the <strong>Florida Department of Business and Professional Regulation (DBPR)</strong>.</li>
                                    <li><strong>Allergen Disclosures & Warnings:</strong> The Restaurant is strictly responsible for disclosing major food allergens (shellfish, nuts, dairy, soy, gluten, etc.) and required consumer advisories regarding raw or undercooked meats and eggs.</li>
                                    <li><strong>Disclaimer:</strong> OrderPoint is exclusively a technology software provider and <strong>disclaims all liability</strong> for foodborne illness, customer allergies, dining room disputes, or property damage.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">4. Billing, Subscriptions (Stripe) & Florida Taxes</h2>
                                <p>
                                    OrderPoint software fees are billed on a recurring subscription basis via Stripe. Concerning consumer food sales:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-3 text-xs text-slate-600">
                                    <li>The Restaurant acts as the sole Merchant of Record.</li>
                                    <li>The Restaurant is strictly responsible for collecting and remitting Florida Sales and Use Tax (<strong>Fla. Stat. Chapter 212</strong>) to the Florida Department of Revenue.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">5. Data Protection and Privacy (Florida FIPA)</h2>
                                <p>
                                    OrderPoint protects customer and business information in compliance with the <strong>Florida Information Protection Act (FIPA, Fla. Stat. § 501.171)</strong> and PCI-DSS standards. Payment card data is processed directly and securely by Stripe; OrderPoint servers never store raw credit card numbers. The Restaurant retains full ownership of its operational data.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">6. Artificial Intelligence Features (Google Gemini API)</h2>
                                <p>
                                    OrderPoint provides automated AI services for translations and assistance. These features are provided "AS IS". The Restaurant must independently verify all AI-translated menu descriptions, allergen notices, and pricing before publishing.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">7. Disclaimer of Warranties and Limitation of Liability</h2>
                                <p className="uppercase text-xs font-bold leading-relaxed">
                                    TO THE MAXIMUM EXTENT PERMITTED BY FLORIDA LAW, THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. IN NO EVENT SHALL ORDERPOINT'S AGGREGATE LIABILITY EXCEED THE TOTAL AMOUNT PAID BY THE RESTAURANT IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">8. Indemnification</h2>
                                <p>
                                    The Restaurant agrees to defend, indemnify, and hold harmless OrderPoint, its developers, officers, and employees from any third-party claims, liabilities, or legal expenses arising from restaurant operations, food service quality, staff labor claims, or tax non-compliance.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-black text-slate-900 mb-3">9. Governing Law, Venue & Waiver of Jury Trial</h2>
                                <p>
                                    This Agreement shall be governed by and construed in accordance with the substantive laws of the <strong>State of Florida, United States of America</strong>. Any legal action shall be brought exclusively in the state or federal courts located in Florida. <strong>BOTH PARTIES VOLUNTARILY AND IRREVOCABLY WAIVE ANY RIGHT TO A TRIAL BY JURY AND AGREE NOT TO PARTICIPATE IN ANY CLASS ACTION PROCEEDINGS (CLASS ACTION WAIVER).</strong>
                                </p>
                            </section>
                        </>
                    )}

                    <section className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                        <div>
                            <strong>Versión / Version:</strong> 2.0 (Florida Law Compliance) <br />
                            <strong>Actualización / Last Updated:</strong> Octubre / October 2026
                        </div>
                        <div className="text-slate-500 font-bold">
                            Exo Advance LLC (OrderPoint) • State of Florida, USA
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
