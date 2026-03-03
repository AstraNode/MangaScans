// ============================================================
// MangaScans — Express Backend Server
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB, getQueueEvents, WsEvent } from '@mangascans/shared';

import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { pagesRouter } from './routes/pages';
import { adminRouter } from './routes/admin';

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ────────────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});

// Track connected users by their userId
const userSockets = new Map<string, Set<string>>();

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string;
    if (userId) {
        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId)!.add(socket.id);
        socket.join(`user:${userId}`);
    }

    socket.on('join:project', (projectId: string) => {
        socket.join(`project:${projectId}`);
    });

    socket.on('disconnect', () => {
        if (userId) {
            userSockets.get(userId)?.delete(socket.id);
            if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
        }
    });
});

// Make io available to routes
app.set('io', io);

// ── Middleware ────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
}));

// ── Routes ───────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error Handler ────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Queue Event Forwarding ───────────────────────────────────

async function setupQueueEvents() {
    try {
        const queueEvents = getQueueEvents();
        queueEvents.on('progress', ({ data }: any) => {
            if (data?.projectId) {
                io.to(`project:${data.projectId}`).emit(WsEvent.PAGE_PROGRESS, data);
            }
        });
        queueEvents.on('completed', ({ returnvalue }: any) => {
            try {
                const result = JSON.parse(returnvalue);
                if (result?.projectId) {
                    io.to(`project:${result.projectId}`).emit(WsEvent.PAGE_COMPLETED, result);
                }
            } catch { }
        });
        queueEvents.on('failed', ({ failedReason }: any) => {
            console.error('Job failed:', failedReason);
        });
    } catch (error) {
        console.warn('⚠️ Queue events not available (Redis may be down)');
    }
}

// ── Start ────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
    await connectDB();
    await setupQueueEvents();

    httpServer.listen(PORT, () => {
        console.log(`🚀 MangaScans API running on port ${PORT}`);
        console.log(`📡 WebSocket ready`);
    });
}

start().catch(console.error);

export { app, io };
