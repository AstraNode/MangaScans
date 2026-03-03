// ============================================================
// MangaScans — Auth Routes
// ============================================================

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel, RegisterSchema, LoginSchema } from '@mangascans/shared';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

// ── Register ─────────────────────────────────────────────────

authRouter.post('/register', async (req: Request, res: Response) => {
    try {
        const parsed = RegisterSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }

        const { email, password, name } = parsed.data;

        // Check existing user
        const existing = await UserModel.findOne({ email });
        if (existing) {
            res.status(409).json({ success: false, error: 'Email already registered' });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await UserModel.create({
            email,
            password: hashedPassword,
            name,
        });

        const token = generateToken(user._id.toString(), user.email, user.isAdmin);

        res.status(201).json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    plan: user.plan,
                    isAdmin: user.isAdmin,
                },
            },
        });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// ── Login ────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
    try {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, error: parsed.error.errors[0].message });
            return;
        }

        const { email, password } = parsed.data;

        const user = await UserModel.findOne({ email });
        if (!user || !user.password) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        const token = generateToken(user._id.toString(), user.email, user.isAdmin);

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    plan: user.plan,
                    isAdmin: user.isAdmin,
                },
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// ── Google OAuth ─────────────────────────────────────────────

authRouter.post('/google', async (req: Request, res: Response) => {
    try {
        const { googleId, email, name, avatar } = req.body;

        if (!googleId || !email) {
            res.status(400).json({ success: false, error: 'Missing Google auth data' });
            return;
        }

        // Find or create user
        let user = await UserModel.findOne({ googleId });
        if (!user) {
            user = await UserModel.findOne({ email });
            if (user) {
                // Link Google account to existing user
                user.googleId = googleId;
                if (avatar) user.avatar = avatar;
                await user.save();
            } else {
                user = await UserModel.create({ email, name, googleId, avatar });
            }
        }

        const token = generateToken(user._id.toString(), user.email, user.isAdmin);

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    plan: user.plan,
                    isAdmin: user.isAdmin,
                },
            },
        });
    } catch (error: any) {
        console.error('Google auth error:', error);
        res.status(500).json({ success: false, error: 'Google authentication failed' });
    }
});

// ── Get Current User ─────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const user = await UserModel.findById(req.userId).select('-password');
        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }

        res.json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
});
