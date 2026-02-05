import { Video } from '@/types/video';
import { enrichVideo } from './viral-score';
import { getBackendUrl, getAuthHeaders } from './api-config';
import { logger } from './logger';
import { SearchFilters } from '@/types/filters';
import { fetchWithTimeout } from './fetch-utils';
import type {
    YouTubeSearchResponse,
    YouTubeVideoResponse,
    YouTubeChannelResponse,
    YouTubePlaylistResponse,
    YouTubeChannelDetailsResponse
} from '@/types/youtube-api';

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
export async function fetchTrendingVideos(
    niche: string,
    filters: SearchFilters,
    pageTokenMap?: Record<string, string>
): Promise<{ videos: Video[]; nextPageTokenMap: Record<string, string> }> {
    const backendUrl = getBackendUrl();

    // Calculate publishedAfter date based on filter
    const now = new Date();
    let daysToSubtract = 7;
    // If user selected 24h, we ask API for recent stuff. If 7d or 30d, we use those.
    // If they said "ALL", we default to 30d to ensure some recency, or we can omit it.
    // Let's stick to the filter:
    // Let's stick to the filter:
    if (filters.dateRange === '12h') {
        daysToSubtract = 0.5; // 12 hours
    } else if (filters.dateRange === '24h' || filters.dateRange === 'today') {
        daysToSubtract = 1;
    } else if (filters.dateRange === '30d') {
        daysToSubtract = 30;
    }

    const publishedAfter = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000).toISOString();

    const regionsToSearch = filters.region !== 'ALL' ? [filters.region] : TARGET_REGIONS;

    try {
        // Step 1: Search for videos in multiple regions in parallel
        const searchPromises = regionsToSearch.map((region: string) => {
            let url = `${backendUrl}/api/youtube/search?` +
                `part=snippet&` +
                `q=${encodeURIComponent(niche)}&` +
                `type=video&` +
                `maxResults=50&` +
                `regionCode=${region}`;

            // Apply Filters to API Call

            // Date Range
            // Note: publishedAfter is compatible with 'relevance' and 'date' sort orders.
            url += `&publishedAfter=${publishedAfter}`;

            // Sort By
            let order = 'viewCount'; // default
            if (filters.sortBy === 'date') order = 'date';
            if (filters.sortBy === 'rating') order = 'rating';
            if (filters.sortBy === 'relevance') order = 'relevance';
            // Note: 'viewCount' is strictly view count. 'relevance' is default YouTube algo.
            url += `&order=${order}`;

            // Duration
            if (filters.duration === 'SHORT') {
                url += `&videoDuration=short`;
            } else if (filters.duration === 'LONG') {
                // User wants "Regular" (16:9), which effectively means NOT shorts.
                // YouTube API splits this into 'medium' (4-20m) and 'long' (>20m).
                // If we select 'medium', we miss long. If 'long', we miss medium.
                // STRATEGY: Don't filter by duration in API, but filter OUT shorts (anything < 60s) on client side.
                // This ensures we get everything > 1 min.
            } else if (filters.duration === 'MEDIUM') {
                // If legacy 'MEDIUM' is somehow passed, map to medium
                url += `&videoDuration=medium`;
            }

            // Pagination Token
            if (pageTokenMap && pageTokenMap[region]) {
                url += `&pageToken=${pageTokenMap[region]}`;
            }

            return fetchWithTimeout(url, { headers: getAuthHeaders(), timeout: 15000 }).then(async res => {
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const errorMessage = errorData.error?.message || res.statusText || `Status ${res.status}`;
                    if (errorMessage.includes('quotaExceeded') || res.status === 429) {
                        throw new Error('QUOTA_EXCEEDED');
                    }
                    throw new Error(`YouTube API request failed: ${errorMessage}`);
                }
                const data: YouTubeSearchResponse = await res.json();
                // Tag items within the region
                const taggedItems = data.items.map(item => ({ ...item, region }));
                return {
                    region,
                    items: taggedItems,
                    nextPageToken: data.nextPageToken
                };
            });
        });

        const searchResults = await Promise.all(searchPromises);

        // Collect new page tokens
        const newPageTokenMap: Record<string, string> = {};
        searchResults.forEach(result => {
            if (result.nextPageToken) {
                newPageTokenMap[result.region] = result.nextPageToken;
            }
        });

        // Aggregate and deduplicate video IDs
        const videoIdSet = new Set<string>();
        const regionMap = new Map<string, string>(); // videoId -> region

        searchResults.forEach(data => {
            data.items.forEach(item => {
                if (!videoIdSet.has(item.id.videoId)) {
                    videoIdSet.add(item.id.videoId);
                    regionMap.set(item.id.videoId, item.region || 'US');
                }
            });
        });

        if (videoIdSet.size === 0) {
            return { videos: [], nextPageTokenMap: newPageTokenMap };
        }

        // Limit to 50 videos max for detailed stats call per batch
        const videoIds = Array.from(videoIdSet).slice(0, 50).join(',');

        const statsResponse = await fetchWithTimeout(
            `${backendUrl}/api/youtube/videos?` +
            `part=statistics,snippet,contentDetails&` +
            `id=${videoIds}`,
            { headers: getAuthHeaders(), timeout: 15000 }
        );

        if (!statsResponse.ok) {
            const errorData = await statsResponse.json().catch(() => ({}));
            throw new Error(`YouTube API statistics request failed: ${errorData.error?.message || statsResponse.statusText}`);
        }

        const statsData: YouTubeVideoResponse = await statsResponse.json();

        // Step 3: Fetch channel subscriber counts
        const channelIds = statsData.items.map(item => item.snippet.channelId).join(',');
        const channelResponse = await fetch(
            `${backendUrl}/api/youtube/channels?` +
            `part=statistics&` +
            `id=${channelIds}`,
            { headers: getAuthHeaders() }
        );

        if (!channelResponse.ok) {
            const errorData = await channelResponse.json().catch(() => ({}));
            throw new Error(`YouTube API channel request failed: ${errorData.error?.message || channelResponse.statusText}`);
        }

        const channelData: YouTubeChannelResponse = await channelResponse.json();

        // Step 4: Build channel map
        const channelMap = new Map<string, number>();
        channelData.items.forEach(channel => {
            channelMap.set(channel.id, parseInt(channel.statistics.subscriberCount || '0'));
        });

        // Step 5: Combine data
        const videos: Video[] = statsData.items.map(item => {
            const rawVideo = {
                id: item.id,
                title: item.snippet.title,
                channelId: item.snippet.channelId,
                channelName: item.snippet.channelTitle,
                subscriberCount: channelMap.get(item.snippet.channelId) || 0,
                views: parseInt(item.statistics.viewCount || '0'),
                likes: parseInt(item.statistics.likeCount || '0'),
                comments: parseInt(item.statistics.commentCount || '0'),
                shares: 0,
                lengthSeconds: parseISO8601Duration(item.contentDetails.duration),
                publishedAt: new Date(item.snippet.publishedAt),
                fetchedAt: new Date(),
                region: regionMap.get(item.id),
            };

            return enrichVideo(rawVideo);
        });

        return { videos, nextPageTokenMap: newPageTokenMap };
    } catch (error) {
        logger.error('YouTube API error:', error);
        throw error;
    }
}

