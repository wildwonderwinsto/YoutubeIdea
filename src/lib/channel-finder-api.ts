import { SimilarChannel, ChannelAnalysis } from '@/types/channel';
import { getBackendUrl, getAuthHeaders } from './api-config';

export function extractChannelId(url: string): string | null {
    const channelMatch = url.match(/youtube\.com\/channel\/([^/?]+)/);
    if (channelMatch) return channelMatch[1];

    const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
    if (handleMatch) return `@${handleMatch[1]}`;

    const cMatch = url.match(/youtube\.com\/c\/([^/?]+)/);
    if (cMatch) return cMatch[1];

    return null;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok || response.status === 404) return response;
            if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } catch (error) {
            if (i === retries - 1) throw error;
        }
    }
    throw new Error('Max retries exceeded');
}

export async function analyzeChannel(channelIdOrHandle: string): Promise<ChannelAnalysis> {
    const backendUrl = getBackendUrl();
    // Headers cast to avoid TS error
    const headers = getAuthHeaders() as Record<string, string>;

    // Step 1: Resolve channel ID
    let targetId = channelIdOrHandle;
    if (channelIdOrHandle.startsWith('@') || !channelIdOrHandle.startsWith('UC')) {
        const handle = channelIdOrHandle.replace('@', '');
        const searchRes = await fetchWithRetry(
            `${backendUrl}/api/youtube/channels?part=snippet,statistics,contentDetails&forHandle=${handle}`,
            { headers }
        );

        if (!searchRes.ok) {
            // Try search as fallback
            const searchRes2 = await fetchWithRetry(
                `${backendUrl}/api/youtube/search?part=snippet&q=${encodeURIComponent(channelIdOrHandle)}&type=channel&maxResults=1`,
                { headers }
            );
            const searchData = await searchRes2.json();
            if (!searchData.items?.length) throw new Error('Channel not found');
            targetId = searchData.items[0].id.channelId;
        } else {
            const data = await searchRes.json();
            if (!data.items?.length) throw new Error('Channel not found');
            targetId = data.items[0].id;
        }
    }

    // Step 2: Get full channel details
    const channelRes = await fetchWithRetry(
        `${backendUrl}/api/youtube/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${targetId}`,
        { headers }
    );
    const channelData = await channelRes.json();
    if (!channelData.items?.length) throw new Error('Channel details not found');

    const targetChannel = channelData.items[0];

    // Step 3: Get recent videos for target channel
    const uploadsPlaylistId = targetChannel.contentDetails.relatedPlaylists.uploads;
    const playlistRes = await fetchWithRetry(
        `${backendUrl}/api/youtube/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=20`,
        { headers }
    );
    const playlistData = await playlistRes.json();
    const recentVideoIds = playlistData.items?.map((item: any) => item.contentDetails.videoId).join(',') || '';

    // Step 4: Get video statistics for target channel
    let targetVideos: any[] = [];
    if (recentVideoIds) {
        const videoStatsRes = await fetchWithRetry(
            `${backendUrl}/api/youtube/videos?part=statistics,contentDetails&id=${recentVideoIds}`,
            { headers }
        );
        const videoStatsData = await videoStatsRes.json();
        targetVideos = videoStatsData.items || [];
    }

    // Calculate target channel metrics
    const targetMetrics = await calculateDetailedMetrics(
        targetChannel,
        playlistData.items || [],
        targetVideos
    );

    // Step 5: Extract keywords using AI
    const keywords = await extractKeywordsWithAI(targetChannel, playlistData.items || []);

    // Step 6: Find similar channels
    const searchQuery = keywords.slice(0, 3).join(' ');
    const similarSearchRes = await fetchWithRetry(
        `${backendUrl}/api/youtube/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=channel&maxResults=20`,
        { headers }
    );
    const similarSearchData = await similarSearchRes.json();

    const similarIds = similarSearchData.items
        ?.map((item: any) => item.id.channelId)
        .filter((id: string) => id !== targetId)
        .slice(0, 12)
        .join(',');

    if (!similarIds) {
        return { targetChannel: targetMetrics, similarChannels: [], keywords };
    }

    // Step 7: Get detailed stats for similar channels
    const similarChannelsRes = await fetchWithRetry(
        `${backendUrl}/api/youtube/channels?part=snippet,statistics,contentDetails&id=${similarIds}`,
        { headers }
    );
    const similarChannelsData = await similarChannelsRes.json();

    // Process each similar channel
    const similarChannels = await Promise.all(
        (similarChannelsData.items || []).map(async (channel: any) => {
            const uploadsId = channel.contentDetails.relatedPlaylists.uploads;
            const vRes = await fetchWithRetry(
                `${backendUrl}/api/youtube/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=10`,
                { headers }
            );
            const vData = await vRes.json();

            const videoIds = vData.items?.map((item: any) => item.contentDetails.videoId).join(',') || '';
            let videos: any[] = [];

            if (videoIds) {
                const vStatsRes = await fetchWithRetry(
                    `${backendUrl}/api/youtube/videos?part=statistics&id=${videoIds}`,
                    { headers }
                );
                const vStatsData = await vStatsRes.json();
                videos = vStatsData.items || [];
            }

            return calculateDetailedMetrics(channel, vData.items || [], videos);
        })
    );

    // Calculate similarity scores
    const scoredChannels = similarChannels.map(channel => ({
        ...channel,
        similarityScore: calculateSimilarityScore(targetMetrics, channel)
    }));

    // Sort by similarity score
    scoredChannels.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
        targetChannel: targetMetrics,
        similarChannels: scoredChannels,
        keywords
    };
}

