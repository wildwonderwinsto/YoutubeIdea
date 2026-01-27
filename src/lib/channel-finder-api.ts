import { SimilarChannel, ChannelAnalysis } from '@/types/channel';
import { getBackendUrl } from './api-config';
import { Video } from '@/types/video';

// Helper to get auth headers with API key
function getAuthHeaders() {
    const customKey = localStorage.getItem('gemini_api_key');
    return customKey ? { 'x-api-key': customKey } : {};
}

// Extract channel ID from various URL formats
export function extractChannelId(url: string): string | null {
    // Handle youtube.com/channel/ID
    const channelMatch = url.match(/youtube\.com\/channel\/([^/?]+)/);
    if (channelMatch) return channelMatch[1];

    // Handle youtube.com/@handle (requires API lookup, but for now returned as handle)
    const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
    if (handleMatch) return `@${handleMatch[1]}`;

    return null; // Return null if invalid
}

// Main function to analyze channel and find similar ones
export async function analyzeChannel(channelIdOrHandle: string): Promise<ChannelAnalysis> {
    const backendUrl = getBackendUrl();
    const headers = getAuthHeaders();

    // 1. Get Target Channel Details
    // If handle, we need to search for it first
    let targetId = channelIdOrHandle;
    if (channelIdOrHandle.startsWith('@')) {
        const searchRes = await fetch(
            `${backendUrl}/api/youtube/search?part=snippet&q=${encodeURIComponent(channelIdOrHandle)}&type=channel&maxResults=1`,
            { headers }
        );
        const searchData = await searchRes.json();
        if (!searchData.items?.length) throw new Error('Channel not found');
        targetId = searchData.items[0].id.channelId;
    }

    // Fetch full details
    const channelRes = await fetch(
        `${backendUrl}/api/youtube/channels?part=snippet,statistics,contentDetails,brandingSettings,topicDetails&id=${targetId}`,
        { headers }
    );
    const channelData = await channelRes.json();
    if (!channelData.items?.length) throw new Error('Channel details not found');

    const targetChannelRaw = channelData.items[0];

    // 2. Fetch Recent Videos for Analysis
    const uploadsPlaylistId = targetChannelRaw.contentDetails.relatedPlaylists.uploads;
    const videosRes = await fetch(
        `${backendUrl}/api/youtube/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10`,
        { headers }
    );
    const videosData = await videosRes.json();

    // Calculate metrics for target
    const targetMetrics = calculateChannelMetrics(targetChannelRaw, videosData.items || []);

    // 3. Extract Keywords (using title/desc + topics)
    const keywords = extractKeywords(targetChannelRaw, videosData.items || []);

    // 4. Search for Similar Channels
    // Search using top 2 keywords + general topic
    const searchQuery = keywords.slice(0, 2).join(' ');
    const similarSearchRes = await fetch(
        `${backendUrl}/api/youtube/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=channel&maxResults=15&relevanceLanguage=en`,
        { headers }
    );
    const similarSearchData = await similarSearchRes.json();

    // Filter out self
    const similarIds = similarSearchData.items
        ?.map((item: any) => item.id.channelId)
        .filter((id: string) => id !== targetId)
        .join(',');

    if (!similarIds) {
        return {
            targetChannel: targetMetrics,
            similarChannels: [],
            keywords
        };
    }

    // 5. Get Details for Similar Channels
    const similarChannelsRes = await fetch(
        `${backendUrl}/api/youtube/channels?part=snippet,statistics,contentDetails&id=${similarIds}`,
        { headers }
    );
    const similarChannelsData = await similarChannelsRes.json();

    // Process similar channels in parallel
    const similarChannels = await Promise.all(
        similarChannelsData.items.map(async (channel: any) => {
            // Fetch recent videos for each similar channel to calculate metrics
            // We limit to 5 videos to save quota
            const uploadsId = channel.contentDetails.relatedPlaylists.uploads;
            const vRes = await fetch(
                `${backendUrl}/api/youtube/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=5`,
                { headers }
            );
            const vData = await vRes.json();

            return calculateChannelMetrics(channel, vData.items || []);
        })
    );

    // Sort by subscriber similarity
    const sortedSimilar = similarChannels.sort((a, b) => {
        const aDiff = Math.abs(a.subscriberCount - targetMetrics.subscriberCount);
        const bDiff = Math.abs(b.subscriberCount - targetMetrics.subscriberCount);
        return aDiff - bDiff;
    });

    return {
        targetChannel: targetMetrics,
        similarChannels: sortedSimilar,
        keywords
    };
}

