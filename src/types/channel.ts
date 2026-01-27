export interface SimilarChannel {
    id: string;
    title: string;
    handle: string;
    subscriberCount: number;
    videoCount: number;
    thumbnailUrl: string;
    description: string;
    topics: string[];
    avgViews: number;
    uploadFrequency: string; // "Daily", "Weekly", "Monthly", etc.
    topVideo: {
        id: string;
        title: string;
        views: number;
        publishedAt: string;
        thumbnailUrl: string;
    } | null;
    similarityScore: number; // 0-100
}

export interface ChannelAnalysis {
    targetChannel: SimilarChannel;
    similarChannels: SimilarChannel[];
    keywords: string[];
}
