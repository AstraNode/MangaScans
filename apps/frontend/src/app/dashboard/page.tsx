'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
    Sparkles, Plus, Upload, Folder, Clock, CheckCircle, AlertCircle,
    Loader2, Download, Trash2, Eye, X, ArrowRight, LogOut, Settings,
    Languages, Image as ImageIcon
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────

interface Project {
    _id: string;
    title: string;
    status: string;
    pageCount: number;
    processedCount: number;
    sourceLanguage: string;
    targetLanguage: string;
    translationStyle: string;
    coverUrl?: string;
    createdAt: string;
}

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { color: string; icon: React.ElementType }> = {
        created: { color: 'text-gray-400 bg-gray-500/10', icon: Clock },
        processing: { color: 'text-brand-400 bg-brand-500/10', icon: Loader2 },
        completed: { color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle },
        failed: { color: 'text-red-400 bg-red-500/10', icon: AlertCircle },
    };
    const { color, icon: Icon } = config[status] || config.created;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
            <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

// ── Create Project Modal ─────────────────────────────────────

function CreateProjectModal({
    isOpen,
    onClose,
    onCreated,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (project: Project) => void;
}) {
    const [title, setTitle] = useState('');
    const [sourceLanguage, setSourceLanguage] = useState('ja');
    const [targetLanguage, setTargetLanguage] = useState('en');
    const [style, setStyle] = useState('neutral');
    const [loading, setLoading] = useState(false);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.createProject({
                title,
                sourceLanguage,
                targetLanguage,
                translationStyle: style,
            });
            onCreated(res.data);
            onClose();
            setTitle('');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass w-full max-w-lg p-6 m-4"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">New Project</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="My Manga Chapter 1"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-brand-500/50 focus:outline-none transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Source Language</label>
                            <select
                                value={sourceLanguage}
                                onChange={(e) => setSourceLanguage(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                            >
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="zh">Chinese</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Target Language</label>
                            <select
                                value={targetLanguage}
                                onChange={(e) => setTargetLanguage(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="pt">Portuguese</option>
                                <option value="ru">Russian</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">Translation Style</label>
                        <div className="grid grid-cols-4 gap-2">
                            {['neutral', 'formal', 'casual', 'dramatic'].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStyle(s)}
                                    className={`text-xs py-2 rounded-lg border transition-colors ${style === s
                                            ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !title}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Create Project
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

// ── Upload Dropzone ──────────────────────────────────────────

function UploadDropzone({
    projectId,
    onUploaded,
}: {
    projectId: string;
    onUploaded: () => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!acceptedFiles.length) return;
        setUploading(true);
        setUploadProgress(`Uploading ${acceptedFiles.length} files...`);

        try {
            await api.uploadPages(projectId, acceptedFiles);
            setUploadProgress(`✅ ${acceptedFiles.length} pages uploaded and queued!`);
            onUploaded();
        } catch (err: any) {
            setUploadProgress(`❌ Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
        }
    }, [projectId, onUploaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
        disabled: uploading,
    });

    return (
        <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragActive
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                }`}
        >
            <input {...getInputProps()} />
            <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragActive ? 'text-brand-400' : 'text-gray-500'}`} />
            {isDragActive ? (
                <p className="text-brand-300">Drop pages here...</p>
            ) : (
                <>
                    <p className="text-gray-300 font-medium">Drag & drop manga pages</p>
                    <p className="text-sm text-gray-500 mt-1">or click to browse (PNG, JPG, WebP)</p>
                </>
            )}
            {uploadProgress && (
                <p className="text-sm mt-4 text-brand-300">{uploadProgress}</p>
            )}
            {uploading && (
                <div className="mt-3 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full progress-bar rounded-full" style={{ width: '60%' }} />
                </div>
            )}
        </div>
    );
}

// ── Dashboard Page ───────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated, logout, loadUser } = useAuthStore();
    const [projects, setProjects] = useState<Project[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [loadingProjects, setLoadingProjects] = useState(true);

    useEffect(() => {
        loadUser();
    }, []);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isLoading, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) fetchProjects();
    }, [isAuthenticated]);

    async function fetchProjects() {
        try {
            const res = await api.getProjects();
            setProjects(res.data || []);
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setLoadingProjects(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this project?')) return;
        try {
            await api.deleteProject(id);
            setProjects((prev) => prev.filter((p) => p._id !== id));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDownload(id: string) {
        try {
            const blob = await api.downloadProject(id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translated_manga.zip';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-grid">
            {/* ── Top Bar ─────────────────────────────────────── */}
            <nav className="border-b border-white/5 bg-surface-900/80 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-400" />
                        <span className="font-bold">MangaScans</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{user?.name}</span>
                        {user?.isAdmin && (
                            <button
                                onClick={() => router.push('/admin')}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => { logout(); router.push('/'); }}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* ── Header ────────────────────────────────────── */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold">Projects</h1>
                        <p className="text-gray-400 mt-1">Manage your manga translation projects</p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>

                {/* ── Upload Zone for Selected Project ──────────── */}
                {selectedProject && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-8"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Upload Pages</h3>
                            <button onClick={() => setSelectedProject(null)} className="text-gray-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <UploadDropzone projectId={selectedProject} onUploaded={fetchProjects} />
                    </motion.div>
                )}

                {/* ── Project Grid ──────────────────────────────── */}
                {loadingProjects ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                    </div>
                ) : projects.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-300">No projects yet</h3>
                        <p className="text-gray-500 mt-2 mb-6">Create your first project to start translating manga</p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                        >
                            Create Project
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                            {projects.map((project, i) => (
                                <motion.div
                                    key={project._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="glass p-5 group hover:border-brand-500/20 transition-all"
                                >
                                    {/* Cover Preview */}
                                    <div className="h-40 bg-white/[0.02] rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                                        {project.coverUrl ? (
                                            <img src={project.coverUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                                        ) : (
                                            <ImageIcon className="w-10 h-10 text-gray-600" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold truncate">{project.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Languages className="w-3 h-3 text-gray-500" />
                                                <span className="text-xs text-gray-500">
                                                    {project.sourceLanguage.toUpperCase()} → {project.targetLanguage.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <StatusBadge status={project.status} />
                                    </div>

                                    {/* Progress */}
                                    {project.pageCount > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                                <span>{project.processedCount}/{project.pageCount} pages</span>
                                                <span>{Math.round((project.processedCount / project.pageCount) * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${(project.processedCount / project.pageCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedProject(project._id)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            Upload
                                        </button>
                                        <button
                                            onClick={() => router.push(`/editor/${project._id}`)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            View
                                        </button>
                                        {project.status === 'completed' && (
                                            <button
                                                onClick={() => handleDownload(project._id)}
                                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-2 rounded-lg transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(project._id)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <p className="text-xs text-gray-600 mt-3">
                                        {new Date(project.createdAt).toLocaleDateString()}
                                    </p>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* ── Modals ──────────────────────────────────────── */}
            <CreateProjectModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={(project) => setProjects((prev) => [project, ...prev])}
            />
        </main>
    );
}
