// ============================================================
// MangaScans — Translation Service
// Multi-step AI translation with caching and provider fallback
// ============================================================

import {
    TranslationStyle, TargetLanguage,
    cacheTranslation, getCachedTranslation,
} from '@mangascans/shared';

// ── Types ────────────────────────────────────────────────────

interface TranslationRequest {
    text: string;
    sourceLanguage: string;
    targetLanguage: TargetLanguage;
    style: TranslationStyle;
    context?: string; // surrounding dialogue for context
}

interface TranslationResult {
    directTranslation: string;
    contextAwareTranslation: string;
    finalTranslation: string;
    provider: string;
}

// ── Provider Abstraction ─────────────────────────────────────

interface TranslationProvider {
    name: string;
    translate(text: string, from: string, to: string, systemPrompt?: string): Promise<string>;
}

// ── OpenAI Provider ──────────────────────────────────────────

class OpenAIProvider implements TranslationProvider {
    name = 'openai';

    async translate(text: string, from: string, to: string, systemPrompt?: string): Promise<string> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not set');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt || `You are a professional manga translator. Translate from ${from} to ${to}. Provide only the translation, nothing else.`,
                    },
                    { role: 'user', content: text },
                ],
                temperature: 0.3,
                max_tokens: 1000,
            }),
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || text;
    }
}

// ── DeepL Provider ───────────────────────────────────────────

class DeepLProvider implements TranslationProvider {
    name = 'deepl';

    private langMap: Record<string, string> = {
        en: 'EN', ja: 'JA', ko: 'KO', zh: 'ZH', es: 'ES',
        fr: 'FR', de: 'DE', pt: 'PT-BR', ru: 'RU',
    };

    async translate(text: string, from: string, to: string): Promise<string> {
        const apiKey = process.env.DEEPL_API_KEY;
        if (!apiKey) throw new Error('DEEPL_API_KEY not set');

        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
            },
            body: JSON.stringify({
                text: [text],
                source_lang: this.langMap[from] || from.toUpperCase(),
                target_lang: this.langMap[to] || to.toUpperCase(),
            }),
        });

        const data = await response.json();
        return data.translations?.[0]?.text || text;
    }
}

// ── Mock Provider ────────────────────────────────────────────

class MockTranslationProvider implements TranslationProvider {
    name = 'mock';

    private mockTranslations: Record<string, string> = {
        'こんにちは、世界！': 'Hello, world!',
        'ありがとう': 'Thank you!',
        '何をしている？': 'What are you doing?',
    };

    async translate(text: string): Promise<string> {
        return this.mockTranslations[text] || `[Translated] ${text}`;
    }
}

// ── Provider Selection ───────────────────────────────────────

function getDirectProvider(): TranslationProvider {
    if (process.env.DEEPL_API_KEY) return new DeepLProvider();
    if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
    console.warn('⚠️ No translation API key found, using mock provider');
    return new MockTranslationProvider();
}

function getRefinementProvider(): TranslationProvider {
    if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
    return new MockTranslationProvider();
}

// ── Style Prompts ────────────────────────────────────────────

const STYLE_PROMPTS: Record<TranslationStyle, string> = {
    [TranslationStyle.FORMAL]: 'Use formal, polite language. Avoid slang and contractions.',
    [TranslationStyle.CASUAL]: 'Use casual, everyday language. Contractions and slang are fine.',
    [TranslationStyle.DRAMATIC]: 'Use dramatic, intense language fitting for action or emotional scenes.',
    [TranslationStyle.NEUTRAL]: 'Use natural, standard English suitable for general manga dialogue.',
};

// ── Multi-Step Translation Pipeline ──────────────────────────

/**
 * Translate text through a multi-step pipeline:
 * 1. Direct translation (DeepL or GPT-4o)
 * 2. Context-aware rewrite (GPT-4o)
 * 3. Tone/style correction (GPT-4o)
 */
export async function translateText(req: TranslationRequest): Promise<TranslationResult> {
    const { text, sourceLanguage, targetLanguage, style, context } = req;

    // Check cache first
    const cacheKey = `${targetLanguage}:${style}`;
    const cached = await getCachedTranslation(text, cacheKey).catch(() => null);
    if (cached) {
        return {
            directTranslation: cached,
            contextAwareTranslation: cached,
            finalTranslation: cached,
            provider: 'cache',
        };
    }

    const directProvider = getDirectProvider();
    const refinementProvider = getRefinementProvider();

    // Step 1: Direct translation
    console.log(`📝 Step 1: Direct translation via ${directProvider.name}`);
    const directTranslation = await directProvider.translate(text, sourceLanguage, targetLanguage);

    // Step 2: Context-aware rewrite
    let contextAwareTranslation = directTranslation;
    if (refinementProvider.name !== 'mock') {
        console.log(`📝 Step 2: Context-aware rewrite`);
        const contextPrompt = `You are a manga translation editor. Refine this translation for a manga speech bubble.
Original (${sourceLanguage}): ${text}
Direct translation: ${directTranslation}
${context ? `Context (surrounding dialogue): ${context}` : ''}

Rewrite the translation to sound natural in a manga context. Keep it concise — this needs to fit in a speech bubble.
Provide only the refined translation, nothing else.`;

        contextAwareTranslation = await refinementProvider.translate(
            contextPrompt, sourceLanguage, targetLanguage,
            'You are a manga translation editor. Provide only the refined translation.'
        );
    }

    // Step 3: Style/tone correction
    let finalTranslation = contextAwareTranslation;
    if (refinementProvider.name !== 'mock' && style !== TranslationStyle.NEUTRAL) {
        console.log(`📝 Step 3: Style correction (${style})`);
        const stylePrompt = `Adjust this manga dialogue to ${style} style. ${STYLE_PROMPTS[style]}
Text: ${contextAwareTranslation}
Provide only the adjusted text.`;

        finalTranslation = await refinementProvider.translate(
            stylePrompt, targetLanguage, targetLanguage,
            `You are a manga dialogue stylist. ${STYLE_PROMPTS[style]}`
        );
    }

    // Cache the result
    await cacheTranslation(text, cacheKey, finalTranslation).catch(() => { });

    return {
        directTranslation,
        contextAwareTranslation,
        finalTranslation,
        provider: directProvider.name,
    };
}

/**
 * Proofread translated text using AI.
 */
export async function proofreadText(
    originalText: string,
    translatedText: string,
    targetLanguage: string
): Promise<string> {
    const provider = getRefinementProvider();
    if (provider.name === 'mock') return translatedText;

    const prompt = `Proofread this manga translation. Fix grammar, make dialogue sound natural, and ensure it fits in a speech bubble (concise).
Original: ${originalText}
Translation: ${translatedText}

Return ONLY the corrected text.`;

    return provider.translate(
        prompt, targetLanguage, targetLanguage,
        'You are a professional manga translation proofreader. Return only the proofread text.'
    );
}

/**
 * Batch translate multiple text segments.
 */
export async function translateBatch(
    texts: string[],
    sourceLanguage: string,
    targetLanguage: TargetLanguage,
    style: TranslationStyle
): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];

    // Build context from all texts for context-aware translation
    const fullContext = texts.join(' | ');

    for (let i = 0; i < texts.length; i++) {
        const result = await translateText({
            text: texts[i],
            sourceLanguage,
            targetLanguage,
            style,
            context: fullContext,
        });
        results.push(result);

        // Rate limit between calls
        if (i < texts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    return results;
}