async function calculateDetailedMetrics(
    channelRaw: any,
    playlistItems: any[],
    videoStats: any[]
): Promise<SimilarChannel> {
    // Calculate upload frequency
    let uploadFrequency = 'Unknown';
    if (playlistItems.length >= 2) {
        const dates = playlistItems
            .map((item: any) => new Date(item.contentDetails.videoPublishedAt || item.snippet.publishedAt).getTime())
            .sort((a: number, b: number) => b - a);

        let totalDiff = 0;
        for (let i = 0; i < dates.length - 1; i++) {
            totalDiff += (dates[i] - dates[i + 1]);
        }
        const avgDays = (totalDiff / (dates.length - 1)) / (1000 * 60 * 60 * 24);

        if (avgDays <= 1.5) uploadFrequency = 'Daily';
        else if (avgDays <= 4) uploadFrequency = '2-3x per week';
        else if (avgDays <= 8) uploadFrequency = 'Weekly';
        else if (avgDays <= 15) uploadFrequency = 'Bi-weekly';
        else if (avgDays <= 31) uploadFrequency = 'Monthly';
        else uploadFrequency = 'Irregular';
    }

    // Calculate average views
    const totalViews = videoStats.reduce((sum: number, video: any) => {
        return sum + parseInt(video.statistics.viewCount || '0');
    }, 0);
    const avgViews = videoStats.length > 0 ? Math.round(totalViews / videoStats.length) : 0;

    // Find top video
    let topVideo = null;
    if (playlistItems.length > 0 && videoStats.length > 0) {
        const topVideoData = videoStats.reduce((max: any, video: any) => {
            const views = parseInt(video.statistics.viewCount || '0');
            return views > parseInt(max.statistics.viewCount || '0') ? video : max;
        });

        const topVideoItem = playlistItems.find(
            (item: any) => item.contentDetails.videoId === topVideoData.id
        );

        if (topVideoItem) {
            topVideo = {
                id: topVideoData.id,
                title: topVideoItem.snippet.title,
                publishedAt: new Date(topVideoItem.contentDetails.videoPublishedAt || topVideoItem.snippet.publishedAt).toISOString(),
                thumbnailUrl: topVideoItem.snippet.thumbnails.medium?.url || topVideoItem.snippet.thumbnails.default?.url,
                views: parseInt(topVideoData.statistics.viewCount || '0')
            };
        }
    }

    return {
        id: channelRaw.id,
        title: channelRaw.snippet.title,
        handle: channelRaw.snippet.customUrl || '',
        subscriberCount: parseInt(channelRaw.statistics.subscriberCount) || 0,
        videoCount: parseInt(channelRaw.statistics.videoCount) || 0,
        thumbnailUrl: channelRaw.snippet.thumbnails.medium?.url || channelRaw.snippet.thumbnails.default?.url,
        description: channelRaw.snippet.description || '',
        topics: [],
        avgViews,
        uploadFrequency,
        topVideo,
        similarityScore: 0
    };
}

async function extractKeywordsWithAI(channel: any, videos: any[]): Promise<string[]> {
    const backendUrl = getBackendUrl();
    const headers = getAuthHeaders() as Record<string, string>;

    const videoTitles = videos.slice(0, 10).map((v: any) => v.snippet.title).join('\n- ');
    const prompt = `Extract 5-7 core topic keywords from this YouTube channel:

Channel: ${channel.snippet.title}
Description: ${channel.snippet.description?.slice(0, 200) || 'N/A'}

Recent videos:
- ${videoTitles}

Respond with ONLY a comma-separated list of keywords (no explanations, no formatting).
Example: minecraft, survival, hardcore, challenge, gaming`;

    try {
        const response = await fetch(`${backendUrl}/api/gemini/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error('AI extraction failed');

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text.split(',').map((k: string) => k.trim()).filter(Boolean).slice(0, 7);
    } catch (error) {
        console.error('Keyword extraction failed:', error);
        // Fallback: basic extraction
        const words = new Set<string>();
        videos.forEach((v: any) => {
            v.snippet.title.toLowerCase().split(/\W+/).forEach((word: string) => {
                if (word.length > 3) words.add(word);
            });
        });
        return Array.from(words).slice(0, 5);
    }
}

function calculateSimilarityScore(target: SimilarChannel, candidate: SimilarChannel): number {
    let score = 0;

    // Subscriber similarity (40 points)
    const subRatio = Math.min(target.subscriberCount, candidate.subscriberCount) /
        Math.max(target.subscriberCount, candidate.subscriberCount);
    score += subRatio * 40;

    // Upload frequency match (20 points)
    if (target.uploadFrequency === candidate.uploadFrequency) {
        score += 20;
    } else {
        const frequencies = ['Daily', '2-3x per week', 'Weekly', 'Bi-weekly', 'Monthly', 'Irregular'];
        const targetIdx = frequencies.indexOf(target.uploadFrequency);
        const candidateIdx = frequencies.indexOf(candidate.uploadFrequency);
        if (targetIdx >= 0 && candidateIdx >= 0) {
            const diff = Math.abs(targetIdx - candidateIdx);
            score += Math.max(0, 20 - diff * 5);
        }
    }

    // Average views similarity (25 points)
    if (target.avgViews > 0 && candidate.avgViews > 0) {
        const viewRatio = Math.min(target.avgViews, candidate.avgViews) /
            Math.max(target.avgViews, candidate.avgViews);
        score += viewRatio * 25;
    }

    // Video count similarity (15 points)
    const videoRatio = Math.min(target.videoCount, candidate.videoCount) /
        Math.max(target.videoCount, candidate.videoCount);
    score += videoRatio * 15;

    return Math.round(score);
}
