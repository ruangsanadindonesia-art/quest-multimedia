import { Link } from "@inertiajs/react";
import AppLayout from "@layouts/AppLayout";
import type { User } from "@lib/types";
import {
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    CircleCheck,
    CircleAlert,
    Activity,
    Database,
    HardDrive,
    Zap,
    KeyRound,
    UserCheck,
    Rocket,
    ArrowRight,
} from "lucide-react";

interface Props {
    user?: User;
    success?: string;
    error?: string;
}

// Sparkline data — last 7 days of activity
const performanceData = [184320, 198500, 215000, 198000, 234100, 252000, 258611];
const latencyData = [1.82, 1.74, 1.61, 1.58, 1.49, 1.54, 1.52];
const uptimeData = [99.97, 99.99, 100.0, 99.98, 99.99, 100.0, 99.99];

// Recent activity events
const recentActivity = [
    { type: "deploy", icon: Rocket, message: "Deploy succeeded", detail: "main · 4m ago", tone: "success" },
    { type: "auth", icon: UserCheck, message: "New login from Safari", detail: "Jakarta · 12m ago", tone: "neutral" },
    { type: "apikey", icon: KeyRound, message: "API key rotated", detail: "Production · 2h ago", tone: "warning" },
    { type: "db", icon: Database, message: "Backup completed", detail: "2.4 GB snapshot · 6h ago", tone: "success" },
];

// System health checks
const systemHealth = [
    { label: "API", status: "operational", icon: Zap },
    { label: "Database", status: "operational", icon: Database },
    { label: "Cache", status: "operational", icon: Activity },
    { label: "Storage", status: "84% used", icon: HardDrive, tone: "warning" },
];

// Onboarding steps
const onboardingSteps = [
    { label: "Create account", done: true },
    { label: "Verify email", done: true },
    { label: "Set up profile", done: true },
    { label: "Generate API key", done: false },
    { label: "Deploy your app", done: false },
];
const completedSteps = onboardingSteps.filter((s) => s.done).length;
const totalSteps = onboardingSteps.length;
const progressPercent = (completedSteps / totalSteps) * 100;

/**
 * Build an SVG polyline path for a sparkline.
 * Normalises data to fit a 100x32 viewBox.
 */
