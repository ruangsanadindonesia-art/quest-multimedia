import { Head } from "@inertiajs/react";
import { CheckCircle, AlertCircle, Mail } from "lucide-react";
import Logo from "@components/Logo";

interface Props {
    success?: string;
    error?: string;
}

export default function VerifyEmail({ success, error }: Props) {
    return (
        <>
            <Head title="Email Verification - Laju Go" />

            <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
                <div className="max-w-md w-full">
                    <div className="flex justify-center mb-8">
                        <Logo />
                    </div>

                    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-8 border border-neutral-200 dark:border-neutral-800">
                        <div className="text-center">
                            <div className="flex justify-center mb-4">
                                {success ? (
                                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                                    </div>
                                ) : error ? (
                                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                )}
                            </div>

                            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Email Verification</h1>

                            {success ? (
                                <>
                                    <p className="text-green-600 dark:text-green-400 mb-6">{success}</p>
                                    <a
                                        href="/login"
                                        className="inline-block w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                    >
                                        Continue to Login
                                    </a>
                                </>
                            ) : error ? (
                                <>
                                    <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
                                    <a
                                        href="/register"
                                        className="inline-block w-full bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                    >
                                        Back to Register
                                    </a>
                                </>
                            ) : (
                                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                                    Verifying your email...
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
