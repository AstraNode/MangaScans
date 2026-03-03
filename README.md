# 🎨 MangaScans — AI-Powered Manga Translation Platform

Automatically translate manga and manhwa with AI-powered OCR, multi-step translation, text inpainting, and smart typesetting.

## ✨ Features

- **Smart OCR** — Detects Japanese, Korean, Chinese text with bounding boxes (Google Vision API)
- **AI Translation** — 4-step pipeline: direct → context-aware → tone correction → cultural localization (GPT-4o / DeepL)
- **AI Proofreading** — Grammar, naturalness, and character consistency checks
- **Text Inpainting** — Removes original text and repairs artwork (Replicate / Sharp fallback)
- **Auto Typesetting** — Smart font scaling, word wrapping, and center alignment in bubbles
- **Interactive Editor** — Click bubbles to edit translations, adjust font size, reprocess with AI
- **Batch Processing** — Upload entire chapters, process in parallel via BullMQ workers
- **Real-time Progress** — WebSocket updates as pages are processed
- **9+ Languages** — English, Spanish, French, German, Portuguese, Russian, and more
- **Private Projects** — JWT auth with Google OAuth support
- **Export** — Download as PNG, WebP, or batch ZIP
- **Admin Panel** — Monitor jobs, view errors, manage users

## 🏗 Architecture

```
├── apps/frontend      Next.js 14 + Tailwind + Framer Motion
├── apps/backend       Express + Socket.IO + Multer
├── services/ocr       Google Vision OCR
├── services/translation   GPT-4o / DeepL multi-step
├── services/inpainting    Replicate SD / Sharp
├── services/typesetting   SVG + Sharp compositing
├── workers            BullMQ processing pipeline
├── shared             Types, DB models, S3, queue
└── docker             Dockerfiles + compose + nginx
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- (Optional) API keys for full AI: OpenAI, DeepL, Google Vision, Replicate

### 1. Clone and Setup

```bash
cd D:\MangaScans
cp .env.template .env
# Edit .env with your API keys
npm install
```

### 2. Start Infrastructure

```bash
# Start MongoDB, Redis, MinIO
docker compose -f docker/docker-compose.yml up -d mongodb redis minio
```

### 3. Run Development Servers

```bash
# Terminal 1: Backend API
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Terminal 3: Worker
npm run dev:worker
```

### 4. Open Browser

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000/api/health
- **MinIO Console**: http://localhost:9001

## 🐳 Production Deployment

### Docker Compose (All-in-One)

```bash
cp .env.template .env  # Configure API keys
docker compose -f docker/docker-compose.yml up -d
```

This starts: MongoDB, Redis, MinIO, Backend, Worker, Frontend, and Nginx.

- **App**: http://localhost (via Nginx)
- **API**: http://localhost/api

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | JWT signing secret | ✅ |
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `REDIS_HOST` | Redis hostname | ✅ |
| `OPENAI_API_KEY` | GPT-4o for translation | For AI |
| `DEEPL_API_KEY` | DeepL for direct translation | For AI |
| `GOOGLE_VISION_API_KEY` | Google Vision OCR | For AI |
| `REPLICATE_API_TOKEN` | Stable Diffusion inpainting | For AI |
| `S3_ENDPOINT` | S3-compatible storage URL | ✅ |
| `S3_ACCESS_KEY` | S3 access key | ✅ |
| `S3_SECRET_KEY` | S3 secret key | ✅ |

> **Note**: The app works without AI API keys using mock/fallback providers. Add keys to enable full AI capabilities.

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login (returns JWT)
- `POST /api/auth/google` — Google OAuth
- `GET /api/auth/me` — Current user

### Projects
- `POST /api/projects` — Create project
- `GET /api/projects` — List projects
- `GET /api/projects/:id` — Project details + pages
- `DELETE /api/projects/:id` — Delete project

### Pages
- `POST /api/pages/upload/:projectId` — Upload pages (multipart)
- `GET /api/pages/:id` — Page details + bubbles
- `PUT /api/pages/:id/bubbles` — Edit bubble translations
- `POST /api/pages/:id/reprocess` — Re-run AI pipeline
- `GET /api/pages/download/:projectId` — Download ZIP

### Admin
- `GET /api/admin/stats` — Dashboard stats
- `GET /api/admin/jobs` — Queue jobs
- `GET /api/admin/errors` — Error logs

## 🧠 Processing Pipeline

Each uploaded page goes through 7 automated steps:

1. **Preprocess** — Normalize, enhance contrast, resize
2. **Detect** — Find speech bubbles via OCR bounding boxes
3. **OCR** — Extract Japanese/Korean/Chinese text
4. **Translate** — 4-step: direct → contextual → tone → cultural
5. **Proofread** — Grammar + naturalness check
6. **Inpaint** — Remove original text, repair artwork
7. **Typeset** — Render translated text in bubbles
8. **Export** — Save PNG + WebP for CDN

## 📄 License

MIT
