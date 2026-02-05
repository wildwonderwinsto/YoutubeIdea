import { Video } from '@/types/video';

/**
 * Estimates the AVD (Average View Duration) tier based on public signals
 * Since YouTube API doesn't provide actual AVD for other channels, we estimate based on:
 * - View velocity (views per hour since upload)
 * - Subscriber ratio (views relative to subscriber count)
 * - Engagement rate
 */
export function estimateAVDTier(video: Video): 'High' | 'Medium' | 'Low' {
    const hoursOld = Math.max(
        (Date.now() - new Date(video.publishedAt).getTime()) / (1000 * 60 * 60),
        1 // Minimum 1 hour to prevent inflation
    );
    const viewVelocity = video.views / hoursOld;
    const subscriberRatio = video.views / Math.max(video.subscriberCount, 100);

    // Adjusted thresholds for 1+ hour minimum
    if (viewVelocity > 500 && subscriberRatio > 3) {
        return 'High';
    }

    if (viewVelocity > 50 || subscriberRatio > 1.5) {
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
 * Calculates a score based on View/Subscriber Ratio
 * Ratio > 1.0 (More views than subs) is excellent for long-form
 */
export function calculateViewSubRatioScore(views: number, subscribers: number): number {
    if (subscribers < 100) return 50; // New channel bias
    const ratio = views / Math.max(subscribers, 1);

    // Cap ratio at 10x for max points to avoid skewing too hard
    const score = Math.min(ratio * 10, 100);
    return score;
}

/**
 * Main viral score calculation following the weighted formula:
 * Viral Score = 
 *   (Estimated AVD Tier × 0.35) +
 *   (Engagement Rate × 100 × 0.30) +
 *   (Recency Multiplier × 100 × 0.20) +
 *   (Small Channel Boost × 0.15)
 * 
 * UPDATED LOGIC for Better Outlier Detection:
 * - Increases weight of View/Sub ratio
 * - Penalizes massive channels slightly to let small outliers shine
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

    // 4. View/Sub Ratio (The Outlier Factor)
    const ratioScore = calculateViewSubRatioScore(video.views, video.subscriberCount);

    // 5. Small Channel Boost (Legacy factor, kept for broader small channel support)
    const channelBoost = calculateSmallChannelBoost(video.subscriberCount);

    // --- WEIGHTING ---
    // If video is Long Form (> 60s), we prioritize Ratio and Small Channel heavily
    const isLongForm = video.lengthSeconds > 60;

    let viralScore = 0;

    if (isLongForm) {
        // Long Form Formula: Heavy on Outlier Metrics
        viralScore = (
            (avdScore * 0.20) +          // Quality signal
            (engagementScore * 0.15) +   // Interaction signal
            (recencyScore * 0.10) +      // Freshness
            (ratioScore * 0.35) +        // PRIMARY: Views vs Subs
            (channelBoost * 0.20)        // SECONDARY: Small channel bias
        );

        // Large Channel Dampener for Long Form
        // If subs > 500k and Ratio < 0.5, dampen score to hide "average" big channel uploads
        if (video.subscriberCount > 500000 && (video.views / video.subscriberCount) < 0.5) {
            viralScore *= 0.6;
        }

    } else {
        // Shorts Formula: Standard Viral Signals (High Velocity)
        viralScore = (
            (avdScore * 0.40) +
            (engagementScore * 0.30) +
            (recencyScore * 0.20) +
            (channelBoost * 0.10)
        );
    }

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