function buildPath(data: number[]): string {
    if (data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = 100 / (data.length - 1);
    return data
        .map((v, i) => {
            const x = i * step;
            const y = 32 - ((v - min) / range) * 30 - 1;
            return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
}

/**
 * Build the filled area under the line for a sparkline.
 */
function buildArea(data: number[]): string {
    if (data.length < 2) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = 100 / (data.length - 1);
    const line = data
        .map((v, i) => {
            const x = i * step;
            const y = 32 - ((v - min) / range) * 30 - 1;
            return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
    return `${line} L100,32 L0,32 Z`;
}

function eventToneBg(tone: string): string {
    switch (tone) {
        case "success":
            return "bg-green-500/10";
        case "warning":
            return "bg-amber-500/10";
        case "error":
            return "bg-red-500/10";
        default:
            return "bg-brand-400/10";
    }
}
function eventToneText(tone: string): string {
    switch (tone) {
        case "success":
            return "text-green-600 dark:text-green-400";
        case "warning":
            return "text-amber-600 dark:text-amber-400";
        case "error":
            return "text-red-600 dark:text-red-400";
        default:
            return "text-brand-600 dark:text-brand-400";
    }
}
function statusTone(status: string, tone?: string): string {
    if (tone === "warning") return "text-amber-600 dark:text-amber-400";
    if (status === "operational") return "text-green-700 dark:text-green-400";
    return "text-neutral-600 dark:text-neutral-400";
}

export default function Dashboard({ user }: Props) {
    return (
        <AppLayout user={user} group="dashboard">
            {/* Page Header */}
            <div className="pt-8 pb-10 border-b border-neutral-200/80 dark:border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                            Welcome back, {user?.name?.split(" ")[0] || "there"}
                        </h1>
                        <p className="text-neutral-600 dark:text-neutral-400">
                            Your application is running smoothly. Here is what is happening today.
                        </p>
                    </div>
                    <a
                        href="https://github.com/maulanashalihin/laju-go/tree/main/docs"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-white/[0.06] text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:border-brand-400/40 hover:text-neutral-900 dark:hover:text-white transition-all"
                    >
                        Documentation
                        <ArrowUpRight className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Onboarding + Welcome Card (gradient hero) */}
                <div
                    className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] p-6 md:p-8 transition-all hover:border-brand-400/30 group"
                    style={{ backgroundImage: "linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(168, 85, 247, 0.06) 100%)" }}
                >
                    <div
                        className="absolute -top-24 -right-24 w-72 h-72 bg-brand-400/15 rounded-full blur-3xl pointer-events-none"
                        aria-hidden="true"
                    ></div>

                    <div className="relative grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-400/15 border border-brand-400/25 text-xs font-semibold text-brand-700 dark:text-brand-300 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                                Onboarding {completedSteps} of {totalSteps}
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-3 tracking-tight">
                                Finish setting up your workspace
                            </h2>
                            <p className="text-neutral-600 dark:text-neutral-400 mb-5 max-w-md">
                                Complete the remaining steps to unlock deployment and production monitoring.
                            </p>

                            {/* Progress bar */}
                            <div className="mb-6 max-w-md">
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="font-medium text-neutral-500 dark:text-neutral-400">Progress</span>
                                    <span className="font-mono text-neutral-700 dark:text-neutral-300">{Math.round(progressPercent)}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-secondary-500 transition-all duration-700"
                                        style={{ width: `${progressPercent}%` }}
                                    ></div>
                                </div>
                            </div>

                            <Link
                                href="/app/profile"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all dark:bg-brand-500 dark:hover:bg-brand-400 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 active:scale-[0.98]"
                            >
                                Continue setup
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {/* Steps list */}
                        <ol className="space-y-2">
                            {onboardingSteps.map((step, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white/40 dark:bg-neutral-925/40 backdrop-blur-sm"
                                >
                                    {step.done ? (
                                        <div className="shrink-0 w-6 h-6 rounded-full bg-brand-400/20 flex items-center justify-center">
                                            <CircleCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                                        </div>
                                    ) : (
                                        <div className="shrink-0 w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-[10px] font-mono text-neutral-500">
                                            {i + 1}
                                        </div>
                                    )}
                                    <span className={`text-sm ${step.done ? "text-neutral-500 dark:text-neutral-500 line-through" : "text-neutral-700 dark:text-neutral-300 font-medium"}`}>
                                        {step.label}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>

                {/* Stats Grid with Sparklines */}
                <div className="grid md:grid-cols-3 gap-5">
                    {/* Primary stat (Performance) - 2 cols on desktop */}
                    <div className="md:col-span-2 relative overflow-hidden rounded-2xl border border-brand-400/25 bg-white dark:bg-neutral-925/50 p-6 transition-all hover:border-brand-400/45 hover:shadow-xl hover:shadow-brand-400/5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-8 h-8 rounded-lg bg-brand-400/15 flex items-center justify-center">
                                        <Zap className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Throughput</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-4xl font-bold text-neutral-900 dark:text-white tracking-tight font-mono">258,611</div>
                                    <div className="text-sm font-medium text-green-700 dark:text-green-400 inline-flex items-center gap-0.5">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        11.4%
                                    </div>
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">requests per second, 7-day peak</div>
                            </div>
                        </div>

                        {/* Sparkline */}
                        <div className="relative h-16 -mx-2">
                            <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-full">
                                <defs>
                                    <linearGradient id="perfFill" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                <path d={buildArea(performanceData)} fill="url(#perfFill)" />
                                <path d={buildPath(performanceData)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] font-mono text-neutral-400 px-1">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                                    <span key={day}>{day}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right column: Latency + Uptime stacked */}
                    <div className="flex flex-col gap-5">
                        {/* Latency stat */}
                        <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-6 transition-all hover:border-brand-400/30">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-secondary-500/15 flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-secondary-300" />
                                </div>
                                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Latency</span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <div className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight font-mono">1.52<span className="text-lg text-neutral-500 ml-0.5">ms</span></div>
                                <div className="text-xs font-medium text-green-700 dark:text-green-400 inline-flex items-center gap-0.5">
                                    <TrendingDown className="w-3 h-3" />
                                    3.6%
                                </div>
                            </div>
                            <div className="text-xs text-neutral-500 mb-4">median, 7-day average</div>

                            {/* Mini sparkline */}
                            <div className="h-10 -mx-1">
                                <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-full">
                                    <path d={buildPath(latencyData)} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>

                        {/* Uptime stat */}
                        <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-6 transition-all hover:border-brand-400/30">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                                    <CircleCheck className="w-4 h-4 text-green-500" />
                                </div>
                                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Uptime</span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-1">
                                <div className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight font-mono">99.99<span className="text-lg text-neutral-500">%</span></div>
                            </div>
                            <div className="text-xs text-neutral-500 mb-4">last 30 days · 0 incidents</div>

                            {/* Mini sparkline (flat) */}
                            <div className="h-10 -mx-1">
                                <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-full">
                                    <path d={buildPath(uptimeData)} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sample data note */}
                <p className="text-xs text-neutral-500 -mt-2 px-1">
                    <span className="font-medium text-neutral-600 dark:text-neutral-400">Sample benchmark data.</span>
                    Replace with your own metrics in production.
                </p>

                {/* Two-column bottom: Activity + System Health */}
                <div className="grid lg:grid-cols-3 gap-5 pt-2">
                    {/* Activity Feed (2 cols) */}
                    <div className="lg:col-span-2 rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 overflow-hidden transition-all hover:border-brand-400/30">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200/80 dark:border-white/[0.04]">
                            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Recent activity</h3>
                            <Link href="/app/profile" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors inline-flex items-center gap-1">
                                View all
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>

                        <ul className="divide-y divide-neutral-200/80 dark:divide-white/[0.04]">
                            {recentActivity.map((event, i) => {
                                const Icon = event.icon;
                                return (
                                    <li
                                        key={i}
                                        className="flex items-center gap-4 px-6 py-3.5 hover:bg-neutral-50/50 dark:hover:bg-white/[0.015] transition-colors"
                                    >
                                        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${eventToneBg(event.tone)}`}>
                                            <Icon className={`w-4 h-4 ${eventToneText(event.tone)}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{event.message}</p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{event.detail}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* System Health (1 col) */}
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 overflow-hidden transition-all hover:border-brand-400/30">
                        <div className="px-6 py-4 border-b border-neutral-200/80 dark:border-white/[0.04]">
                            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">System health</h3>
                        </div>
                        <ul className="divide-y divide-neutral-200/80 dark:divide-white/[0.04]">
                            {systemHealth.map((service, i) => {
                                const Icon = service.icon;
                                return (
                                    <li
                                        key={i}
                                        className="flex items-center gap-3 px-6 py-3.5"
                                    >
                                        <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/50 flex items-center justify-center">
                                            <Icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">{service.label}</span>
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusTone(service.status, (service as { tone?: string }).tone)}`}>
                                            {service.status === "operational" ? (
                                                <span className="relative flex w-2 h-2">
                                                    <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping"></span>
                                                    <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500"></span>
                                                </span>
                                            ) : (
                                                <CircleAlert className="w-3 h-3" />
                                            )}
                                            {service.status}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
