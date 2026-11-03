import { Head } from "@inertiajs/react";
import Logo from "@components/Logo";
import type { Flash } from "@lib/types";

interface Props {
    /** Form title (e.g. "Sign in", "Create account"). */
    title: string;
    /** Form subtitle shown under title. */
    subtitle?: string;
    /** Document <title> shown by browser tab. Defaults to title. */
    pageTitle?: string;
    /** Branding headline shown in desktop left panel. */
    headline: string;
    /** Branding subheadline shown under headline. */
    subheadline: string;
    /** Optional branding stats — array of { value, label }. */
    stats?: { value: string; label: string }[];
    /** Flash messages from server (set via Flash() cookies on server). */
    flash?: Flash;
    children: React.ReactNode;
}

export default function AuthLayout({
    title,
    subtitle,
    pageTitle,
    headline,
    subheadline,
    stats,
    flash,
    children,
}: Props) {
    return (
        <>
            <Head title={`${pageTitle ?? title} - Laju Go`} />

            <section className="min-h-screen bg-white dark:bg-neutral-950 flex">
                {/* Left Side - Branding (Desktop only) */}
                <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
                    <div className="relative z-10 max-w-lg">
                        <div className="mb-8">
                            <Logo size={80} />
                        </div>
                        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
                            {headline}
                        </h1>
                        <p className="text-neutral-600 dark:text-neutral-400 text-lg leading-relaxed">
                            {subheadline}
                        </p>

                        {stats && stats.length > 0 && (
                            <div className="mt-12 grid grid-cols-3 gap-6">
                                {stats.map((stat, i) => (
                                    <div key={i} className="text-center">
                                        <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                                            {stat.value}
                                        </div>
                                        <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
                    <div className="w-full max-w-md">
                        {/* Mobile Logo */}
                        <div className="lg:hidden mb-8 flex justify-center">
                            <Logo size={64} />
                        </div>

                        <div className="bg-white dark:bg-neutral-925/80 backdrop-blur-xl rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] p-8 shadow-xl shadow-black/5 dark:shadow-black/20">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                                    {title}
                                </h2>
                                {subtitle && (
                                    <p className="text-neutral-600 dark:text-neutral-400 mt-2">{subtitle}</p>
                                )}
                            </div>

                            {flash?.error && (
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                    <svg
                                        className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <span className="text-red-400 text-sm">{flash.error}</span>
                                </div>
                            )}

                            {children}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
