'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Sparkles, Users, Folder, Image, Activity, AlertTriangle,
    Loader2, ArrowLeft, RefreshCw, CheckCircle, Clock, XCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Stats {
    users: number;
    projects: number;
    pages: number;
    queue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
}

export default function AdminPage() {
    const router = useRouter();
    const { loadUser, isAuthenticated, isLoading, user } = useAuthStore();
    const [stats, setStats] = useState<Stats | null>(null);
    const [errors, setErrors] = useState<any[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);
    const [jobTab, setJobTab] = useState<'active' | 'waiting' | 'failed' | 'completed'>('active');
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadUser(); }, []);

    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !user?.isAdmin)) {
            router.push('/dashboard');
        }
    }, [isLoading, isAuthenticated, user]);

    useEffect(() => {
        if (isAuthenticated && user?.isAdmin) {
            fetchData();
        }
    }, [isAuthenticated, user]);

    async function fetchData() {
        try {
            const [statsRes, errorsRes, jobsRes] = await Promise.all([
                api.getAdminStats(),
                api.getAdminErrors(),
                api.getAdminJobs(jobTab),
            ]);
            setStats(statsRes.data);
            setErrors(errorsRes.data || []);
            setJobs(jobsRes.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isAuthenticated && user?.isAdmin) {
            api.getAdminJobs(jobTab).then((r) => setJobs(r.data || [])).catch(console.error);
        }
    }, [jobTab]);

    if (isLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-grid p-6">
            <div className="max-w-7xl mx-auto">
                {/* ── Header ────────────────────────────────────── */}
                <div className="flex items-center gap-4 mb-10">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-brand-400" />
                            Admin Panel
                        </h1>
                        <p className="text-sm text-gray-400">System overview and management</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="ml-auto text-gray-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Stats Cards ───────────────────────────────── */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                        {[
                            { icon: Users, label: 'Users', value: stats.users, color: 'text-blue-400' },
                            { icon: Folder, label: 'Projects', value: stats.projects, color: 'text-purple-400' },
                            { icon: Image, label: 'Pages', value: stats.pages, color: 'text-cyan-400' },
                            { icon: Activity, label: 'Active Jobs', value: stats.queue.active, color: 'text-brand-400' },
                        ].map(({ icon: Icon, label, value, color }) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass p-5"
                            >
                                <Icon className={`w-5 h-5 ${color} mb-2`} />
                                <div className="text-2xl font-bold">{value}</div>
                                <div className="text-xs text-gray-500">{label}</div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* ── Queue Status ──────────────────────────────── */}
                {stats && (
                    <div className="glass p-5 mb-10">
                        <h3 className="font-semibold mb-4">Queue Status</h3>
                        <div className="grid grid-cols-5 gap-3">
                            {Object.entries(stats.queue).map(([key, val]) => {
                                const icons: Record<string, React.ElementType> = {
                                    waiting: Clock, active: Activity, completed: CheckCircle,
                                    failed: XCircle, delayed: Clock,
                                };
                                const Icon = icons[key] || Activity;
                                return (
                                    <div key={key} className="bg-white/5 rounded-lg p-3 text-center">
                                        <Icon className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                                        <div className="text-lg font-semibold">{val}</div>
                                        <div className="text-xs text-gray-500 capitalize">{key}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* ── Jobs ────────────────────────────────────── */}
                    <div className="glass p-5">
                        <h3 className="font-semibold mb-4">Jobs</h3>
                        <div className="flex gap-2 mb-4">
                            {(['active', 'waiting', 'failed', 'completed'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setJobTab(tab)}
                                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${jobTab === tab ? 'bg-brand-500/20 text-brand-300' : 'bg-white/5 text-gray-400'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {jobs.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No {jobTab} jobs</p>
                            ) : (
                                jobs.map((job) => (
                                    <div key={job.id} className="bg-white/5 rounded-lg p-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">{job.name}</span>
                                            <span className="text-xs text-gray-500">Attempt {job.attemptsMade}</span>
                                        </div>
                                        {job.failedReason && (
                                            <p className="text-xs text-red-400 mt-1 truncate">{job.failedReason}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Errors ──────────────────────────────────── */}
                    <div className="glass p-5">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            Recent Errors
                        </h3>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {errors.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">No errors 🎉</p>
                            ) : (
                                errors.map((err) => (
                                    <div key={err._id} className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">Page {err.pageNumber}</span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(err.updatedAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-red-400 mt-1">{err.error}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
