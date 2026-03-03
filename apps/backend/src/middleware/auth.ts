// ============================================================
// MangaScans — JWT Auth Middleware
// ============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthRequest extends Request {
    userId?: string;
    userEmail?: string;
    isAdmin?: boolean;
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(userId: string, email: string, isAdmin: boolean = false): string {
    return jwt.sign(
        { userId, email, isAdmin },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

/**
 * Middleware: Require valid JWT.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; isAdmin: boolean };
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.isAdmin = decoded.isAdmin;
        next();
    } catch {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

/**
 * Middleware: Require admin role.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
    if (!req.isAdmin) {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
    }
    next();
}
