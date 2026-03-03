// ============================================================
// MangaScans — Inpainting Service
// Removes text from manga pages and repairs artwork
// ============================================================

import sharp from 'sharp';
import type { BoundingBox } from '@mangascans/shared';

// ── Types ────────────────────────────────────────────────────

interface InpaintingResult {
    imageBuffer: Buffer;
    provider: string;
}

// ── Replicate API Provider ───────────────────────────────────

async function inpaintWithReplicate(
    imageBuffer: Buffer,
    maskBuffer: Buffer
): Promise<Buffer> {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) throw new Error('REPLICATE_API_TOKEN not set');

    const base64Image = imageBuffer.toString('base64');
    const base64Mask = maskBuffer.toString('base64');

    // Start prediction
    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
            version: 'e490d072a34a94a11e9711ed5a6ba621c3fab884eda1665d9d3a282d65a21f2d', // SD inpainting
            input: {
                image: `data:image/png;base64,${base64Image}`,
                mask: `data:image/png;base64,${base64Mask}`,
                prompt: 'clean manga background, no text, seamless artwork continuation',
                negative_prompt: 'text, letters, words, characters, writing',
                guidance_scale: 7.5,
                num_inference_steps: 25,
            },
        }),
    });

    const prediction = await response.json();

    // Poll for completion
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
            headers: { 'Authorization': `Bearer ${apiToken}` },
        });
        result = await pollResponse.json();
    }

    if (result.status === 'failed') throw new Error('Replicate inpainting failed');

    // Download the result image
    const imageResponse = await fetch(result.output[0]);
    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// ── Sharp-based Local Inpainting (Fallback) ──────────────────

async function inpaintWithSharp(
    imageBuffer: Buffer,
    regions: BoundingBox[]
): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);
    const metadata = await pipeline.metadata();
    const imgWidth = metadata.width || 1000;
    const imgHeight = metadata.height || 1500;

    // Create white overlay rectangles for each text region
    // This is a simple approach — fills text regions with white (for white bubbles)
    // For production, you'd sample the surrounding color
    const overlays = regions.map((region) => {
        // Add padding around the text region
        const pad = 4;
        const x = Math.max(0, region.x - pad);
        const y = Math.max(0, region.y - pad);
        const w = Math.min(region.width + pad * 2, imgWidth - x);
        const h = Math.min(region.height + pad * 2, imgHeight - y);

        return {
            input: {
                create: {
                    width: Math.round(w),
                    height: Math.round(h),
                    channels: 4 as const,
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                },
            },
            top: Math.round(y),
            left: Math.round(x),
        };
    });

    const result = await sharp(imageBuffer)
        .composite(overlays)
        .png()
        .toBuffer();

    return result;
}

// ── Create Mask from Bounding Boxes ──────────────────────────

async function createMask(
    imageBuffer: Buffer,
    regions: BoundingBox[]
): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1500;

    // Start with black canvas
    const overlays = regions.map((region) => {
        const pad = 8;
        return {
            input: {
                create: {
                    width: Math.round(Math.min(region.width + pad * 2, width)),
                    height: Math.round(Math.min(region.height + pad * 2, height)),
                    channels: 3 as const,
                    background: { r: 255, g: 255, b: 255 },
                },
            },
            top: Math.round(Math.max(0, region.y - pad)),
            left: Math.round(Math.max(0, region.x - pad)),
        };
    });

    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
        },
    })
        .composite(overlays)
        .png()
        .toBuffer();
}

// ── Main Inpainting Function ─────────────────────────────────

/**
 * Remove text from manga page at specified regions.
 * Uses Replicate API if available, falls back to Sharp-based white fill.
 */
export async function inpaintImage(
    imageBuffer: Buffer,
    regions: BoundingBox[]
): Promise<InpaintingResult> {
    if (regions.length === 0) {
        return { imageBuffer, provider: 'none' };
    }

    // Try Replicate first
    if (process.env.REPLICATE_API_TOKEN) {
        try {
            console.log('🎨 Inpainting via Replicate...');
            const mask = await createMask(imageBuffer, regions);
            const result = await inpaintWithReplicate(imageBuffer, mask);
            return { imageBuffer: result, provider: 'replicate' };
        } catch (error) {
            console.warn('⚠️ Replicate inpainting failed, falling back to Sharp:', error);
        }
    }

    // Fallback: Sharp-based fill
    console.log('🎨 Inpainting via Sharp (local fallback)...');
    const result = await inpaintWithSharp(imageBuffer, regions);
    return { imageBuffer: result, provider: 'sharp' };
}

export { createMask };
