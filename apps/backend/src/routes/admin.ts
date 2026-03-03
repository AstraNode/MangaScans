// ============================================================
// MangaScans — Admin Routes
// ============================================================

import { Router, Response } from 'express';
import { UserModel, ProjectModel, PageModel, getPageQueue, getRedisConnection } from '@mangascans/shared';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// ── Dashboard Stats ──────────────────────────────────────────

adminRouter.get('/stats', async (_req: AuthRequest, res: Response) => {
    try {
        const [users, projects, pages, queue] = await Promise.all([
            UserModel.countDocuments(),
            ProjectModel.countDocuments(),
            PageModel.countDocuments(),
            getPageQueue().getJobCounts(),
        ]);

        res.json({
            success: true,
            data: {
                users,
                projects,
                pages,
                queue: {
                    waiting: queue.waiting,
                    active: queue.active,
                    completed: queue.completed,
                    failed: queue.failed,
                    delayed: queue.delayed,
                },
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to get stats' });
    }
});

// ── List Jobs ────────────────────────────────────────────────

adminRouter.get('/jobs', async (req: AuthRequest, res: Response) => {
    try {
        const status = (req.query.status as string) || 'active';
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 20;

        const queue = getPageQueue();
        const jobs = await queue.getJobs([status as any], page * limit, page * limit + limit - 1);

        res.json({
            success: true,
            data: jobs.map((j) => ({
                id: j.id,
                name: j.name,
                data: j.data,
                progress: j.progress,
                attemptsMade: j.attemptsMade,
                timestamp: j.timestamp,
                failedReason: j.failedReason,
            })),
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to list jobs' });
    }
});

// ── Retry Failed Job ─────────────────────────────────────────

adminRouter.post('/jobs/:id/retry', async (req: AuthRequest, res: Response) => {
    try {
        const queue = getPageQueue();
        const job = await queue.getJob(req.params.id);
        if (!job) {
            res.status(404).json({ success: false, error: 'Job not found' });
            return;
        }
        await job.retry();
        res.json({ success: true, message: 'Job retried' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to retry job' });
    }
});

// ── List Users ───────────────────────────────────────────────

adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const [users, total] = await Promise.all([
            UserModel.find().select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            UserModel.countDocuments(),
        ]);

        res.json({ success: true, data: users, total, page, limit });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to list users' });
    }
});

// ── Error Logs (Recent Failed Pages) ─────────────────────────

adminRouter.get('/errors', async (_req: AuthRequest, res: Response) => {
    try {
        const failedPages = await PageModel.find({ status: 'failed' })
            .sort({ updatedAt: -1 })
            .limit(50)
            .select('projectId pageNumber status error processingLog updatedAt');

        res.json({ success: true, data: failedPages });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to get errors' });
    }
});
