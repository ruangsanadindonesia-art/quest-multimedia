import { useState, useMemo } from "react";
import { Link, useForm } from "@inertiajs/react";
import AppLayout from "@layouts/AppLayout";
import { Toast } from "@lib/notifications/toast";
import { getCSRFToken } from "@lib/utils/csrf";
import type { User } from "@lib/types";
import { Upload, Lock, User as UserIcon, Mail } from "lucide-react";

interface Props {
    user?: User;
    success?: string;
    error?: string;
}

export default function Profile({ user, success, error }: Props) {
    // Profile form — initialized from server props
    const profileForm = useForm("EditProfile", {
        name: user?.name ?? "",
        email: user?.email ?? "",
        avatar: user?.avatar ?? "",
    });

    // Password form — always starts empty
    const passwordForm = useForm("EditPassword", {
        current_password: "",
        new_password: "",
        confirm_password: "",
    });

    const [showPassword, setShowPassword] = useState(false);

    const previewUrl = useMemo(() => user?.avatar ?? null, [user?.avatar]);

    function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
        const target = event.target;
        const file = target.files?.[0];
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            fetch("/app/upload", {
                method: "POST",
                headers: {
                    "X-XSRF-TOKEN": getCSRFToken(),
                },
                body: formData,
            })
                .then((response) => response.json())
                .then((data) => {
                    if (data.success && data.url) {
                        // Save avatar URL via Inertia form
                        profileForm.setData("avatar", data.url);
                        profileForm.put("/app/profile", {
                            onError: () => {
                                Toast("Failed to save avatar", "error");
                            },
                        });
                    } else {
                        Toast(data.error || "Failed to upload avatar", "error");
                    }
                })
                .catch(() => {
                    Toast("Failed to upload avatar", "error");
                });
        }
    }

    function handleProfileSubmit(e: React.FormEvent) {
        e.preventDefault();
        profileForm.put("/app/profile");
    }

    function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (passwordForm.data.new_password !== passwordForm.data.confirm_password) {
            Toast("Passwords don't match", "error");
            return;
        }

        if (!passwordForm.data.current_password || !passwordForm.data.new_password || !passwordForm.data.confirm_password) {
            Toast("Please fill all fields", "error");
            return;
        }

        if (passwordForm.data.new_password.length < 8) {
            Toast("Password must be at least 8 characters", "error");
            return;
        }

        passwordForm.put("/app/profile/password", {
            onSuccess: () => passwordForm.reset(),
        });
    }

    return (
        <AppLayout user={user} group="profile">
            {/* Page Header */}
            <div className="pt-8 pb-12 border-b border-neutral-200/80 dark:border-white/[0.04]">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                        <Link href="/app" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Dashboard</Link>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-neutral-700 dark:text-neutral-300">Settings</span>
                    </div>
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                        Account Settings
                    </h1>
                    <p className="text-neutral-600 dark:text-neutral-400">
                        Manage your profile and security preferences
                    </p>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative max-w-5xl mx-auto px-6 py-12">
                {/* Flash Messages */}
                {success && (
                    <div className="mb-6 bg-green-500/10 border border-green-500/20 backdrop-blur-xl text-green-700 dark:text-green-400 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">{success}</p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 backdrop-blur-xl text-red-600 dark:text-red-400 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Profile Overview Card */}
                <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-8 mb-8">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-28 h-28 rounded-2xl bg-brand-600 dark:bg-brand-500 p-1 shadow-lg shadow-brand-600/25">
                                <div className="w-full h-full rounded-xl bg-white dark:bg-neutral-950 overflow-hidden">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-4xl font-bold text-brand-600 dark:text-brand-400">{user?.name?.charAt(0)?.toUpperCase() || ""}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <label className="absolute bottom-0 right-0 w-10 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-xl dark:bg-brand-500 dark:hover:bg-brand-400 flex items-center justify-center cursor-pointer transition-all shadow-lg shadow-brand-400/30 group-hover:scale-110">
                                <Upload className="w-5 h-5" />
                                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                            </label>
                        </div>

                        {/* User Info */}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
                                {user?.name || ""}
                            </h2>
                            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                                {user?.email || ""}
                            </p>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-brand-400/10 text-brand-600 dark:text-brand-400 border border-brand-400/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400"></div>
                                    Active Member
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-white/[0.06]">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    Verified
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Personal Information */}
                    <div className="bg-white dark:bg-neutral-925/50 rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Personal Information</h3>
                                <p className="text-sm text-neutral-600 dark:text-neutral-500">Update your personal details</p>
                            </div>
                        </div>

                        <form onSubmit={handleProfileSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-400 mb-2">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <UserIcon className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <input
                                        value={profileForm.data.name}
                                        onChange={(e) => profileForm.setData("name", e.target.value)}
                                        type="text"
                                        id="name"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/80 focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 text-neutral-900 dark:text-white placeholder-neutral-500 transition-all outline-none"
                                        placeholder="Your full name"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-400 mb-2">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <input
                                        value={profileForm.data.email}
                                        onChange={(e) => profileForm.setData("email", e.target.value)}
                                        type="email"
                                        id="email"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/80 focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 text-neutral-900 dark:text-white placeholder-neutral-500 transition-all outline-none"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={profileForm.processing}
                                    className="w-full px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all dark:bg-brand-500 dark:hover:bg-brand-400 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {profileForm.processing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white dark:bg-neutral-925/50 rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                <Lock className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Security</h3>
                                <p className="text-sm text-neutral-600 dark:text-neutral-500">Update your password</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="current_password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-400 mb-2">Current Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <input
                                        value={passwordForm.data.current_password}
                                        onChange={(e) => passwordForm.setData("current_password", e.target.value)}
                                        type={showPassword ? "text" : "password"}
                                        id="current_password"
                                        className="w-full pl-12 pr-12 py-3 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/80 focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 text-neutral-900 dark:text-white placeholder-neutral-500 transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="new_password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-400 mb-2">New Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <input
                                        value={passwordForm.data.new_password}
                                        onChange={(e) => passwordForm.setData("new_password", e.target.value)}
                                        type={showPassword ? "text" : "password"}
                                        id="new_password"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/80 focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 text-neutral-900 dark:text-white placeholder-neutral-500 transition-all outline-none"
                                        placeholder="••••••••"
                                        minLength={8}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="confirm_password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-400 mb-2">Confirm New Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-5 h-5 text-neutral-500" />
                                    </div>
                                    <input
                                        value={passwordForm.data.confirm_password}
                                        onChange={(e) => passwordForm.setData("confirm_password", e.target.value)}
                                        type={showPassword ? "text" : "password"}
                                        id="confirm_password"
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-300 dark:border-neutral-700/80 focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 text-neutral-900 dark:text-white placeholder-neutral-500 transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="show_password"
                                    checked={showPassword}
                                    onChange={(e) => setShowPassword(e.target.checked)}
                                    className="w-4 h-4 rounded border-neutral-300 text-brand-400 focus:ring-brand-400"
                                />
                                <label htmlFor="show_password" className="text-sm text-neutral-600 dark:text-neutral-400">
                                    Show passwords
                                </label>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={passwordForm.processing}
                                    className="w-full px-6 py-3 rounded-xl bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-semibold transition-all shadow-lg shadow-red-500/25 hover:shadow-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {passwordForm.processing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Changing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                            Change Password
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
