import { useState, useRef } from "react";
import { Link } from "@inertiajs/react";
import AppLayout from "@layouts/AppLayout";
import { Toast } from "@lib/notifications/toast";
import type { User } from "@lib/types";
import * as tus from "tus-js-client";
import {
    Upload,
    FileIcon,
    Trash2,
    Download,
    CheckCircle2,
    XCircle,
    LoaderCircle,
    AlertCircle,
    ExternalLink,
    Copy,
    Clock,
} from "lucide-react";

interface Props {
    user?: User;
}

interface UploadEntry {
    id: string;
    name: string;
    size: number;
    progress: number;
    status: "pending" | "uploading" | "paused" | "done" | "error";
    error?: string;
    url?: string;
    tusRef?: tus.Upload;
    startedAt: Date;
}

const TUS_ENDPOINT = "/tus/files";

const tusEndpoints = [
    { method: "POST", path: "/tus/files", desc: "Create upload" },
    { method: "HEAD", path: "/tus/files/:id", desc: "Get upload offset/info" },
    { method: "PATCH", path: "/tus/files/:id", desc: "Upload chunk" },
    { method: "GET", path: "/tus/files/:id", desc: "Download file" },
    { method: "DELETE", path: "/tus/files/:id", desc: "Terminate upload" },
    { method: "OPTIONS", path: "/tus/files", desc: "Protocol discovery" },
];

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function statusColor(status: string): string {
    switch (status) {
        case "done": return "text-green-500";
        case "error": return "text-red-500";
        case "uploading": return "text-brand-500";
        case "paused": return "text-amber-500";
        default: return "text-neutral-500";
    }
}

function statusIcon(status: string) {
    switch (status) {
        case "done": return CheckCircle2;
        case "error": return XCircle;
        case "uploading": return LoaderCircle;
        case "paused": return Clock;
        default: return AlertCircle;
    }
}

function statusLabel(status: string): string {
    switch (status) {
        case "done": return "Completed";
        case "error": return "Failed";
        case "uploading": return "Uploading...";
        case "paused": return "Paused";
        case "pending": return "Pending";
        default: return status;
    }
}

