import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { SearchFilters, RegionCode, DurationType, DateRange, SortBy, ChannelSize, MinViews } from '@/types/filters';
import { SlidersHorizontal, MapPin, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterDialogProps {
    filters: SearchFilters;
    onFilterChange: (filters: SearchFilters) => void;
    trigger?: React.ReactNode;
}

export function FilterDialog({ filters, onFilterChange, trigger }: FilterDialogProps) {
    const handleRegionChange = (region: RegionCode) => onFilterChange({ ...filters, region });
    const handleDurationChange = (duration: DurationType) => onFilterChange({ ...filters, duration });
    const handleDateRangeChange = (dateRange: DateRange) => onFilterChange({ ...filters, dateRange });
    const handleSortChange = (sortBy: SortBy) => onFilterChange({ ...filters, sortBy });
    const handleChannelSizeChange = (channelSize: ChannelSize) => onFilterChange({ ...filters, channelSize });
    const handleMinViewsChange = (minViews: MinViews) => onFilterChange({ ...filters, minViews });

    const FilterSection = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
        <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium text-gray-400">
                <Icon className="h-4 w-4" />
                {title}
            </h4>
            <div className="flex flex-wrap gap-2">
                {children}
            </div>
        </div>
    );

    const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
        <button
            onClick={onClick}
            className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                active
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                    : "border border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-200"
            )}
        >
            {children}
        </button>
    );

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800 hover:text-white">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="border-gray-800 bg-gray-900 sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white">Search Filters</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Sort Order */}
                    <FilterSection title="Sort By" icon={SlidersHorizontal}>
                        <FilterPill active={filters.sortBy === 'viewCount'} onClick={() => handleSortChange('viewCount')}>Most Viewed</FilterPill>
                        <FilterPill active={filters.sortBy === 'relevance'} onClick={() => handleSortChange('relevance')}>Relevance</FilterPill>
                        <FilterPill active={filters.sortBy === 'date'} onClick={() => handleSortChange('date')}>Newest</FilterPill>
                        <FilterPill active={filters.sortBy === 'rating'} onClick={() => handleSortChange('rating')}>Highest Rated</FilterPill>
                    </FilterSection>

                    {/* Region Filter */}
                    <FilterSection title="Target Region" icon={MapPin}>
                        <FilterPill active={filters.region === 'ALL'} onClick={() => handleRegionChange('ALL')}>All</FilterPill>
                        <FilterPill active={filters.region === 'US'} onClick={() => handleRegionChange('US')}>🇺🇸 USA</FilterPill>
                        <FilterPill active={filters.region === 'GB'} onClick={() => handleRegionChange('GB')}>🇬🇧 UK</FilterPill>
                        <FilterPill active={filters.region === 'CA'} onClick={() => handleRegionChange('CA')}>🇨🇦 CA</FilterPill>
                        <FilterPill active={filters.region === 'AU'} onClick={() => handleRegionChange('AU')}>🇦🇺 AU</FilterPill>
                        <FilterPill active={filters.region === 'DE'} onClick={() => handleRegionChange('DE')}>🇩🇪 DE</FilterPill>
                    </FilterSection>

                    {/* Channel Size */}
                    <FilterSection title="Channel Size" icon={SlidersHorizontal}>
                        <FilterPill active={filters.channelSize === 'ALL'} onClick={() => handleChannelSizeChange('ALL')}>Any Size</FilterPill>
                        <FilterPill active={filters.channelSize === 'SMALL'} onClick={() => handleChannelSizeChange('SMALL')}>Small (&lt;10k)</FilterPill>
                        <FilterPill active={filters.channelSize === 'MEDIUM'} onClick={() => handleChannelSizeChange('MEDIUM')}>Medium (10k-500k)</FilterPill>
                        <FilterPill active={filters.channelSize === 'LARGE'} onClick={() => handleChannelSizeChange('LARGE')}>Large (500k+)</FilterPill>
                    </FilterSection>

                    {/* Minimum Views */}
                    <FilterSection title="Min Views" icon={SlidersHorizontal}>
                        <FilterPill active={filters.minViews === 'ALL'} onClick={() => handleMinViewsChange('ALL')}>Any</FilterPill>
                        <FilterPill active={filters.minViews === '1000'} onClick={() => handleMinViewsChange('1000')}>1k+</FilterPill>
                        <FilterPill active={filters.minViews === '10000'} onClick={() => handleMinViewsChange('10000')}>10k+</FilterPill>
                        <FilterPill active={filters.minViews === '100000'} onClick={() => handleMinViewsChange('100000')}>100k+</FilterPill>
                    </FilterSection>

                    {/* Duration Filter */}
                    <FilterSection title="Video Type" icon={Clock}>
                        <FilterPill active={filters.duration === 'ALL'} onClick={() => handleDurationChange('ALL')}>All</FilterPill>
                        <FilterPill active={filters.duration === 'SHORT'} onClick={() => handleDurationChange('SHORT')}>Shorts (9:16)</FilterPill>
                        <FilterPill active={filters.duration === 'LONG'} onClick={() => handleDurationChange('LONG')}>Regular (16:9)</FilterPill>
                    </FilterSection>

                    {/* Date Range Filter */}
                    <FilterSection title="Uploaded In" icon={Calendar}>
                        <FilterPill active={filters.dateRange === '12h'} onClick={() => handleDateRangeChange('12h')}>Last 12h</FilterPill>
                        <FilterPill active={filters.dateRange === '24h'} onClick={() => handleDateRangeChange('24h')}>Last 24h</FilterPill>
                        <FilterPill active={filters.dateRange === 'today'} onClick={() => handleDateRangeChange('today')}>Today</FilterPill>
                        <FilterPill active={filters.dateRange === '7d'} onClick={() => handleDateRangeChange('7d')}>Last 7 Days</FilterPill>
                        <FilterPill active={filters.dateRange === '30d'} onClick={() => handleDateRangeChange('30d')}>Last 30 Days</FilterPill>
                    </FilterSection>
                </div>
            </DialogContent>
        </Dialog>
    );
}


