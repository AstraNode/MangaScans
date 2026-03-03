// ============================================================
// MangaScans — Page Routes (Upload + Processing)
// ============================================================

import { Router, Response } from 'express';
import multer from 'multer';
import archiver from 'archiver';
import {
    PageModel, ProjectModel, PageStatus, ProjectStatus,
    uploadFile, downloadFile, pageStorageKey, getPageQueue,
    UpdateBubblesSchema,
} from '@mangascans/shared';
import type { PageJobPayload } from '@mangascans/shared';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const pagesRouter = Router();
pagesRouter.use(requireAuth);

// Multer: in-memory storage for S3 upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    },
});

// ── Upload Pages ─────────────────────────────────────────────

pagesRouter.post(
    '/upload/:projectId',
    upload.array('pages', 100), // Max 100 pages at once
    async (req: AuthRequest, res: Response) => {
        try {
            const { projectId } = req.params;

            // Verify project ownership
            const project = await ProjectModel.findOne({ _id: projectId, userId: req.userId });
            if (!project) {
                res.status(404).json({ success: false, error: 'Project not found' });
                return;
            }

            const files = req.files as Express.Multer.File[];
            if (!files?.length) {
                res.status(400).json({ success: false, error: 'No files uploaded' });
                return;
            }

            const queue = getPageQueue();
            const existingPages = await PageModel.countDocuments({ projectId });
            const pages = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const pageNumber = existingPages + i + 1;
                const ext = file.mimetype.split('/')[1] || 'png';
                const key = pageStorageKey(projectId, pageNumber, 'original', ext);

                // Upload to S3
                const url = await uploadFile(key, file.buffer, file.mimetype);

                // Create page record
                const page = await PageModel.create({
                    projectId,
                    pageNumber,
                    originalUrl: url,
                    status: PageStatus.PENDING,
                });

                // Enqueue processing job
                const jobPayload: PageJobPayload = {
                    pageId: page._id.toString(),
                    projectId,
                    userId: req.userId!,
                    sourceLanguage: project.sourceLanguage,
                    targetLanguage: project.targetLanguage,
                    translationStyle: project.translationStyle,
                    originalUrl: url,
                    retryCount: 0,
                };

                await queue.add(`page-${page._id}`, jobPayload, {
                    priority: pageNumber, // Process in order
                });

                pages.push(page);

                // Set cover image from first page
                if (pageNumber === 1 && !project.coverUrl) {
                    project.coverUrl = url;
                }
            }

            // Update project
            project.pageCount += files.length;
            project.status = ProjectStatus.PROCESSING;
            await project.save();

            res.status(201).json({
                success: true,
                data: { pages, jobsQueued: pages.length },
                message: `${pages.length} pages uploaded and queued for processing`,
            });
        } catch (error: any) {
            console.error('Upload error:', error);
            res.status(500).json({ success: false, error: 'Upload failed' });
        }
    }
);

// ── Get Page Detail ──────────────────────────────────────────

pagesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const page = await PageModel.findById(req.params.id);
        if (!page) {
            res.status(404).json({ success: false, error: 'Page not found' });
            return;
        }

        // Verify ownership via project
        const project = await ProjectModel.findOne({ _id: page.projectId, userId: req.userId });
        if (!project) {
            res.status(403).json({ success: false, error: 'Access denied' });
            return;
        }

        res.json({ success: true, data: page });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to get page' });
    }
});

// ── Update Bubble Translations ───────────────────────────────

pagesRouter.put('/:id/bubbles', async (req: AuthRequest, res: Response) => {
    try {
        const parsed = UpdateBubblesSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: 'Invalid bubble data' });
            return;
        }

        const page = await PageModel.findById(req.params.id);
        if (!page) {
            res.status(404).json({ success: false, error: 'Page not found' });
            return;
        }

        // Merge updates into existing bubbles
        for (const update of parsed.data.bubbles) {
            const bubble = page.bubbles.find((b) => b.id === update.id);
            if (bubble) {
                bubble.translatedText = update.translatedText;
                if (update.fontSize) bubble.fontSize = update.fontSize;
                if (update.fontFamily) bubble.fontFamily = update.fontFamily;
                if (update.textColor) bubble.textColor = update.textColor;
            }
        }

        page.version += 1;
        await page.save();

        res.json({ success: true, data: page });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to update bubbles' });
    }
});

// ── Reprocess Page ───────────────────────────────────────────

pagesRouter.post('/:id/reprocess', async (req: AuthRequest, res: Response) => {
    try {
        const page = await PageModel.findById(req.params.id);
        if (!page) {
            res.status(404).json({ success: false, error: 'Page not found' });
            return;
        }

        const project = await ProjectModel.findOne({ _id: page.projectId, userId: req.userId });
        if (!project) {
            res.status(403).json({ success: false, error: 'Access denied' });
            return;
        }

        page.status = PageStatus.PENDING;
        page.error = undefined;
        await page.save();

        const queue = getPageQueue();
        const jobPayload: PageJobPayload = {
            pageId: page._id.toString(),
            projectId: page.projectId,
            userId: req.userId!,
            sourceLanguage: project.sourceLanguage,
            targetLanguage: project.targetLanguage,
            translationStyle: project.translationStyle,
            originalUrl: page.originalUrl,
            retryCount: 0,
        };

        await queue.add(`reprocess-${page._id}`, jobPayload);

        res.json({ success: true, message: 'Page queued for reprocessing' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to reprocess' });
    }
});

// ── Download All Pages as ZIP ────────────────────────────────

pagesRouter.get('/download/:projectId', async (req: AuthRequest, res: Response) => {
    try {
        const project = await ProjectModel.findOne({ _id: req.params.projectId, userId: req.userId });
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }

        const pages = await PageModel.find({
            projectId: project._id,
            status: PageStatus.COMPLETED,
            finalUrl: { $exists: true },
        }).sort({ pageNumber: 1 });

        if (!pages.length) {
            res.status(404).json({ success: false, error: 'No completed pages to download' });
            return;
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${project.title || 'manga'}_translated.zip"`);

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.pipe(res);

        for (const page of pages) {
            try {
                const key = page.finalUrl!.split('/').slice(-2).join('/');
                const buffer = await downloadFile(key);
                archive.append(buffer, { name: `page_${String(page.pageNumber).padStart(4, '0')}.png` });
            } catch (err) {
                console.warn(`Failed to download page ${page.pageNumber}:`, err);
            }
        }

        await archive.finalize();
    } catch (error: any) {
        console.error('Download error:', error);
        res.status(500).json({ success: false, error: 'Download failed' });
    }
});
