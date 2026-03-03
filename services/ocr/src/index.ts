// ============================================================
// MangaScans — OCR Service
// Extracts text from manga pages with bounding box coordinates
// ============================================================

import type { Bubble, BoundingBox } from '@mangascans/shared';
import { v4 } from 'crypto';

// ── Types ────────────────────────────────────────────────────

interface OcrResult {
    text: string;
    boundingBox: BoundingBox;
    confidence: number;
    isVertical: boolean;
}

interface OcrProvider {
    name: string;
    detect(imageBuffer: Buffer): Promise<OcrResult[]>;
}

// ── Google Vision OCR Provider ───────────────────────────────

class GoogleVisionProvider implements OcrProvider {
    name = 'google-vision';

    async detect(imageBuffer: Buffer): Promise<OcrResult[]> {
        const apiKey = process.env.GOOGLE_VISION_API_KEY;
        if (!apiKey) throw new Error('GOOGLE_VISION_API_KEY not set');

        const base64Image = imageBuffer.toString('base64');

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: { content: base64Image },
                        features: [{ type: 'TEXT_DETECTION', maxResults: 100 }],
                        imageContext: {
                            languageHints: ['ja', 'ko', 'zh'],
                        },
                    }],
                }),
            }
        );

        const data = await response.json();
        const annotations = data.responses?.[0]?.textAnnotations || [];

        // Skip the first annotation (full page text)
        return annotations.slice(1).map((ann: any) => {
            const vertices = ann.boundingPoly?.vertices || [];
            const xs = vertices.map((v: any) => v.x || 0);
            const ys = vertices.map((v: any) => v.y || 0);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);

            const width = maxX - minX;
            const height = maxY - minY;

            return {
                text: ann.description || '',
                boundingBox: { x: minX, y: minY, width, height },
                confidence: 0.9,
                isVertical: height > width * 2, // Heuristic for vertical text
            };
        });
    }
}

// ── Mock OCR Provider (for development) ──────────────────────

class MockOcrProvider implements OcrProvider {
    name = 'mock';

    async detect(_imageBuffer: Buffer): Promise<OcrResult[]> {
        // Simulate detecting text regions
        return [
            {
                text: 'こんにちは、世界！',
                boundingBox: { x: 100, y: 80, width: 200, height: 120 },
                confidence: 0.95,
                isVertical: false,
            },
            {
                text: 'ありがとう',
                boundingBox: { x: 400, y: 300, width: 150, height: 100 },
                confidence: 0.88,
                isVertical: false,
            },
            {
                text: '何をしている？',
                boundingBox: { x: 50, y: 500, width: 180, height: 90 },
                confidence: 0.92,
                isVertical: true,
            },
        ];
    }
}

// ── OCR Service ──────────────────────────────────────────────

function getProvider(): OcrProvider {
    if (process.env.GOOGLE_VISION_API_KEY) {
        return new GoogleVisionProvider();
    }
    console.warn('⚠️ No OCR API key found, using mock provider');
    return new MockOcrProvider();
}

/**
 * Merge nearby text detections into logical bubble groups.
 */
function mergeNearbyRegions(results: OcrResult[], threshold = 30): OcrResult[] {
    if (results.length === 0) return [];

    const merged: OcrResult[] = [];
    const used = new Set<number>();

    for (let i = 0; i < results.length; i++) {
        if (used.has(i)) continue;

        let group = { ...results[i] };
        used.add(i);

        for (let j = i + 1; j < results.length; j++) {
            if (used.has(j)) continue;

            const a = group.boundingBox;
            const b = results[j].boundingBox;

            // Check if b is close to the current group
            const horizontalOverlap = Math.abs(a.x - b.x) < a.width + threshold;
            const verticalOverlap = Math.abs(a.y - b.y) < a.height + threshold;

            if (horizontalOverlap && verticalOverlap) {
                // Merge bounding boxes
                const minX = Math.min(a.x, b.x);
                const minY = Math.min(a.y, b.y);
                const maxX = Math.max(a.x + a.width, b.x + b.width);
                const maxY = Math.max(a.y + a.height, b.y + b.height);

                group.boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                group.text += '\n' + results[j].text;
                group.confidence = Math.min(group.confidence, results[j].confidence);
                used.add(j);
            }
        }

        merged.push(group);
    }

    return merged;
}

/**
 * Run OCR on an image buffer.
 * Returns an array of detected text bubbles.
 */
export async function runOCR(imageBuffer: Buffer): Promise<Bubble[]> {
    const provider = getProvider();
    console.log(`🔍 Running OCR with ${provider.name}...`);

    const rawResults = await provider.detect(imageBuffer);
    const merged = mergeNearbyRegions(rawResults);

    return merged.map((result, index) => ({
        id: `bubble-${Date.now()}-${index}`,
        boundingBox: result.boundingBox,
        originalText: result.text,
        translatedText: '',
        proofreadText: '',
        fontSize: 16,
        fontFamily: 'CC Wild Words',
        textColor: '#000000',
        isVertical: result.isVertical,
        confidence: result.confidence,
    }));
}

export { OcrResult, OcrProvider };