export default function UploadTest({ user }: Props) {
    const [uploads, setUploads] = useState<UploadEntry[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalUploaded = uploads.filter((u) => u.status === "done").length;
    const totalBytes = uploads
        .filter((u) => u.status === "done")
        .reduce((sum, u) => sum + u.size, 0);
    const activeUploads = uploads.filter((u) => u.status === "uploading").length;

    // ── Helper: update entry immutably ───────────────────────
    function setEntry(id: string, patch: Partial<UploadEntry>) {
        setUploads((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    }

    // ── Drag & Drop ───────────────────────────────────────────
    function handleDragOver(e: React.DragEvent) {
        e.preventDefault();
        setIsDragOver(true);
    }

    function handleDragLeave() {
        setIsDragOver(false);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const target = e.target;
        const files = Array.from(target.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
        target.value = "";
    }

    function addFiles(filesList: File[]) {
        for (const file of filesList) {
            const entry: UploadEntry = {
                id: crypto.randomUUID(),
                name: file.name,
                size: file.size,
                progress: 0,
                status: "pending",
                startedAt: new Date(),
            };
            setUploads((prev) => [...prev, entry]);
            startUpload(entry.id, file);
        }
    }

    // ── TUS Upload ────────────────────────────────────────────
    function startUpload(entryId: string, file: File) {
        // Set initial status
        setEntry(entryId, { status: "uploading" });

        const upload = new tus.Upload(file, {
            endpoint: TUS_ENDPOINT,
            retryDelays: [0, 1000, 3000, 5000],
            chunkSize: 5 * 1024 * 1024, // 5MB chunks for responsive progress
            metadata: {
                filename: file.name,
                filetype: file.type,
            },
            onError: (err) => {
                setEntry(entryId, {
                    status: "error",
                    error: err.message,
                });
                Toast(`Upload failed: ${err.message}`, "error");
            },
            onProgress: (bytesSent, bytesTotal) => {
                const progress = bytesTotal > 0 ? (bytesSent / bytesTotal) * 100 : 0;
                setEntry(entryId, { progress });
            },
            onSuccess: () => {
                setEntry(entryId, {
                    status: "done",
                    progress: 100,
                    url: upload.url ?? undefined,
                });
                Toast(`Upload selesai: ${file.name}`, "success");
            },
            onShouldRetry: (_err, retryAttempt, _options) => {
                Toast(`Retry ${retryAttempt + 1} for ${file.name}...`, "info");
                return true;
            },
        });

        // Store tusRef
        setUploads((prev) => prev.map((e) => (e.id === entryId ? { ...e, tusRef: upload } : e)));

        upload.start();
    }

    function pauseUpload(id: string) {
        setUploads((prev) => prev.map((e) => {
            if (e.id === id) {
                e.tusRef?.abort();
                return { ...e, status: "paused" };
            }
            return e;
        }));
    }

    function removeUpload(index: number) {
        setUploads((prev) => {
            const entry = prev[index];
            if (entry?.status === "uploading") {
                entry.tusRef?.abort();
            }
            return prev.filter((_, i) => i !== index);
        });
    }

    function clearCompleted() {
        setUploads((prev) => prev.filter((u) => u.status !== "done"));
    }

    // ── File actions ──────────────────────────────────────────
    function getUploadUrl(uploadUrl: string | undefined): string {
        if (!uploadUrl) return "";
        try {
            const url = new URL(uploadUrl);
            return url.pathname;
        } catch {
            return uploadUrl;
        }
    }

    function copyDownloadLink(index: number) {
        const url = getUploadUrl(uploads[index]?.url);
        if (!url) return;
        navigator.clipboard.writeText(window.location.origin + url);
        Toast("Link copied!", "success");
    }

    function deleteUpload(index: number) {
        const entry = uploads[index];
        if (!entry?.url) return;
        const url = getUploadUrl(entry.url);

        fetch(url, {
            method: "DELETE",
            headers: {
                "Tus-Resumable": "1.0.0",
            },
        })
            .then((res) => {
                if (res.ok || res.status === 204 || res.status === 404) {
                    setUploads((prev) => prev.filter((_, i) => i !== index));
                    Toast(`Deleted: ${entry.name}`, "success");
                } else {
                    Toast("Failed to delete", "error");
                }
            })
            .catch(() => {
                Toast("Failed to delete", "error");
            });
    }

    return (
        <AppLayout user={user} group="upload">
            {/* Page Header */}
            <div className="pt-8 pb-10 border-b border-neutral-200/80 dark:border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                        <Link href="/app" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Dashboard</Link>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-neutral-700 dark:text-neutral-300">Upload Test</span>
                    </div>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">File Upload Test</h1>
                            <p className="text-neutral-600 dark:text-neutral-400 max-w-xl">
                                Test the TUS resumable upload protocol. Big files, chunked uploads, progress tracking —
                                all powered by <a href="https://github.com/maulanashalihin/tusdfiber" target="_blank" rel="noopener" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline underline-offset-2">tusdfiber</a>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Stats bar */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-5">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Uploaded Files</p>
                        <p className="text-3xl font-bold text-neutral-900 dark:text-white font-mono">{totalUploaded}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-5">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Total Size</p>
                        <p className="text-3xl font-bold text-neutral-900 dark:text-white font-mono">{formatBytes(totalBytes)}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-5">
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Active Uploads</p>
                        <p className="text-3xl font-bold text-neutral-900 dark:text-white font-mono">{activeUploads}</p>
                    </div>
                </div>

                {/* Upload Drop Zone */}
                <div className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${isDragOver ? "border-brand-400 bg-brand-400/5 scale-[1.01] shadow-xl shadow-brand-400/10" : "border-neutral-300 dark:border-neutral-700 hover:border-brand-400/50 bg-white dark:bg-neutral-925/50"}`}
                    role="button" tabIndex={0} aria-label="Upload file drop zone"
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-16 px-8 flex flex-col items-center justify-center gap-4 cursor-pointer group">
                        <div className="w-16 h-16 rounded-2xl bg-brand-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">{isDragOver ? "Drop files here" : "Drop files or click to upload"}</p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Any file type — up to 1GB per upload via TUS resumable protocol</p>
                        </div>
                    </button>
                </div>

                {/* Upload Queue */}
                {uploads.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200/80 dark:border-white/[0.04]">
                            <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Upload Queue <span className="text-sm font-normal text-neutral-500 ml-2">({uploads.length} files)</span></h3>
                            {uploads.some((u) => u.status === "done") && (
                                <button onClick={clearCompleted} className="text-xs font-medium text-neutral-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10">Clear completed</button>
                            )}
                        </div>
                        <ul className="divide-y divide-neutral-200/80 dark:divide-white/[0.04]">
                            {uploads.map((entry, i) => {
                                const StatusIcon = statusIcon(entry.status);
                                return (
                                    <li key={entry.id} className="px-6 py-4 transition-colors hover:bg-neutral-50/50 dark:hover:bg-white/[0.015]">
                                        <div className="flex items-start gap-4">
                                            <div className="shrink-0 w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                                                <FileIcon className="w-5 h-5 text-neutral-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{entry.name}</p>
                                                    <span className="text-xs text-neutral-500 shrink-0">({formatBytes(entry.size)})</span>
                                                </div>
                                                <div className="relative h-2 rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden mb-1.5">
                                                    <div className={`h-full rounded-full transition-all duration-500 ease-out ${entry.status === "error" ? "bg-red-500" : entry.status === "done" ? "bg-green-500" : "bg-brand-500"}`} style={{ width: `${entry.progress}%` }}></div>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <StatusIcon className={`w-3.5 h-3.5 ${statusColor(entry.status)}`} />
                                                    <span className={`${statusColor(entry.status)} font-medium`}>{statusLabel(entry.status)}</span>
                                                    {entry.status === "uploading" && <span className="text-neutral-400">· {Math.round(entry.progress)}%</span>}
                                                    {entry.error && <span className="text-red-400">· {entry.error}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {entry.status === "done" && entry.url ? (
                                                    <>
                                                        <a href={getUploadUrl(entry.url)} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors" title="Download"><Download className="w-4 h-4" /></a>
                                                        <button onClick={() => copyDownloadLink(i)} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors" title="Copy link"><Copy className="w-4 h-4" /></button>
                                                        <button onClick={() => deleteUpload(i)} className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-500 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                ) : entry.status === "uploading" ? (
                                                    <>
                                                        <button onClick={() => pauseUpload(entry.id)} className="p-2 rounded-lg hover:bg-amber-500/10 text-neutral-500 hover:text-amber-500 transition-colors" title="Pause"><Clock className="w-4 h-4" /></button>
                                                        <button onClick={() => removeUpload(i)} className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-500 hover:text-red-500 transition-colors" title="Cancel"><XCircle className="w-4 h-4" /></button>
                                                    </>
                                                ) : entry.status === "error" ? (
                                                    <button onClick={() => removeUpload(i)} className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-500 hover:text-red-500 transition-colors" title="Remove"><Trash2 className="w-4 h-4" /></button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* Empty state */}
                {uploads.length === 0 && (
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4"><Upload className="w-8 h-8 text-neutral-500" /></div>
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">No uploads yet</h3>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto text-sm">Drag & drop files above or click the drop zone to select files. Uploads use the TUS resumable protocol — you can pause and resume big uploads.</p>
                    </div>
                )}

                {/* Protocol Info Card */}
                <div className="rounded-2xl border border-neutral-200/80 dark:border-white/[0.06] bg-white dark:bg-neutral-925/50 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center"><ExternalLink className="w-5 h-5 text-brand-600 dark:text-brand-400" /></div>
                        <div><h3 className="text-base font-semibold text-neutral-900 dark:text-white">TUS Protocol Endpoints</h3><p className="text-sm text-neutral-500 dark:text-neutral-400">All routes are protected (auth required)</p></div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        {tusEndpoints.map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-white/[0.04]">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${item.method === "GET" ? "bg-green-500/10 text-green-600 dark:text-green-400" : item.method === "POST" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : item.method === "PATCH" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : item.method === "DELETE" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-neutral-200/80 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"}`}>{item.method}</span>
                                <code className="text-xs text-neutral-700 dark:text-neutral-300 font-mono shrink min-w-0 truncate">{item.path}</code>
                                <span className="text-neutral-500 dark:text-neutral-400 ml-auto shrink-0">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
