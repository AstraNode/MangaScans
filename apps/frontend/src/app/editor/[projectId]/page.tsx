'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Save, RotateCcw, Download, Loader2, ChevronLeft,
    ChevronRight, Type, Palette, Move, Sparkles, Check
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Bubble {
    id: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    originalText: string;
    translatedText: string;
    proofreadText: string;
    fontSize: number;
    fontFamily: string;
    textColor: string;
}

interface Page {
    _id: string;
    pageNumber: number;
    originalUrl: string;
    finalUrl?: string;
    inpaintedUrl?: string;
    status: string;
    bubbles: Bubble[];
}

export default function EditorPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const router = useRouter();
    const { loadUser, isAuthenticated, isLoading: authLoading } = useAuthStore();

    const [pages, setPages] = useState<Page[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
    const [editText, setEditText] = useState('');
    const [editFontSize, setEditFontSize] = useState(16);
    const [showOriginal, setShowOriginal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [projectTitle, setProjectTitle] = useState('');

    const canvasRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadUser(); }, []);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
    }, [authLoading, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && projectId) fetchProject();
    }, [isAuthenticated, projectId]);

    async function fetchProject() {
        try {
            const res = await api.getProject(projectId);
            setProjectTitle(res.data.title || 'Untitled');
            setPages(res.data.pages || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const currentPage = pages[currentPageIndex];
    const imageUrl = showOriginal
        ? currentPage?.originalUrl
        : (currentPage?.finalUrl || currentPage?.inpaintedUrl || currentPage?.originalUrl);

    function handleBubbleClick(bubble: Bubble) {
        setSelectedBubble(bubble);
        setEditText(bubble.proofreadText || bubble.translatedText);
        setEditFontSize(bubble.fontSize || 16);
    }

    async function handleSaveBubble() {
        if (!selectedBubble || !currentPage) return;
        setSaving(true);
        try {
            await api.updateBubbles(currentPage._id, [{
                id: selectedBubble.id,
                translatedText: editText,
                fontSize: editFontSize,
            }]);

            // Update local state
            const updated = { ...selectedBubble, translatedText: editText, fontSize: editFontSize };
            setPages((prev) =>
                prev.map((p) =>
                    p._id === currentPage._id
                        ? { ...p, bubbles: p.bubbles.map((b) => (b.id === updated.id ? updated : b)) }
                        : p
                )
            );
            setSelectedBubble(updated);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleReprocess() {
        if (!currentPage) return;
        try {
            await api.reprocessPage(currentPage._id);
            alert('Page queued for reprocessing!');
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-900">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-surface-900 flex flex-col">
            {/* ── Top Bar ─────────────────────────────────────── */}
            <nav className="border-b border-white/5 bg-surface-800/80 backdrop-blur-xl h-14 flex items-center px-4 gap-4 shrink-0">
                <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-semibold text-sm truncate">{projectTitle}</h1>
                <span className="text-xs text-gray-500">
                    Page {currentPageIndex + 1} of {pages.length}
                </span>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setShowOriginal(!showOriginal)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showOriginal ? 'bg-brand-500/20 text-brand-300' : 'bg-white/5 text-gray-400'
                            }`}
                    >
                        {showOriginal ? 'Original' : 'Translated'}
                    </button>
                    <button
                        onClick={handleReprocess}
                        className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        title="Reprocess page"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </nav>

            {/* ── Main Content ────────────────────────────────── */}
            <div className="flex-1 flex">
                {/* ── Canvas Area ─────────────────────────────────── */}
                <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
                    {currentPage ? (
                        <div ref={canvasRef} className="relative inline-block">
                            <img
                                src={imageUrl}
                                alt={`Page ${currentPage.pageNumber}`}
                                className="max-h-[80vh] rounded-xl shadow-2xl"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
                            />

                            {/* Bubble Overlays */}
                            {!showOriginal && currentPage.bubbles.map((bubble) => (
                                <div
                                    key={bubble.id}
                                    onClick={() => handleBubbleClick(bubble)}
                                    className={`absolute border-2 rounded cursor-pointer transition-all hover:border-brand-400 ${selectedBubble?.id === bubble.id
                                            ? 'border-brand-500 bg-brand-500/10'
                                            : 'border-transparent hover:bg-white/5'
                                        }`}
                                    style={{
                                        left: `${(bubble.boundingBox.x / 1000) * 100}%`,
                                        top: `${(bubble.boundingBox.y / 1500) * 100}%`,
                                        width: `${(bubble.boundingBox.width / 1000) * 100}%`,
                                        height: `${(bubble.boundingBox.height / 1500) * 100}%`,
                                    }}
                                    title={bubble.originalText}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No pages in this project</p>
                    )}
                </div>

                {/* ── Sidebar ─────────────────────────────────────── */}
                <div className="w-80 border-l border-white/5 bg-surface-800/50 p-4 overflow-y-auto shrink-0">
                    {selectedBubble ? (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-4"
                        >
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Type className="w-4 h-4 text-brand-400" />
                                Edit Bubble
                            </h3>

                            {/* Original Text */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Original</label>
                                <div className="bg-white/5 p-3 rounded-lg text-sm text-gray-300 break-words">
                                    {selectedBubble.originalText}
                                </div>
                            </div>

                            {/* Translated Text */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Translation</label>
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-brand-500/50 focus:outline-none resize-none transition-colors"
                                />
                            </div>

                            {/* Font Size */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Font Size: {editFontSize}px</label>
                                <input
                                    type="range"
                                    min={8}
                                    max={32}
                                    value={editFontSize}
                                    onChange={(e) => setEditFontSize(parseInt(e.target.value))}
                                    className="w-full accent-brand-500"
                                />
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSaveBubble}
                                disabled={saving}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </button>

                            <button
                                onClick={() => setSelectedBubble(null)}
                                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-lg text-sm transition-colors"
                            >
                                Deselect
                            </button>
                        </motion.div>
                    ) : (
                        <div className="text-center text-gray-500 py-10">
                            <Move className="w-8 h-8 mx-auto mb-3 text-gray-600" />
                            <p className="text-sm">Click a bubble on the image to edit its translation</p>
                        </div>
                    )}

                    {/* ── Page List ───────────────────────────────── */}
                    <div className="mt-8">
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Pages</h3>
                        <div className="space-y-1">
                            {pages.map((page, i) => (
                                <button
                                    key={page._id}
                                    onClick={() => { setCurrentPageIndex(i); setSelectedBubble(null); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${i === currentPageIndex
                                            ? 'bg-brand-500/10 text-brand-300'
                                            : 'hover:bg-white/5 text-gray-400'
                                        }`}
                                >
                                    <span>Page {page.pageNumber}</span>
                                    {page.status === 'completed' && <Check className="w-3 h-3 text-emerald-400" />}
                                    {page.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Page Navigation ─────────────────────────────── */}
            <div className="border-t border-white/5 bg-surface-800/80 h-12 flex items-center justify-center gap-4 shrink-0">
                <button
                    onClick={() => { setCurrentPageIndex(Math.max(0, currentPageIndex - 1)); setSelectedBubble(null); }}
                    disabled={currentPageIndex === 0}
                    className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-400">
                    {currentPageIndex + 1} / {pages.length}
                </span>
                <button
                    onClick={() => { setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1)); setSelectedBubble(null); }}
                    disabled={currentPageIndex >= pages.length - 1}
                    className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </main>
    );
}
