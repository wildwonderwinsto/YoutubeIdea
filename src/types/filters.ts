export type RegionCode = 'ALL' | 'US' | 'GB' | 'CA' | 'AU' | 'DE';
export type DurationType = 'ALL' | 'SHORT' | 'MEDIUM' | 'LONG';
export type DateRange = '24h' | '7d' | '30d';
export type SortBy = 'viewCount' | 'relevance' | 'date' | 'rating';
export type ChannelSize = 'ALL' | 'SMALL' | 'MEDIUM' | 'LARGE';
export type MinViews = 'ALL' | '1000' | '10000' | '100000';

export interface SearchFilters {
    region: RegionCode;
    duration: DurationType;
    dateRange: DateRange;
    sortBy: SortBy;
    channelSize: ChannelSize;
    minViews: MinViews;
}

export const DEFAULT_FILTERS: SearchFilters = {
    region: 'ALL',
    duration: 'ALL',
    dateRange: '7d',
    sortBy: 'viewCount',
    channelSize: 'ALL',
    minViews: 'ALL',
};
 
 
