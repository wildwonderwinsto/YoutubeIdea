import { Video } from '@/types/video';
import { getGeminiApiKey } from './api-config';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

/**
 * Call Gemini API with a prompt
 */
async function callGeminiAPI(prompt: string, enableSearch: boolean = false): Promise<string> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('Gemini API key not configured. Please set it in Settings or in your .env file.');
    }

    const requestBody: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
        },
    };

    if (enableSearch) {
        requestBody.tools = [{ googleSearch: {} }];
    }

    try {
        const response = await fetch(
            `${GEMINI_BASE_URL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('RATE_LIMIT');
            }
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || response.statusText;
            throw new Error(`Gemini API error (${response.status}): ${errorMessage}`);
        }

        const data: GeminiResponse = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
    }
}

/**
 * Infer niche from channel metadata
 */
export async function inferNicheFromMetadata(channelName: string, recentVideos: { title: string, description?: string }[]): Promise<string> {
    const videoContext = recentVideos.map(v => `- Title: ${v.title}`).join('\n');

    const prompt = `Analyze this YouTube channel: "${channelName}"
    
Recent Video Titles:
${videoContext}

Infer the primary content niche in 2-4 words (e.g., "Fortnite montages", "Cooking tutorials", "Tech reviews").
Respond with ONLY the niche name.`;

    try {
        const niche = await callGeminiAPI(prompt, false); // No search needed, we have context
        return niche;
    } catch (error) {
        throw error;
    }
}

/**
 * Generate "Next Video Idea" recommendation based on trending videos
 */
export async function generateNextVideoIdea(topVideos: Video[]): Promise<string> {
    const videoSummaries = topVideos.slice(0, 3).map(v => {
        const hoursAgo = Math.round((Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60));
        return `- "${v.title}" (${v.views.toLocaleString()} views, ${v.subscriberCount.toLocaleString()} subs, uploaded ${hoursAgo}h ago)`;
    }).join('\n');

    const prompt = `You are a YouTube strategy expert. Based on these trending videos:

${videoSummaries}

Generate a single, actionable "Next Video Idea" recommendation for a creator in this niche.

Format:
"Post a [format] about [trending theme] similar to [specific video reference]. Focus on [key element]."

Keep it under 40 words. Be specific and actionable.`;

    try {
        const idea = await callGeminiAPI(prompt, false);
        return idea;
    } catch (error) {
        console.warn('Could not generate video idea:', error);
        return 'Create content similar to the top-ranked videos, focusing on recent trends and high-engagement topics in your niche.';
    }
}

/**
 * Generate "Why It Works" explanation for a video
 */
export async function generateWhyItWorksExplanation(video: Video): Promise<string> {
    const hoursAgo = Math.round((Date.now() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60));

    const prompt = `Analyze why this YouTube video succeeded:
Title: "${video.title}"
Views: ${video.views.toLocaleString()}
Subscriber Count: ${video.subscriberCount.toLocaleString()}
Upload Time: ${hoursAgo} hours ago
Engagement: ${video.likes.toLocaleString()} likes, ${video.comments.toLocaleString()} comments

Provide a 3-bullet explanation of success factors. Each bullet should be one short sentence.

Format:
• [reason 1]
• [reason 2]
• [reason 3]`;

    try {
        const explanation = await callGeminiAPI(prompt, false);
        return explanation;
    } catch (error) {
        console.warn('Could not generate explanation:', error);
        return `• High engagement rate (${(video.engagementRate * 100).toFixed(1)}%)\n• Posted recently (${hoursAgo}h ago)\n• Strong viral score (${video.viralScore.toFixed(0)}/100)`;
    }
}

/**
 * Check if niche violates content safety guidelines
 */
export async function checkContentSafety(niche: string): Promise<{ safe: boolean; reason?: string }> {
    const blockedKeywords = [
        'nsfw', 'porn', 'adult', 'sex', 'xxx',
        'hate', 'racist', 'nazi', 'extremist',
        'self-harm', 'suicide', 'cutting',
        'dangerous challenge', 'tide pod',
        'get rich quick', 'forex scam',
    ];

    const lowerNiche = niche.toLowerCase();
    for (const keyword of blockedKeywords) {
        if (lowerNiche.includes(keyword)) {
            return {
                safe: false,
                reason: "This tool doesn't support this type of content. Try another niche that follows YouTube/TikTok community guidelines.",
            };
        }
    }

    return { safe: true };
}

