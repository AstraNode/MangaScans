// ============================================================
// MangaScans — Mongoose Database Models
// ============================================================

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IUser, IProject, IPage, UserPlan, ProjectStatus, PageStatus, TranslationStyle, TargetLanguage } from './types';

// ── User Model ───────────────────────────────────────────────

const UserSchema = new Schema<IUser & Document>(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String }, // optional for OAuth users
        name: { type: String, required: true, trim: true },
        avatar: { type: String },
        plan: { type: String, enum: Object.values(UserPlan), default: UserPlan.FREE },
        apiUsage: {
            ocrCalls: { type: Number, default: 0 },
            translationCalls: { type: Number, default: 0 },
            inpaintingCalls: { type: Number, default: 0 },
            totalPages: { type: Number, default: 0 },
        },
        googleId: { type: String, unique: true, sparse: true },
        isAdmin: { type: Boolean, default: false },
    },
    { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });

// ── Project Model ────────────────────────────────────────────

const ProjectSchema = new Schema<IProject & Document>(
    {
        userId: { type: String, required: true, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        sourceLanguage: { type: String, default: 'ja' },
        targetLanguage: { type: String, enum: Object.values(TargetLanguage), default: TargetLanguage.EN },
        translationStyle: { type: String, enum: Object.values(TranslationStyle), default: TranslationStyle.NEUTRAL },
        status: { type: String, enum: Object.values(ProjectStatus), default: ProjectStatus.CREATED },
        pageCount: { type: Number, default: 0 },
        processedCount: { type: Number, default: 0 },
        coverUrl: { type: String },
    },
    { timestamps: true }
);

ProjectSchema.index({ userId: 1, createdAt: -1 });

// ── Page Model ───────────────────────────────────────────────

const BubbleSchema = new Schema(
    {
        id: { type: String, required: true },
        boundingBox: {
            x: { type: Number, required: true },
            y: { type: Number, required: true },
            width: { type: Number, required: true },
            height: { type: Number, required: true },
        },
        originalText: { type: String, default: '' },
        translatedText: { type: String, default: '' },
        proofreadText: { type: String, default: '' },
        fontSize: { type: Number, default: 16 },
        fontFamily: { type: String, default: 'CC Wild Words' },
        textColor: { type: String, default: '#000000' },
        isVertical: { type: Boolean, default: false },
        confidence: { type: Number, default: 0 },
    },
    { _id: false }
);

const PageSchema = new Schema<IPage & Document>(
    {
        projectId: { type: String, required: true, index: true },
        pageNumber: { type: Number, required: true },
        originalUrl: { type: String, required: true },
        processedUrl: { type: String },
        translatedUrl: { type: String },
        inpaintedUrl: { type: String },
        finalUrl: { type: String },
        status: { type: String, enum: Object.values(PageStatus), default: PageStatus.PENDING },
        bubbles: [BubbleSchema],
        processingLog: [{ type: String }],
        error: { type: String },
        version: { type: Number, default: 1 },
    },
    { timestamps: true }
);

PageSchema.index({ projectId: 1, pageNumber: 1 });

// ── Model Exports ────────────────────────────────────────────

export const UserModel: Model<IUser & Document> =
    mongoose.models.User || mongoose.model<IUser & Document>('User', UserSchema);

export const ProjectModel: Model<IProject & Document> =
    mongoose.models.Project || mongoose.model<IProject & Document>('Project', ProjectSchema);

export const PageModel: Model<IPage & Document> =
    mongoose.models.Page || mongoose.model<IPage & Document>('Page', PageSchema);

// ── Database Connection ──────────────────────────────────────

let isConnected = false;

export async function connectDB(uri?: string): Promise<void> {
    if (isConnected) return;

    const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/mangascans';

    try {
        await mongoose.connect(mongoUri);
        isConnected = true;
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}
