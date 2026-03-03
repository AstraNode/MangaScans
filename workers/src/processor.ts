// ============================================================
// MangaScans — Page Processing Worker
// Full AI pipeline: preprocess → OCR → translate → inpaint → typeset → render
// ============================================================

import 'dotenv/config';
import { Job } from 'bullmq';
import sharp from 'sharp';
import {
    connectDB,
    createPageWorker,
    PageModel,
    ProjectModel,
    PageStatus,
    ProjectStatus,
    downloadFile,
    uploadFile,
    pageStorageKey,
    getRedisConnection,
} from '@mangascans/shared';
import type { PageJobPayload, WsProgressPayload, Bubble } from '@mangascans/shared';
import { runOCR } from '@mangascans/ocr';
import { translateText, proofreadText } from '@mangascans/translation';
import { inpaintImage } from '@mangascans/inpainting';
import { typesetPage, convertToWebP } from '@mangascans/typesetting';

// ── Progress Reporting ───────────────────────────────────────

async function reportProgress(
    job: Job,
    pageId: string,
    projectId: string,
    status: PageStatus,
    progress: number,
    message: string
): Promise<void> {
    // Update job progress
    await job.updateProgress(progress);

    // Publish via Redis for WebSocket delivery
    const redis = getRedisConnection();
    const payload: WsProgressPayload = { pageId, projectId, status, progress, message };
    await redis.publish('page-progress', JSON.stringify(payload));

    // Update page status in DB
    await PageModel.findByIdAndUpdate(pageId, {
        status,
        $push: { processingLog: `[${new Date().toISOString()}] ${message}` },
    });
}

// ── Preprocessing ────────────────────────────────────────────

async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    let pipeline = sharp(imageBuffer);

    // Intelligent resize: keep under 3000px on longest side
    const maxDim = 3000;
    if ((metadata.width || 0) > maxDim || (metadata.height || 0) > maxDim) {
        pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
    }

    // Enhance contrast slightly for better OCR
    pipeline = pipeline.normalize();

    // Convert to PNG for consistent processing
    return pipeline.png().toBuffer();
}

// ── Main Processing Pipeline ─────────────────────────────────

