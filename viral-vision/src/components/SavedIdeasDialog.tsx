import { SavedIdea } from '@/types/video';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { VideoCard } from './VideoCard';
import { Trash2 } from 'lucide-react';

interface SavedIdeasDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    savedIdeas: SavedIdea[];
    onRemove: (videoId: string) => void;
    onClearAll: () => void;
}

export function SavedIdeasDialog({
    open,
    onOpenChange,
    savedIdeas,
    onRemove,
    onClearAll,
}: SavedIdeasDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto bg-gray-900 text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Saved Ideas ({savedIdeas.length}/50)</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Your saved video ideas for inspiration. These are stored locally in your browser.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {savedIdeas.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                            <p>No saved ideas yet.</p>
                            <p className="mt-2 text-sm">Start exploring trending videos and click "Save" on any card.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-end">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={onClearAll}
                                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </Button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                {savedIdeas.map((idea) => (
                                    <div key={idea.video.id} className="relative">
                                        <VideoCard
                                            video={idea.video}
                                            isSaved={true}
                                            onSave={() => onRemove(idea.video.id)}
                                        />
                                        <div className="mt-2 text-xs text-gray-500">
                                            Saved {new Date(idea.savedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
