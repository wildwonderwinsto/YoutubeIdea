import { Video } from '@/types/video';
import { enrichVideo } from './viral-score';
import { getYouTubeApiKey } from './api-config';
import { logger } from './logger';

const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Wealthy regions to aggregate (US, UK, Canada, Australia, Germany)
const TARGET_REGIONS = ['US', 'GB', 'CA', 'AU', 'DE'];

/**
 * Parse ISO 8601 duration to seconds (e.g., "PT1M30S" -> 90)
 */
function parseISO8601Duration(duration: string): number {
    if (!duration || duration === 'P0D') return 0;

    const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const days = parseInt(match[1] || '0');
    const hours = parseInt(match[2] || '0');
    const minutes = parseInt(match[3] || '0');
    const seconds = parseInt(match[4] || '0');

    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetch trending videos by niche/keyword aggregated from wealthy regions
 */
export async function fetchTrendingVideos(niche: string, dateRange: '24h' | '7d' | '30d' = '7d'): Promise<Video[]> {
    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
        throw new Error('YouTube API key not configured. Please set it in Settings or in your .env file.');
    }

    // Calculate publishedAfter date based on filter
    const now = new Date();
    let daysToSubtract = 7;
    if (dateRange === '24h') daysToSubtract = 1;
    if (dateRange === '30d') daysToSubtract = 30;

    const publishedAfter = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000).toISOString();

    try {
        // Step 1: Search for videos in multiple regions in parallel
        const searchPromises = TARGET_REGIONS.map((region: string) =>
            fetch(
                `${YOUTUBE_BASE_URL}/search?` +
                `part=snippet&` +
                `q=${encodeURIComponent(niche)}&` +
                `type=video&` +
                `order=viewCount&` +
                `maxResults=15&` + // Fetch fewer per region to keep total manageable
                `publishedAfter=${publishedAfter}&` +
                `regionCode=${region}&` +
                `key=${apiKey}`
            ).then(async res => {
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const errorMessage = errorData.error?.message || res.statusText || `Status ${res.status}`;

                    // Handle specific API errors like quota exceeded
                    if (errorMessage.includes('quotaExceeded') || res.status === 429) {
                        throw new Error('QUOTA_EXCEEDED');
                    }

                    throw new Error(`YouTube API request failed: ${errorMessage}`);
                }
                const data = await res.json();
                // Tag items with region
                if (data.items) {
                    data.items = data.items.map((item: any) => ({ ...item, region }));
                }
                return data;
            })
        );

        const searchResults = await Promise.all(searchPromises);

        // Aggregate and deduplicate video IDs, keeping track of region
        const videoIdSet = new Set<string>();
        const regionMap = new Map<string, string>(); // videoId -> region

        searchResults.forEach((data: any) => {
            if (data.items) {
                data.items.forEach((item: any) => {
                    if (!videoIdSet.has(item.id.videoId)) {
                        videoIdSet.add(item.id.videoId);
                        regionMap.set(item.id.videoId, item.region);
                    }
                });
            }
        });

        if (videoIdSet.size === 0) {
            return [];
        }

        // Limit to 50 videos max for detailed stats call
        const videoIds = Array.from(videoIdSet).slice(0, 50).join(',');

        // Step 2: Fetch detailed video statistics from the aggregated list
        const statsResponse = await fetch(
            `${YOUTUBE_BASE_URL}/videos?` +
            `part=statistics,snippet,contentDetails&` +
            `id=${videoIds}&` +
            `key=${apiKey}`
        );

        if (!statsResponse.ok) {
            const errorData = await statsResponse.json().catch(() => ({}));
            throw new Error(`YouTube API statistics request failed: ${errorData.error?.message || statsResponse.statusText}`);
        }

        const statsData = await statsResponse.json();

        // Step 3: Fetch channel subscriber counts
        const channelIds = statsData.items.map((item: any) => item.snippet.channelId).join(',');
        const channelResponse = await fetch(
            `${YOUTUBE_BASE_URL}/channels?` +
            `part=statistics&` +
            `id=${channelIds}&` +
            `key=${apiKey}`
        );

        if (!channelResponse.ok) {
            const errorData = await channelResponse.json().catch(() => ({}));
            throw new Error(`YouTube API channel request failed: ${errorData.error?.message || channelResponse.statusText}`);
        }

        const channelData = await channelResponse.json();

        // Step 4: Build channel map for quick lookup
        const channelMap = new Map();
        channelData.items.forEach((channel: any) => {
            channelMap.set(channel.id, parseInt(channel.statistics.subscriberCount || '0'));
        });

        // Step 5: Combine all data into Video objects and enrich them
        const videos: Video[] = statsData.items.map((item: any) => {
            const rawVideo = {
                id: item.id,
                title: item.snippet.title,
                channelId: item.snippet.channelId,
                channelName: item.snippet.channelTitle,
                subscriberCount: channelMap.get(item.snippet.channelId) || 0,
                views: parseInt(item.statistics.viewCount || '0'),
                likes: parseInt(item.statistics.likeCount || '0'),
                comments: parseInt(item.statistics.commentCount || '0'),
                shares: 0, // Not available in API
                lengthSeconds: parseISO8601Duration(item.contentDetails.duration),
                publishedAt: new Date(item.snippet.publishedAt),
                fetchedAt: new Date(),
                region: regionMap.get(item.id),
            };

            return enrichVideo(rawVideo);
        });

        return videos;
    } catch (error) {
        logger.error('YouTube API error:', error);
        throw error;
    }
}

