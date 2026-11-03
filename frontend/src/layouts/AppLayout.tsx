import { useState, useEffect, useRef } from "react";
import { Link, router } from "@inertiajs/react";
import {
    LayoutDashboard,
    Settings,
    LogOut,
    Menu,
    X,
    User,
    Upload,
} from "lucide-react";
import DarkModeToggle from "@components/DarkModeToggle";
import Logo from "@components/Logo";
import type { User as UserType } from "@lib/types";

interface Props {
    user?: UserType;
    /** Active nav group: "dashboard" | "profile" | "" */
    group?: string;
    children: React.ReactNode;
}

const menuLinks = [
    {
        href: "/app",
        label: "Dashboard",
        group: "dashboard",
        show: true,
        icon: LayoutDashboard,
    },
    {
        href: "/app/upload",
        label: "Upload Test",
        group: "upload",
        show: true,
        icon: Upload,
    },
    {
        href: "/app/profile",
        label: "Settings",
        group: "profile",
        show: true,
        icon: Settings,
    },
];

export default function AppLayout({ user, group = "", children }: Props) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDesktopUserMenuOpen, setIsDesktopUserMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const desktopMenuRef = useRef<HTMLDivElement>(null);

    function handleLogout() {
        router.post("/logout");
    }

    // Close desktop dropdown on click outside
    useEffect(() => {
        if (!isDesktopUserMenuOpen || typeof document === "undefined") return;

        function onDocumentClick(e: MouseEvent) {
            if (desktopMenuRef.current && !desktopMenuRef.current.contains(e.target as Node)) {
                setIsDesktopUserMenuOpen(false);
            }
        }

        // Use setTimeout to avoid the same click that opened it from closing it
        const timer = setTimeout(() => {
            document.addEventListener("click", onDocumentClick);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("click", onDocumentClick);
        };
    }, [isDesktopUserMenuOpen]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
        }
    }, [isMenuOpen]);

    return (
        <>
            {/* Desktop Header */}
            <header className="hidden lg:flex fixed top-0 left-72 right-0 h-16 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-200/80 dark:border-white/[0.04] items-center justify-end px-6 gap-3">
                <DarkModeToggle />

                {user && user.id ? (
                    <div ref={desktopMenuRef} className="relative" role="menu">
                        <button
                            onClick={() => setIsDesktopUserMenuOpen(!isDesktopUserMenuOpen)}
                            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover ring-2 ring-neutral-300 dark:ring-neutral-700 shrink-0" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-neutral-300 dark:ring-neutral-700 shrink-0">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="text-sm font-semibold text-neutral-900 dark:text-white">{user.name}</span>
                        </button>

                        {isDesktopUserMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-925 rounded-xl shadow-xl border border-neutral-200/80 dark:border-white/[0.06] overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
                                <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-white/[0.04]">
                                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Signed in as</p>
                                    <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-0.5">{user.name}</p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
                                </div>
                                <div className="p-2">
                                    <Link
                                        href="/app/profile"
                                        onClick={() => setIsDesktopUserMenuOpen(false)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                    >
                                        <User size={16} />
                                        Profile
                                    </Link>
                                </div>
                                <div className="p-2 border-t border-neutral-200/80 dark:border-white/[0.04]">
                                    <button
                                        onClick={() => { setIsDesktopUserMenuOpen(false); handleLogout(); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </header>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-72 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-r border-neutral-200/80 dark:border-white/[0.04] z-30 transition-all duration-300">
                {/* Logo */}
                <Link
                    href="/app"
                    className="flex items-center gap-3 px-6 py-6 hover:opacity-80 transition-opacity no-underline"
                >
                    <Logo size={36} />
                    <div>
                        <h1 className="text-xl font-black italic text-neutral-900 dark:text-white">
                            Laju<span className="text-brand-400">Go</span>
                        </h1>
                        {group === "dashboard" ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Dashboard</p>
                        ) : group === "profile" ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Settings</p>
                        ) : (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">App</p>
                        )}
                    </div>
                </Link>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {menuLinks.filter((item) => item.show).map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${item.group === group
                                    ? "bg-brand-400/10 text-brand-600 dark:text-brand-400 border border-brand-400/20"
                                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/50 border border-transparent"}`}
                            >
                                <Icon
                                    size={20}
                                    className={item.group === group
                                        ? "text-brand-400"
                                        : "text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white"}
                                    strokeWidth={2}
                                />
                                {item.label}
                                {item.group === group && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400"></div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {user && user.id ? (
                    <div className="p-3 border-t border-neutral-200/80 dark:border-white/[0.04] space-y-2">
                        <div className="flex items-center gap-2.5">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover ring-2 ring-neutral-300 dark:ring-neutral-700 shrink-0" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-neutral-300 dark:ring-neutral-700 shrink-0">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate leading-normal">
                                    {user.name}
                                </p>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-normal">
                                    {user.email || "Member"}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <LogOut size={14} />
                            Logout
                        </button>
                    </div>
                ) : null}
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-neutral-950 backdrop-blur-xl border-b border-neutral-200/80 dark:border-white/[0.04]">
                <div className="flex items-center justify-between px-4 h-16">
                    <Link href="/app" className="flex items-center gap-2">
                        <Logo size={28} />
                        <span className="text-lg font-black italic text-neutral-900 dark:text-white">
                            Laju<span className="text-brand-400">Go</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-2">
                        {user && user.id ? (
                            <div className="relative" role="menu">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="w-9 h-9 rounded-full ring-2 ring-neutral-300 dark:ring-neutral-700 overflow-hidden"
                                >
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </button>

                                {isUserMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            role="presentation"
                                            onClick={() => setIsUserMenuOpen(false)}
                                        ></div>
                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-925 rounded-xl shadow-xl border border-neutral-200/80 dark:border-white/[0.06] overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
                                            <div className="p-3 border-b border-neutral-200/80 dark:border-white/[0.04]">
                                                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                                                    Signed in as
                                                </p>
                                                <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                                                    {user.name}
                                                </p>
                                            </div>
                                            <div className="p-2">
                                                <Link
                                                    href="/app/profile"
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                                >
                                                    <User size={16} />
                                                    Profile
                                                </Link>
                                            </div>
                                            <div className="p-2 border-t border-neutral-200/80 dark:border-white/[0.04]">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <LogOut size={16} />
                                                    Logout
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="px-4 py-2 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium transition-colors"
                            >
                                Sign In
                            </Link>
                        )}

                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                            aria-label="Menu"
                        >
                            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Drawer */}
            {isMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <button
                        className="absolute inset-0 w-full h-full bg-neutral-900/50 backdrop-blur-sm"
                        onClick={() => setIsMenuOpen(false)}
                        aria-label="Close menu"
                    ></button>

                    <div className="absolute right-0 top-0 h-full w-[85%] max-w-[320px] bg-white dark:bg-neutral-925 shadow-2xl border-l border-neutral-200/80 dark:border-white/[0.04] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-neutral-200/80 dark:border-white/[0.04] bg-neutral-50 dark:bg-neutral-925/50">
                            <span className="text-base font-bold text-neutral-900 dark:text-white">Menu</span>
                            <button
                                onClick={() => setIsMenuOpen(false)}
                                className="p-2 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white dark:bg-neutral-925">
                            {menuLinks.filter((item) => item.show).map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${item.group === group
                                            ? "bg-brand-400/10 text-brand-600 dark:text-brand-400 border border-brand-400/20"
                                            : "text-neutral-700 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/50 border border-transparent"}`}
                                    >
                                        <Icon size={20} strokeWidth={2} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        {user ? (
                            <div className="p-4 border-t border-neutral-200/80 dark:border-white/[0.04] bg-neutral-50 dark:bg-neutral-925/50">
                                <div className="bg-neutral-100/50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200/80 dark:border-white/[0.06] mb-3">
                                    <div className="flex items-center gap-3">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                                                {user.name}
                                            </p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                                {user.email || "Member"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DarkModeToggle />
                                    <button
                                        onClick={handleLogout}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 font-medium transition-colors"
                                    >
                                        <LogOut size={18} />
                                        Logout
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 border-t border-neutral-200/80 dark:border-white/[0.04] bg-neutral-50 dark:bg-neutral-925/50 space-y-2">
                                <Link
                                    href="/login"
                                    className="block w-full px-4 py-3 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium transition-colors text-center"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/register"
                                    className="block w-full px-4 py-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all text-center dark:bg-brand-500 dark:hover:bg-brand-400 shadow-lg shadow-brand-600/25"
                                >
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Desktop spacer for header */}
            <div className="hidden lg:block h-16"></div>

            {/* Mobile spacer */}
            <div className="lg:hidden h-16"></div>

            {/* Page Content */}
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
                {children}
            </div>
        </>
    );
}
