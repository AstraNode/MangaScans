// ============================================================
// MangaScans — Shared Type Definitions
// ============================================================

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────

export enum ProjectStatus {
    CREATED = 'created',
    UPLOADING = 'uploading',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export enum PageStatus {
    PENDING = 'pending',
    PREPROCESSING = 'preprocessing',
    DETECTING = 'detecting',
    OCR = 'ocr',
    TRANSLATING = 'translating',
    PROOFREADING = 'proofreading',
    INPAINTING = 'inpainting',
    TYPESETTING = 'typesetting',
    RENDERING = 'rendering',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export enum UserPlan {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise',
}

export enum TranslationStyle {
    FORMAL = 'formal',
    CASUAL = 'casual',
    DRAMATIC = 'dramatic',
    NEUTRAL = 'neutral',
}

export enum TargetLanguage {
    EN = 'en',
    ES = 'es',
    FR = 'fr',
    DE = 'de',
    PT = 'pt',
    RU = 'ru',
    ZH = 'zh',
    KO = 'ko',
    JA = 'ja',
}

// ── Interfaces ───────────────────────────────────────────────

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Bubble {
    id: string;
    boundingBox: BoundingBox;
    originalText: string;
    translatedText: string;
    proofreadText: string;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    isVertical: boolean;
    confidence: number;
}

export interface IUser {
    _id: string;
    email: string;
    password?: string;
    name: string;
    avatar?: string;
    plan: UserPlan;
    apiUsage: {
        ocrCalls: number;
        translationCalls: number;
        inpaintingCalls: number;
        totalPages: number;
    };
    googleId?: string;
    isAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProject {
    _id: string;
    userId: string;
    title: string;
    description?: string;
    sourceLanguage: string;
    targetLanguage: TargetLanguage;
    translationStyle: TranslationStyle;
    status: ProjectStatus;
    pageCount: number;
    processedCount: number;
    coverUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPage {
    _id: string;
    projectId: string;
    pageNumber: number;
    originalUrl: string;
    processedUrl?: string;
    translatedUrl?: string;
    inpaintedUrl?: string;
    finalUrl?: string;
    status: PageStatus;
    bubbles: Bubble[];
    processingLog: string[];
    error?: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

// ── Job Payloads ─────────────────────────────────────────────

export interface PageJobPayload {
    pageId: string;
    projectId: string;
    userId: string;
    sourceLanguage: string;
    targetLanguage: TargetLanguage;
    translationStyle: TranslationStyle;
    originalUrl: string;
    retryCount: number;
}

export interface PipelineResult {
    pageId: string;
    status: PageStatus;
    bubbles: Bubble[];
    finalUrl: string;
    processingLog: string[];
}

// ── Zod Schemas (Validation) ─────────────────────────────────

export const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2).max(100),
});

export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const CreateProjectSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    sourceLanguage: z.string().default('ja'),
    targetLanguage: z.nativeEnum(TargetLanguage).default(TargetLanguage.EN),
    translationStyle: z.nativeEnum(TranslationStyle).default(TranslationStyle.NEUTRAL),
});

export const UpdateBubblesSchema = z.object({
    bubbles: z.array(z.object({
        id: z.string(),
        translatedText: z.string(),
        fontSize: z.number().optional(),
        fontFamily: z.string().optional(),
        textColor: z.string().optional(),
    })),
});

// ── API Response Types ───────────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    total: number;
    page: number;
    limit: number;
}

// ── WebSocket Events ─────────────────────────────────────────

export enum WsEvent {
    PAGE_PROGRESS = 'page:progress',
    PAGE_COMPLETED = 'page:completed',
    PAGE_FAILED = 'page:failed',
    PROJECT_COMPLETED = 'project:completed',
    JOB_STATUS = 'job:status',
}

export interface WsProgressPayload {
    pageId: string;
    projectId: string;
    status: PageStatus;
    progress: number; // 0-100
    message: string;
}