/**
 * Fetch recent videos from a specific channel for niche inference
 */
export async function fetchRecentChannelVideos(channelId: string): Promise<Video[]> {
    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
        throw new Error('YouTube API key not configured');
    }

    try {
        // Step 1: Get channel's upload playlist ID
        const channelResponse = await fetch(
            `${YOUTUBE_BASE_URL}/channels?` +
            `part=contentDetails&` +
            `id=${channelId}&` +
            `key=${apiKey}`
        );

        const channelData = await channelResponse.json();
        if (!channelData.items || channelData.items.length === 0) return [];

        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

        // Step 2: Get recent videos from that playlist
        const playlistResponse = await fetch(
            `${YOUTUBE_BASE_URL}/playlistItems?` +
            `part=snippet&` +
            `playlistId=${uploadsPlaylistId}&` +
            `maxResults=5&` +
            `key=${apiKey}`
        );

        const playlistData = await playlistResponse.json();
        if (!playlistData.items) return [];

        // Map to simplified Video objects (we just need titles/desc for inference)
        return playlistData.items.map((item: any) => ({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            // Mock other fields not needed for inference
            channelId: channelId,
            channelName: item.snippet.channelTitle,
            subscriberCount: 0,
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            lengthSeconds: 0,
            publishedAt: new Date(item.snippet.publishedAt),
            fetchedAt: new Date(),
            viralScore: 0,
            engagementRate: 0,
            estimatedAVDTier: 'Low',
            isOutlier: false,
            recencyMultiplier: 0,
            smallChannelBoost: 0,
        }));
    } catch (error) {
        logger.error('Error fetching channel videos:', error);
        return [];
    }
}

/**
 * Extract channel ID from various YouTube URL formats
 */
export function extractChannelId(url: string): string | null {
    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes('youtube.com') && !urlObj.hostname.includes('youtu.be')) {
            return null;
        }

        // Format 1: youtube.com/@username
        if (url.includes('/@')) {
            const username = url.split('/@')[1].split('/')[0].split('?')[0];
            // Validate username format
            if (!/^[a-zA-Z0-9_\-.]+$/.test(username)) {
                return null;
            }
            return username;
        }

        // Format 2: youtube.com/channel/UC...
        if (url.includes('/channel/')) {
            return url.split('/channel/')[1].split('/')[0].split('?')[0];
        }

        // Format 3: youtube.com/c/channelname
        if (url.includes('/c/')) {
            const channelName = url.split('/c/')[1].split('/')[0].split('?')[0];
            return channelName; // Will need to resolve via API
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Fetch channel data from URL
 */
export async function fetchChannelFromURL(channelUrl: string): Promise<{ channelId: string; channelName: string } | null> {
    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
        throw new Error('YouTube API key not configured');
    }

    const extractedId = extractChannelId(channelUrl);
    if (!extractedId) {
        return null;
    }

    try {
        // Try direct channel ID first
        let response = await fetch(
            `${YOUTUBE_BASE_URL}/channels?` +
            `part=snippet&` +
            `id=${extractedId}&` +
            `key=${apiKey}`
        );

        let data = await response.json();

        // If no results, try as username
        if (!data.items || data.items.length === 0) {
            response = await fetch(
                `${YOUTUBE_BASE_URL}/channels?` +
                `part=snippet&` +
                `forHandle=${extractedId}&` +
                `key=${apiKey}`
            );
            data = await response.json();
        }

        if (!data.items || data.items.length === 0) {
            return null;
        }

        return {
            channelId: data.items[0].id,
            channelName: data.items[0].snippet.title,
        };
    } catch (error) {
        logger.error('Channel fetch error:', error);
        return null;
    }
}