async function processPage(job: Job<PageJobPayload>): Promise<void> {
    const { pageId, projectId, userId, sourceLanguage, targetLanguage, translationStyle, originalUrl } = job.data;

    console.log(`\n🔄 Processing page ${pageId} for project ${projectId}`);

    try {
        // ── Step 1: Download & Preprocess ──────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.PREPROCESSING, 5, 'Downloading and preprocessing image...');

        const storageKey = originalUrl.split('/').pop() || '';
        const fullKey = `projects/${projectId}/pages/${storageKey}`;
        let imageBuffer: Buffer;

        try {
            imageBuffer = await downloadFile(fullKey);
        } catch {
            // Try downloading by URL directly
            const response = await fetch(originalUrl);
            imageBuffer = Buffer.from(await response.arrayBuffer());
        }

        const processedImage = await preprocessImage(imageBuffer);
        await reportProgress(job, pageId, projectId, PageStatus.PREPROCESSING, 10, 'Image preprocessed');

        // ── Step 2: Bubble Detection + OCR ─────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.DETECTING, 15, 'Detecting speech bubbles...');

        const bubbles = await runOCR(processedImage);
        console.log(`   Found ${bubbles.length} text regions`);
        await reportProgress(job, pageId, projectId, PageStatus.OCR, 25, `Detected ${bubbles.length} text regions`);

        if (bubbles.length === 0) {
            // No text found — just save the processed image
            const finalKey = pageStorageKey(projectId, 0, 'final');
            const finalUrl = await uploadFile(finalKey, processedImage);
            await PageModel.findByIdAndUpdate(pageId, {
                status: PageStatus.COMPLETED,
                finalUrl,
                bubbles: [],
                $push: { processingLog: 'No text detected — page saved as-is' },
            });
            await reportProgress(job, pageId, projectId, PageStatus.COMPLETED, 100, 'No text found – saved original');
            return;
        }

        // ── Step 3: Translation ────────────────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.TRANSLATING, 30, 'Translating text...');

        const allOriginalText = bubbles.map((b) => b.originalText).join(' | ');
        const translatedBubbles: Bubble[] = [];

        for (let i = 0; i < bubbles.length; i++) {
            const bubble = bubbles[i];
            const progress = 30 + (i / bubbles.length) * 20;

            try {
                const result = await translateText({
                    text: bubble.originalText,
                    sourceLanguage,
                    targetLanguage,
                    style: translationStyle,
                    context: allOriginalText,
                });

                translatedBubbles.push({
                    ...bubble,
                    translatedText: result.finalTranslation,
                });
            } catch (error) {
                console.warn(`  ⚠️ Translation failed for bubble ${i}:`, error);
                translatedBubbles.push({
                    ...bubble,
                    translatedText: bubble.originalText, // Fallback to original
                });
            }

            await reportProgress(
                job, pageId, projectId, PageStatus.TRANSLATING,
                Math.round(progress),
                `Translated ${i + 1}/${bubbles.length} bubbles`
            );
        }

        // ── Step 4: Proofreading ───────────────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.PROOFREADING, 55, 'Proofreading translations...');

        for (let i = 0; i < translatedBubbles.length; i++) {
            const bubble = translatedBubbles[i];
            try {
                bubble.proofreadText = await proofreadText(
                    bubble.originalText,
                    bubble.translatedText,
                    targetLanguage
                );
            } catch {
                bubble.proofreadText = bubble.translatedText;
            }
        }

        await reportProgress(job, pageId, projectId, PageStatus.PROOFREADING, 65, 'Proofreading complete');

        // ── Step 5: Inpainting ─────────────────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.INPAINTING, 70, 'Removing original text...');

        const regions = translatedBubbles.map((b) => b.boundingBox);
        const { imageBuffer: inpaintedImage } = await inpaintImage(processedImage, regions);

        // Save inpainted image
        const inpaintedKey = pageStorageKey(projectId, 0, 'inpainted');
        const inpaintedUrl = await uploadFile(inpaintedKey, inpaintedImage);

        await reportProgress(job, pageId, projectId, PageStatus.INPAINTING, 80, 'Text removed successfully');

        // ── Step 6: Typesetting ────────────────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.TYPESETTING, 85, 'Rendering translated text...');

        const typesetImage = await typesetPage(inpaintedImage, translatedBubbles);

        await reportProgress(job, pageId, projectId, PageStatus.TYPESETTING, 90, 'Text rendered');

        // ── Step 7: Final Render ───────────────────────────────────
        await reportProgress(job, pageId, projectId, PageStatus.RENDERING, 92, 'Exporting final image...');

        // Save PNG
        const page = await PageModel.findById(pageId);
        const pageNum = page?.pageNumber || 1;
        const finalKey = pageStorageKey(projectId, pageNum, 'final', 'png');
        const finalUrl = await uploadFile(finalKey, typesetImage, 'image/png');

        // Also save WebP for CDN
        const webpBuffer = await convertToWebP(typesetImage);
        const webpKey = pageStorageKey(projectId, pageNum, 'final', 'webp');
        await uploadFile(webpKey, webpBuffer, 'image/webp');

        // ── Update Database ────────────────────────────────────────
        await PageModel.findByIdAndUpdate(pageId, {
            status: PageStatus.COMPLETED,
            inpaintedUrl,
            finalUrl,
            bubbles: translatedBubbles,
            $push: { processingLog: `✅ Completed – ${translatedBubbles.length} bubbles translated` },
        });

        // Check if all pages in project are done
        const project = await ProjectModel.findById(projectId);
        if (project) {
            project.processedCount += 1;
            if (project.processedCount >= project.pageCount) {
                project.status = ProjectStatus.COMPLETED;
            }
            await project.save();
        }

        await reportProgress(job, pageId, projectId, PageStatus.COMPLETED, 100, 'Page processing complete!');
        console.log(`✅ Page ${pageId} completed successfully`);

    } catch (error: any) {
        console.error(`❌ Page ${pageId} failed:`, error.message);

        await PageModel.findByIdAndUpdate(pageId, {
            status: PageStatus.FAILED,
            error: error.message,
            $push: { processingLog: `❌ FAILED: ${error.message}` },
        });

        await reportProgress(job, pageId, projectId, PageStatus.FAILED, 0, `Failed: ${error.message}`);

        throw error; // Re-throw for BullMQ retry
    }
}

// ── Start Worker ─────────────────────────────────────────────

async function main() {
    console.log('🔧 Starting MangaScans worker...');
    await connectDB();

    const worker = createPageWorker(processPage);

    worker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
        console.error(`❌ Job ${job?.id} failed:`, error.message);
    });

    worker.on('error', (error) => {
        console.error('Worker error:', error);
    });

    console.log('🚀 Worker is ready and listening for jobs');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Shutting down worker...');
        await worker.close();
        process.exit(0);
    });
}

main().catch(console.error);
