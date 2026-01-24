import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Settings, Key } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from './ui/use-toast';

export function ApiKeySettings() {
    const { preferences, updateApiKeys } = useLocalStorage();
    const [youtubeKey, setYoutubeKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Initialize with stored keys or empty string
    useEffect(() => {
        if (isOpen) {
            setYoutubeKey(preferences.apiKeys?.youtube || '');
            setGeminiKey(preferences.apiKeys?.gemini || '');
        }
    }, [isOpen, preferences.apiKeys]);

    const handleSave = () => {
        updateApiKeys({
            youtube: youtubeKey.trim(),
            gemini: geminiKey.trim(),
        });
        setIsOpen(false);
        toast({
            title: "Settings saved",
            description: "Your API keys have been updated successfully.",
        });
    };

    const handleClear = () => {
        setYoutubeKey('');
        setGeminiKey('');
    };

    const hasYoutubeKey = !!preferences.apiKeys?.youtube;
    const hasGeminiKey = !!preferences.apiKeys?.gemini;

    const [isTesting, setIsTesting] = useState(false);

    const getLast4 = (str: string) => str && str.length > 4 ? `...${str.slice(-4)}` : '';

    const testConnection = async () => {
        setIsTesting(true);
        const keyToTest = youtubeKey.trim() || import.meta.env.VITE_YOUTUBE_API_KEY;

        if (!keyToTest) {
            toast({ title: "No key to test", variant: "destructive" });
            setIsTesting(false);
            return;
        }

        try {
            // Fetch a tiny resource (Google Developers channel) to test auth
            const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=googledevelopers&key=${keyToTest}`);
            if (res.ok) {
                toast({ title: "Connection Successful!", description: "Your YouTube API Key is valid and working.", duration: 5000 });
            } else {
                const data = await res.json().catch(() => ({}));
                const msg = data.error?.message || res.statusText;
                toast({ title: "Connection Failed", description: msg, variant: "destructive", duration: 10000 });
            }
        } catch (e: any) {
            toast({ title: "Network Error", description: e.message, variant: "destructive" });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-white"
                >
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="border-gray-800 bg-gray-900 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <Settings className="h-5 w-5" />
                        API Configuration
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <p className="text-sm text-gray-400">
                        Enter your own API keys to query YouTube and Gemini. Keys are stored locally in your browser and override default settings.
                    </p>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-gray-200">
                                <span className="flex items-center gap-2">
                                    <Key className="h-4 w-4 text-red-500" />
                                    YouTube API Key
                                </span>
                                <div className="flex flex-col items-end">
                                    <span className={`text-xs ${hasYoutubeKey ? 'text-green-400' : 'text-gray-500'}`}>
                                        {hasYoutubeKey ? '● Custom Key Active' : '○ Using System Default'}
                                    </span>
                                    {hasYoutubeKey && <span className="text-[10px] text-gray-500">Ends in: {getLast4(preferences.apiKeys?.youtube || '')}</span>}
                                </div>
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="Leave empty to use default (.env)"
                                    value={youtubeKey}
                                    onChange={(e) => setYoutubeKey(e.target.value)}
                                    className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-red-500"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={testConnection}
                                    disabled={isTesting}
                                    className="border-gray-700 hover:bg-gray-800 text-xs"
                                >
                                    {isTesting ? 'Testing...' : 'Test'}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Required for searching videos and channel data.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-gray-200">
                                <span className="flex items-center gap-2">
                                    <Key className="h-4 w-4 text-blue-400" />
                                    Gemini API Key
                                </span>
                                <span className={`text-xs ${hasGeminiKey ? 'text-green-400' : 'text-gray-500'}`}>
                                    {hasGeminiKey ? '● Custom Key Active' : '○ Using System Default'}
                                </span>
                            </label>
                            <Input
                                type="password"
                                placeholder="Leave empty to use default (.env)"
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-500">
                                Required for generating strategy insights and content ideas.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleClear}
                            className="border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white"
                        >
                            Clear Inputs
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="bg-white text-black hover:bg-gray-200"
                        >
                            Save Settings
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
