// ============================================================
// MangaScans — Project Routes
// ============================================================

import { Router, Response } from 'express';
import {
    ProjectModel, PageModel, CreateProjectSchema, ProjectStatus,
} from '@mangascans/shared';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

// ── Create Project ───────────────────────────────────────────

projectsRouter.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const parsed = CreateProjectSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }

        const project = await ProjectModel.create({
            userId: req.userId,
            ...parsed.data,
        });

        res.status(201).json({ success: true, data: project });
    } catch (error: any) {
        console.error('Create project error:', error);
        res.status(500).json({ success: false, error: 'Failed to create project' });
    }
});

// ── List User's Projects ─────────────────────────────────────

projectsRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const skip = (page - 1) * limit;

        const [projects, total] = await Promise.all([
            ProjectModel.find({ userId: req.userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            ProjectModel.countDocuments({ userId: req.userId }),
        ]);

        res.json({ success: true, data: projects, total, page, limit });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to list projects' });
    }
});

// ── Get Project Detail ───────────────────────────────────────

projectsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const project = await ProjectModel.findOne({ _id: req.params.id, userId: req.userId });
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }

        const pages = await PageModel.find({ projectId: project._id }).sort({ pageNumber: 1 });

        res.json({
            success: true,
            data: { ...project.toObject(), pages },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to get project' });
    }
});

// ── Update Project ───────────────────────────────────────────

projectsRouter.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const project = await ProjectModel.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: req.body },
            { new: true }
        );

        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }

        res.json({ success: true, data: project });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to update project' });
    }
});

// ── Delete Project ───────────────────────────────────────────

projectsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const project = await ProjectModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }

        // Delete associated pages
        await PageModel.deleteMany({ projectId: req.params.id });

        res.json({ success: true, message: 'Project deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to delete project' });
    }
});
