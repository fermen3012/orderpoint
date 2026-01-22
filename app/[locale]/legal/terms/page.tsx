import { useTranslations } from 'next-intl';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8 sm:p-12 border border-slate-100">
                <h1 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">Términos y Condiciones de Servicio</h1>

                <div className="prose prose-slate max-w-none space-y-6 text-slate-600 font-medium leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">1. Aceptación de los Términos</h2>
                        <p>
                            Al registrarse y utilizar la plataforma OrderPoint ("el Servicio"), usted ("el Usuario" o "el Restaurante") acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al Servicio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">2. Descripción del Servicio</h2>
                        <p>
                            OrderPoint proporciona una solución de Software como Servicio (SaaS) para la gestión de pedidos, quioscos de autoservicio y sistemas de visualización de cocina para establecimientos gastronómicos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">3. Registro y Cuentas</h2>
                        <p>
                            Para utilizar el Servicio, el Restaurante debe proporcionar información precisa y completa. El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades que ocurran bajo su cuenta.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">4. Propiedad Intelectual</h2>
                        <p>
                            Todo el contenido, software y tecnología utilizada en el Servicio es propiedad de OrderPoint o sus licenciantes. El Usuario recibe una licencia limitada, no exclusiva y no transferible para utilizar el Servicio de acuerdo con estos términos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">5. Privacidad y Datos</h2>
                        <p>
                            La recopilación y el uso de la información personal se rigen por nuestra Política de Privacidad. El Restaurante es responsable de cumplir con las leyes de protección de datos locales en relación con la información de sus propios clientes finales.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">6. Limitación de Responsabilidad</h2>
                        <p>
                            En la medida máxima permitida por la ley, OrderPoint no será responsable de ningún daño indirecto, incidental, especial, consecuente o punitivo que resulte de su acceso o uso del Servicio.
                        </p>
                    </section>

                    <section className="pt-8 border-t border-slate-100">
                        <p className="text-sm text-slate-400 italic">
                            Versión: 1.0 <br />
                            Última actualización: 16 de enero de 2026
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
