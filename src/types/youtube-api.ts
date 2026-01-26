/**
 * Type definitions for YouTube Data API v3 responses
 */

export interface YouTubeSearchItem {
    id: {
        videoId: string;
    };
    snippet: {
        title: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
    };
    region?: string; // Added by our client
}

export interface YouTubeSearchResponse {
    items: YouTubeSearchItem[];
    nextPageToken?: string;
}

export interface YouTubeVideoItem {
    id: string;
    snippet: {
        title: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
    };
    statistics: {
        viewCount: string;
        likeCount: string;
        commentCount: string;
    };
    contentDetails: {
        duration: string; // ISO 8601 format
    };
}

export interface YouTubeVideoResponse {
    items: YouTubeVideoItem[];
}

export interface YouTubeChannelItem {
    id: string;
    statistics: {
        subscriberCount: string;
    };
}

export interface YouTubeChannelResponse {
    items: YouTubeChannelItem[];
}

export interface YouTubePlaylistItem {
    snippet: {
        title: string;
        description: string;
        channelTitle: string;
        publishedAt: string;
        resourceId: {
            videoId: string;
        };
    };
}

export interface YouTubePlaylistResponse {
    items: YouTubePlaylistItem[];
}

export interface YouTubeChannelDetailsItem {
    id: string;
    snippet: {
        title: string;
    };
    contentDetails: {
        relatedPlaylists: {
            uploads: string;
        };
    };
}

export interface YouTubeChannelDetailsResponse {
    items: YouTubeChannelDetailsItem[];
}
