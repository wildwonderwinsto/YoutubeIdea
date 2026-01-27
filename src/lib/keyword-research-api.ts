import { getBackendUrl } from './api-config';

export interface KeywordAnalysis {
    keyword: string;
    viralPotential: number; // 0-100
    saturation: 'Low' | 'Medium' | 'High';
    reasoning: string;
}

// Helper to get auth headers with API key
function getAuthHeaders() {
    const customKey = localStorage.getItem('gemini_api_key');
    return customKey ? { 'x-api-key': customKey } : {};
}

export async function generateKeywords(baseTopic: string): Promise<string[]> {
    const backendUrl = getBackendUrl();
    const keywords = new Set<string>();

    // Seed variations (free - no API calls)
    const seedVariations = [
        baseTopic,
        `${baseTopic} tutorial`,
        `${baseTopic} tips`,
        `${baseTopic} guide`,
        `how to ${baseTopic}`,
        `best ${baseTopic}`
    ];

    // Fetch autocomplete for each seed
    // We limit parallel requests to avoid overwhelming the proxy/YouTube
    for (const seed of seedVariations) {
        try {
            const response = await fetch(
                `${backendUrl}/api/youtube/autocomplete?q=${encodeURIComponent(seed)}`
            );
            const data = await response.json();
            if (data.suggestions) {
                data.suggestions.forEach((s: string) => keywords.add(s));
            }
        } catch (e) {
            console.warn(`Autocomplete failed for seed: ${seed}`, e);
        }
    }

    return Array.from(keywords).slice(0, 50); // Limit to 50 keywords
}

export async function analyzeKeywords(
    keywords: string[]
): Promise<KeywordAnalysis[]> {
    const backendUrl = getBackendUrl();
    const headers = getAuthHeaders();

    // Process in batches of 20 to avoid token limits
    // Taking the top 20 keywords only for analysis to be safe with quota
    const topKeywords = keywords.slice(0, 20);

    const prompt = `Analyze these YouTube search keywords for viral potential:

${topKeywords.map((k, idx) => `${idx + 1}. ${k}`).join('\n')}

For each keyword, rate:
- Viral Potential (0-100): How likely is this to trend?
- Saturation: Low/Medium/High (how competitive is this?)
- Reasoning: One short sentence why

Respond ONLY in valid JSON format matching this schema:
[
  {
    "keyword": "string",
    "viralPotential": number,
    "saturation": "Low" | "Medium" | "High",
    "reasoning": "string"
  }
]
Do not include markdown formatting or backticks.`;

    try {
        const response = await fetch(`${backendUrl}/api/gemini/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error('Gemini analysis failed');

        const data = await response.json();
        // Clean up response if it contains markdown code blocks
        const text = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error('Keyword analysis failed:', error);
        // Fallback: return keywords without analysis
        return topKeywords.map(k => ({
            keyword: k,
            viralPotential: 50,
            saturation: 'Medium',
            reasoning: 'Analysis unavailable'
        }));
    }
}

export function generateTags(keyword: string): string[] {
    const words = keyword.toLowerCase().split(' ');
    const tags = [keyword]; // Full keyword always included

    // Add subsets
    if (words.length > 2) {
        tags.push(words.slice(0, 2).join(' '));
        tags.push(words.slice(1).join(' '));
    }

    // Add related terms
    const relatedTerms: Record<string, string[]> = {
        'tutorial': ['guide', 'how to', 'tips'],
        'gaming': ['gameplay', 'playthrough', 'walkthrough'],
        'review': ['unboxing', 'first look', 'hands on'],
        'tips': ['tricks', 'hacks', 'guide'],
        'guide': ['tutorial', 'walkthrough', 'basics']
    };

    words.forEach(word => {
        if (relatedTerms[word]) {
            tags.push(...relatedTerms[word]);
        }
    });

    return [...new Set(tags)].slice(0, 15); // YouTube allows up to 500 chars (approx 15 tags)
}
