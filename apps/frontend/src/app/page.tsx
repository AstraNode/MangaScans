'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Sparkles, Upload, Languages, Paintbrush, Download, ArrowRight,
    Zap, Shield, Globe, Eye
} from 'lucide-react';

// ── Animated Background ──────────────────────────────────────

function AnimatedBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden">
            <div className="bg-grid absolute inset-0" />
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
        </div>
    );
}

// ── Feature Card ─────────────────────────────────────────────

function FeatureCard({
    icon: Icon,
    title,
    description,
    delay,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay }}
            className="glass p-6 hover:border-brand-500/30 transition-all duration-300 group cursor-default"
        >
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <Icon className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </motion.div>
    );
}

// ── Pipeline Step ────────────────────────────────────────────

function PipelineStep({
    number,
    title,
    description,
    delay,
}: {
    number: string;
    title: string;
    description: string;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="flex items-start gap-4"
        >
            <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                <span className="text-brand-400 font-bold text-sm">{number}</span>
            </div>
            <div>
                <h4 className="font-semibold text-white">{title}</h4>
                <p className="text-sm text-gray-400 mt-1">{description}</p>
            </div>
        </motion.div>
    );
}

// ── Landing Page ─────────────────────────────────────────────

export default function LandingPage() {
    return (
        <main className="relative">
            <AnimatedBackground />

            {/* ── Navbar ───────────────────────────────────────── */}
            <nav className="fixed top-0 w-full z-50 glass-sm border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-brand-400" />
                        <span className="font-bold text-lg">MangaScans</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/login"
                            className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2"
                        >
                            Log in
                        </Link>
                        <Link
                            href="/register"
                            className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg transition-colors font-medium"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero Section ────────────────────────────────── */}
            <section className="min-h-screen flex items-center justify-center px-6 pt-16">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-sm text-sm text-brand-300 mb-8">
                            <Zap className="w-4 h-4" />
                            AI-Powered Manga Translation
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
                            Translate Manga{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-purple-400 to-cyan-400">
                                Instantly
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                            Upload your manga pages and let AI handle OCR, translation, text removal, and typesetting.
                            Professional-quality scanlation in minutes, not days.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/register"
                                className="group bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-xl transition-all font-semibold text-lg flex items-center gap-2 brand-glow"
                            >
                                Start Translating
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                href="#features"
                                className="text-gray-400 hover:text-white px-8 py-3.5 rounded-xl transition-colors border border-white/10 hover:border-white/20"
                            >
                                See How It Works
                            </Link>
                        </div>
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-20 grid grid-cols-3 gap-8"
                    >
                        {[
                            { label: 'Pages Processed', value: '50K+' },
                            { label: 'Languages', value: '9+' },
                            { label: 'Avg. Processing', value: '<30s' },
                        ].map((stat) => (
                            <div key={stat.label} className="text-center">
                                <div className="text-3xl font-bold text-white">{stat.value}</div>
                                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────── */}
            <section id="features" className="py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
                        <p className="text-gray-400 text-lg">End-to-end AI pipeline for professional manga translation</p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FeatureCard
                            icon={Eye}
                            title="Smart OCR"
                            description="Detects Japanese, Korean, and Chinese text with precise bounding box coordinates."
                            delay={0}
                        />
                        <FeatureCard
                            icon={Languages}
                            title="AI Translation"
                            description="Multi-step pipeline: direct translation, context-aware rewrite, tone correction."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={Paintbrush}
                            title="Clean Inpainting"
                            description="AI removes original text and repairs artwork seamlessly."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={Upload}
                            title="Auto Typesetting"
                            description="Smart font scaling, line breaking, and center alignment in speech bubbles."
                            delay={0.3}
                        />
                        <FeatureCard
                            icon={Download}
                            title="Batch Export"
                            description="Process entire chapters at once. Download as PNG, WebP, or PDF."
                            delay={0.4}
                        />
                        <FeatureCard
                            icon={Globe}
                            title="9+ Languages"
                            description="Translate to English, Spanish, French, German, Portuguese, Russian, and more."
                            delay={0.5}
                        />
                        <FeatureCard
                            icon={Zap}
                            title="Real-time Progress"
                            description="Watch your pages being processed live with WebSocket updates."
                            delay={0.6}
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Private & Secure"
                            description="Your projects are private. JWT auth, encrypted storage, secure APIs."
                            delay={0.7}
                        />
                    </div>
                </div>
            </section>

            {/* ── Pipeline Visualization ──────────────────────── */}
            <section className="py-32 px-6 bg-surface-800/30">
                <div className="max-w-4xl mx-auto">
                    <motion.h2
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-4xl font-bold text-center mb-16"
                    >
                        The AI Pipeline
                    </motion.h2>

                    <div className="space-y-8">
                        <PipelineStep number="1" title="Upload" description="Drag and drop manga pages or entire chapters." delay={0} />
                        <PipelineStep number="2" title="Detect & OCR" description="AI identifies speech bubbles and extracts text with coordinates." delay={0.1} />
                        <PipelineStep number="3" title="Translate" description="Multi-step: direct → context-aware → tone correction → cultural localization." delay={0.2} />
                        <PipelineStep number="4" title="Proofread" description="AI proofreads for grammar, naturalness, and character consistency." delay={0.3} />
                        <PipelineStep number="5" title="Inpaint" description="Original text removed. Artwork repaired with AI inpainting." delay={0.4} />
                        <PipelineStep number="6" title="Typeset" description="Translated text rendered in bubbles with smart font sizing." delay={0.5} />
                        <PipelineStep number="7" title="Export" description="Download high-res PNG, WebP, or batch ZIP." delay={0.6} />
                    </div>
                </div>
            </section>

            {/* ── CTA ─────────────────────────────────────────── */}
            <section className="py-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-4xl font-bold mb-6">Ready to Translate?</h2>
                        <p className="text-gray-400 text-lg mb-10">
                            Join thousands of scanlation teams using AI to translate manga faster and better.
                        </p>
                        <Link
                            href="/register"
                            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-10 py-4 rounded-xl font-semibold text-lg brand-glow transition-all"
                        >
                            Get Started Free
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────── */}
            <footer className="border-t border-white/5 py-12 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-400" />
                        <span className="font-semibold">MangaScans</span>
                    </div>
                    <p className="text-sm text-gray-500">
                        © 2024 MangaScans. AI-powered manga translation platform.
                    </p>
                </div>
            </footer>
        </main>
    );
}
