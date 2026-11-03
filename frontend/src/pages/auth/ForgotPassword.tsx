import { Head, Link, useForm } from "@inertiajs/react";
import { Mail, ArrowLeft } from "lucide-react";
import Logo from "@components/Logo";
import type { Flash } from "@lib/types";

interface Props {
    flash?: Flash;
}

export default function ForgotPassword({ flash }: Props) {
    const form = useForm({
        email: "",
    });

    function submitForm(e: React.FormEvent) {
        e.preventDefault();
        form.post("/forgot-password");
    }

    return (
        <>
            <Head title="Forgot Password - Laju Go" />

            <section className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center">
                <div className="w-full max-w-md px-6">
                    <div className="flex justify-center mb-8">
                        <Logo size={48} />
                    </div>

                    <div className="bg-white dark:bg-neutral-925/80 backdrop-blur-xl rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] p-8 shadow-xl shadow-black/5 dark:shadow-black/20">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-400/15 flex items-center justify-center">
                                <Mail className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Forgot password?</h2>
                            <p className="text-neutral-600 dark:text-neutral-400 mt-2">No worries, we'll send you reset instructions</p>
                        </div>

                        {flash?.error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-400 text-sm">{flash.error}</span>
                            </div>
                        )}

                        {flash?.success && (
                            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                                <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-green-400 text-sm">{flash.success}</span>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={submitForm}>
                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <input
                                        value={form.data.email}
                                        onChange={(e) => form.setData("email", e.target.value)}
                                        type="email"
                                        name="email"
                                        id="email"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700/80 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors duration-200"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={form.processing}
                                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold dark:bg-brand-500 dark:hover:bg-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:ring-offset-2 focus:ring-offset-neutral-100 dark:focus:ring-offset-neutral-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {form.processing ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>Send reset link</>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                Back to sign in
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