/**
 * Fetch recent videos from a specific channel for niche inference
 */
export async function fetchRecentChannelVideos(channelId: string): Promise<Video[]> {
    const backendUrl = getBackendUrl();

    try {
        // Step 1: Get channel's upload playlist ID
        const channelResponse = await fetch(
            `${backendUrl}/api/youtube/channels?` +
            `part=contentDetails&` +
            `id=${channelId}`,
            { headers: getAuthHeaders() }
        );

        const channelData: YouTubeChannelDetailsResponse = await channelResponse.json();
        if (!channelData.items || channelData.items.length === 0) return [];

        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

        // Step 2: Get recent videos from that playlist
        const playlistResponse = await fetch(
            `${backendUrl}/api/youtube/playlistItems?` +
            `part=snippet&` +
            `playlistId=${uploadsPlaylistId}&` +
            `maxResults=5`,
            { headers: getAuthHeaders() }
        );

        const playlistData: YouTubePlaylistResponse = await playlistResponse.json();
        if (!playlistData.items) return [];

        // Map to simplified Video objects (we just need titles/desc for inference)
        return playlistData.items.map(item => ({
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
    const backendUrl = getBackendUrl();

    const extractedId = extractChannelId(channelUrl);
    if (!extractedId) {
        return null;
    }

    try {
        // Try direct channel ID first
        let response = await fetch(
            `${backendUrl}/api/youtube/channels?` +
            `part=snippet&` +
            `id=${extractedId}`,
            { headers: getAuthHeaders() }
        );

        let data = await response.json();

        // If no results, try as username
        if (!data.items || data.items.length === 0) {
            response = await fetch(
                `${backendUrl}/api/youtube/channels?` +
                `part=snippet&` +
                `forHandle=${extractedId}`,
                { headers: getAuthHeaders() }
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
