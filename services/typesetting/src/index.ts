// ============================================================
// MangaScans — Typesetting Engine
// Renders translated text into manga speech bubbles
// ============================================================

import sharp from 'sharp';
import type { Bubble, BoundingBox } from '@mangascans/shared';

// ── Font Configuration ───────────────────────────────────────

const DEFAULT_FONTS = {
    'CC Wild Words': 'Arial',       // Fallback if custom font not installed
    'Manga Temple': 'Arial',
    'Anime Ace': 'Arial',
    'Komika': 'Arial',
    'Back Issues': 'Arial',
};

// ── Text Fitting Algorithm ───────────────────────────────────

interface TextLayout {
    lines: string[];
    fontSize: number;
    lineHeight: number;
    totalHeight: number;
    maxLineWidth: number;
}

/**
 * Calculate how text should be broken into lines and what font size to use
 * to fit within a bounding box.
 */
function fitTextInBubble(
    text: string,
    bubble: BoundingBox,
    preferredFontSize: number = 16,
    isVertical: boolean = false
): TextLayout {
    const padding = 10; // Padding inside bubble
    const maxWidth = (isVertical ? bubble.height : bubble.width) - padding * 2;
    const maxHeight = (isVertical ? bubble.width : bubble.height) - padding * 2;

    // Try decreasing font sizes until text fits
    for (let fontSize = preferredFontSize; fontSize >= 8; fontSize -= 1) {
        const charWidth = fontSize * 0.55; // Approximate character width
        const lineHeight = fontSize * 1.3;
        const charsPerLine = Math.floor(maxWidth / charWidth);

        if (charsPerLine < 2) continue;

        const lines = wrapText(text, charsPerLine);
        const totalHeight = lines.length * lineHeight;

        if (totalHeight <= maxHeight) {
            return {
                lines,
                fontSize,
                lineHeight,
                totalHeight,
                maxLineWidth: maxWidth,
            };
        }
    }

    // Minimum font size fallback
    const fontSize = 8;
    const charWidth = fontSize * 0.55;
    const lineHeight = fontSize * 1.3;
    const charsPerLine = Math.max(2, Math.floor(maxWidth / charWidth));
    const lines = wrapText(text, charsPerLine);

    return {
        lines,
        fontSize,
        lineHeight,
        totalHeight: lines.length * lineHeight,
        maxLineWidth: maxWidth,
    };
}

/**
 * Smart word-wrap that avoids breaking mid-word.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if (word.length > maxCharsPerLine) {
            // Force-break long words
            if (currentLine) {
                lines.push(currentLine.trim());
                currentLine = '';
            }
            for (let i = 0; i < word.length; i += maxCharsPerLine) {
                const chunk = word.slice(i, i + maxCharsPerLine);
                if (i + maxCharsPerLine < word.length) {
                    lines.push(chunk + '-');
                } else {
                    currentLine = chunk;
                }
            }
        } else if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word;
        }
    }

    if (currentLine.trim()) lines.push(currentLine.trim());

    return lines.length ? lines : [''];
}

// ── SVG Text Renderer ────────────────────────────────────────

/**
 * Create an SVG overlay with text for a single bubble.
 */
function createBubbleTextSVG(
    bubble: Bubble,
    layout: TextLayout
): { svg: Buffer; top: number; left: number } {
    const { boundingBox } = bubble;
    const padding = 10;

    // Calculate centered position
    const textStartY = (boundingBox.height - layout.totalHeight) / 2 + layout.fontSize;

    const textLines = layout.lines
        .map((line, i) => {
            const y = textStartY + i * layout.lineHeight;
            return `<text
        x="${boundingBox.width / 2}"
        y="${y}"
        font-family="Arial, sans-serif"
        font-size="${layout.fontSize}"
        fill="${bubble.textColor || '#000000'}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-weight="${layout.fontSize > 14 ? 'bold' : 'normal'}"
      >${escapeXml(line)}</text>`;
        })
        .join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(boundingBox.width)}" height="${Math.round(boundingBox.height)}">
    ${textLines}
  </svg>`;

    return {
        svg: Buffer.from(svg),
        top: Math.round(boundingBox.y),
        left: Math.round(boundingBox.x),
    };
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ── Main Typesetting Function ────────────────────────────────

/**
 * Render translated text onto an inpainted manga page.
 * Uses SVG overlays composed via Sharp for high quality output.
 */
export async function typesetPage(
    inpaintedImageBuffer: Buffer,
    bubbles: Bubble[]
): Promise<Buffer> {
    if (bubbles.length === 0) return inpaintedImageBuffer;

    const metadata = await sharp(inpaintedImageBuffer).metadata();
    const imgWidth = metadata.width || 1000;
    const imgHeight = metadata.height || 1500;

    // Create text overlays for each bubble
    const overlays = bubbles
        .filter((b) => b.translatedText || b.proofreadText)
        .map((bubble) => {
            const text = bubble.proofreadText || bubble.translatedText;
            const layout = fitTextInBubble(
                text,
                bubble.boundingBox,
                bubble.fontSize,
                bubble.isVertical
            );

            const { svg, top, left } = createBubbleTextSVG(
                { ...bubble, fontSize: layout.fontSize },
                layout
            );

            return {
                input: svg,
                top: Math.max(0, Math.min(top, imgHeight - 1)),
                left: Math.max(0, Math.min(left, imgWidth - 1)),
            };
        });

    if (overlays.length === 0) return inpaintedImageBuffer;

    // Composite all text overlays onto the image
    const result = await sharp(inpaintedImageBuffer)
        .composite(overlays)
        .png({ quality: 95 })
        .toBuffer();

    return result;
}

/**
 * Export as WebP for CDN-ready delivery.
 */
export async function convertToWebP(imageBuffer: Buffer, quality = 85): Promise<Buffer> {
    return sharp(imageBuffer).webp({ quality }).toBuffer();
}

/**
 * Export at a specific resolution.
 */
export async function resizeForExport(
    imageBuffer: Buffer,
    maxWidth: number = 1200
): Promise<Buffer> {
    const metadata = await sharp(imageBuffer).metadata();
    if (metadata.width && metadata.width > maxWidth) {
        return sharp(imageBuffer).resize(maxWidth).png().toBuffer();
    }
    return imageBuffer;
}

export { fitTextInBubble, wrapText, TextLayout };