function calculateChannelMetrics(channelRaw: any, playlistItems: any[]): SimilarChannel {
    const recentVideos = playlistItems.map((item: any) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        publishedAt: new Date(item.contentDetails.videoPublishedAt),
        thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        // PlaylistItems don't have view counts, normally we'd fetch video details
        // For MVP/Quota saving, we'll skip view calculation for now or add a separate fetch
        // TODO: In V2, fetch video statistics for better accuracy
        views: 0
    }));

    // Calculate upload frequency
    let uploadFrequency = 'Unknown';
    if (recentVideos.length >= 2) {
        // Calculate avg days between uploads
        const dates = recentVideos.map((v: any) => v.publishedAt.getTime()).sort((a: number, b: number) => b - a);
        let totalDiff = 0;
        for (let i = 0; i < dates.length - 1; i++) {
            totalDiff += (dates[i] - dates[i + 1]);
        }
        const avgDays = (totalDiff / (dates.length - 1)) / (1000 * 60 * 60 * 24);

        if (avgDays <= 1.5) uploadFrequency = 'Daily';
        else if (avgDays <= 4) uploadFrequency = 'High (2-3/week)';
        else if (avgDays <= 8) uploadFrequency = 'Weekly';
        else if (avgDays <= 15) uploadFrequency = 'Bi-weekly';
        else if (avgDays <= 31) uploadFrequency = 'Monthly';
        else uploadFrequency = 'Irregular';
    }

    // Fallback top video (most recent since we don't have views yet)
    // To get REAL top video, we need to fetch video statistics. 
    // Let's assume the first one is representative for now to save quota.
    const topVideo = recentVideos.length > 0 ? {
        ...recentVideos[0],
        views: 0
    } : null;

    return {
        id: channelRaw.id,
        title: channelRaw.snippet.title,
        handle: channelRaw.snippet.customUrl || '',
        subscriberCount: parseInt(channelRaw.statistics.subscriberCount) || 0,
        videoCount: parseInt(channelRaw.statistics.videoCount) || 0,
        thumbnailUrl: channelRaw.snippet.thumbnails.medium?.url || channelRaw.snippet.thumbnails.default?.url,
        description: channelRaw.snippet.description,
        topics: channelRaw.topicDetails?.topicCategories?.map((t: string) => t.split('/').pop()) || [],
        avgViews: 0, // Placeholder until we fetch video stats
        uploadFrequency,
        topVideo,
        similarityScore: 0 // Will be calc relative to target
    };
}

function extractKeywords(channel: any, videos: any[]): string[] {
    const keywords = new Set<string>();

    // From channel title
    keywords.add(channel.snippet.title);

    // From categories
    if (channel.topicDetails?.topicCategories) {
        channel.topicDetails.topicCategories.forEach((url: string) => {
            const topic = url.split('/').pop();
            if (topic) keywords.add(topic.replace(/_/g, ' '));
        });
    }

    // From video titles (simple frequency analysis)
    const words: Record<string, number> = {};
    videos.forEach((v: any) => {
        const titleWords = v.snippet.title.toLowerCase().split(/\W+/);
        titleWords.forEach((w: string) => {
            if (w.length > 3 && !['video', 'vlog', '2024', '2025'].includes(w)) {
                words[w] = (words[w] || 0) + 1;
            }
        });
    });

    // Sort words by freq
    const sortedWords = Object.entries(words)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w);

    sortedWords.forEach(w => keywords.add(w));

    return Array.from(keywords).slice(0, 5);
}
