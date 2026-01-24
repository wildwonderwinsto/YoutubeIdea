export interface Video {
    id: string;
    title: string;
    description?: string;
    region?: string;
    channelId: string;
    channelName: string;
    subscriberCount: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    lengthSeconds: number;
    publishedAt: Date;
    fetchedAt: Date;

    // Calculated fields
    viralScore: number;
    engagementRate: number;
    estimatedAVDTier: 'High' | 'Medium' | 'Low';
    isOutlier: boolean;
    recencyMultiplier: number;
    smallChannelBoost: number;
}

export interface SavedIdea {
    video: Video;
    savedAt: Date;
    note?: string;
}

export interface UserPreferences {
    lastNiche: string;
    savedIdeas: SavedIdea[];
    apiKeys?: {
        youtube?: string;
        gemini?: string;
    };
}

