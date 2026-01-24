import { Video } from '@/types/video';

/**
 * Estimates the AVD (Average View Duration) tier based on public signals
 * Since YouTube API doesn't provide actual AVD for other channels, we estimate based on:
 * - View velocity (views per hour since upload)
 * - Subscriber ratio (views relative to subscriber count)
 * - Engagement rate
 */
export function estimateAVDTier(video: Video): 'High' | 'Medium' | 'Low' {
    const hoursOld = (Date.now() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60);
    const viewVelocity = video.views / Math.max(hoursOld, 1);
    const subscriberRatio = video.views / Math.max(video.subscriberCount, 100);

    // High tier: Fast growth + overperformance
    if (viewVelocity > 1000 && subscriberRatio > 5) {
        return 'High';
    }

    // Medium tier: Decent growth or strong engagement
    if (viewVelocity > 100 || subscriberRatio > 2) {
        return 'Medium';
    }

    return 'Low';
}

/**
 * Calculates the recency multiplier for viral scoring
 * Videos uploaded recently get a boost
 */
export function calculateRecencyMultiplier(publishedAt: Date): number {
    const hoursOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

    if (hoursOld <= 24) return 1.0;
    if (hoursOld <= 48) return 0.5;
    return 0.1;
}

/**
 * Calculates the small channel boost
 * Smaller channels get a higher multiplier to prioritize outliers
 */
export function calculateSmallChannelBoost(subscriberCount: number): number {
    const boost = 100000 / Math.max(subscriberCount, 1000);
    return Math.min(boost, 100);
}

/**
 * Determines if a video is an outlier (small channel with high views)
 */
export function isOutlierVideo(video: Video): boolean {
    return video.views > video.subscriberCount * 10;
}

/**
 * Main viral score calculation following the weighted formula:
 * Viral Score = 
 *   (Estimated AVD Tier × 0.35) +
 *   (Engagement Rate × 100 × 0.30) +
 *   (Recency Multiplier × 100 × 0.20) +
 *   (Small Channel Boost × 0.15)
 */
export function calculateViralScore(video: Omit<Video, 'viralScore' | 'engagementRate' | 'estimatedAVDTier' | 'isOutlier' | 'recencyMultiplier' | 'smallChannelBoost'>): number {
    // 1. Estimated AVD Tier (0-100 scale)
    const estimatedTier = estimateAVDTier(video as Video);
    const avdScore = estimatedTier === 'High' ? 100
        : estimatedTier === 'Medium' ? 60
            : 30;

    // 2. Engagement Rate
    const engagementRate = (video.likes + video.comments + (video.shares || 0)) / Math.max(video.views, 1);
    const engagementScore = Math.min(engagementRate * 100, 100);

    // 3. Recency Multiplier
    const recencyMultiplier = calculateRecencyMultiplier(video.publishedAt);
    const recencyScore = recencyMultiplier * 100;

    // 4. Small Channel Boost
    const channelBoost = calculateSmallChannelBoost(video.subscriberCount);
    const boostScore = Math.min(channelBoost, 20); // Cap contribution at 20 points

    // Weighted Calculation
    const viralScore = (
        (avdScore * 0.35) +
        (engagementScore * 0.30) +
        (recencyScore * 0.20) +
        (boostScore * 0.15)
    );

    return Math.min(viralScore, 100);
}

/**
 * Enriches a raw video object with calculated fields
 */
export function enrichVideo(videoData: Omit<Video, 'viralScore' | 'engagementRate' | 'estimatedAVDTier' | 'isOutlier' | 'recencyMultiplier' | 'smallChannelBoost'>): Video {
    const estimatedAVDTier = estimateAVDTier(videoData as Video);
    const engagementRate = (videoData.likes + videoData.comments + (videoData.shares || 0)) / Math.max(videoData.views, 1);
    const recencyMultiplier = calculateRecencyMultiplier(videoData.publishedAt);
    const smallChannelBoost = calculateSmallChannelBoost(videoData.subscriberCount);
    const viralScore = calculateViralScore(videoData);
    const isOutlier = isOutlierVideo({ ...videoData, subscriberCount: videoData.subscriberCount, views: videoData.views } as Video);

    return {
        ...videoData,
        viralScore,
        engagementRate,
        estimatedAVDTier,
        isOutlier,
        recencyMultiplier,
        smallChannelBoost,
    };
}

/**
 * Ranks videos by viral score (descending)
 */
export function rankVideos(videos: Video[]): Video[] {
    return [...videos].sort((a, b) => b.viralScore - a.viralScore);
}
 
