import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Settings, Key, CheckCircle2, Eye, EyeOff, Copy, Info, Trash2, HelpCircle, Shield, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from './ui/use-toast';

export function ApiKeySettings() {
    const { preferences, updateApiKeys } = useLocalStorage();
    const [youtubeKey, setYoutubeKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [userGuideOpen, setUserGuideOpen] = useState(false);
    const [showYoutubeKey, setShowYoutubeKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeTab, setActiveTab] = useState<'youtube' | 'gemini'>('youtube');

    // Load saved keys when dialog opens
    useEffect(() => {
        if (isOpen) {
            setYoutubeKey(preferences.apiKeys?.youtube || '');
            setGeminiKey(preferences.apiKeys?.gemini || '');
            setHasChanges(false);
        }
    }, [isOpen, preferences.apiKeys?.youtube, preferences.apiKeys?.gemini]);

    // Track changes
    useEffect(() => {
        const ytChanged = youtubeKey !== (preferences.apiKeys?.youtube || '');
        const gmChanged = geminiKey !== (preferences.apiKeys?.gemini || '');
        setHasChanges(ytChanged || gmChanged);
    }, [youtubeKey, geminiKey, preferences.apiKeys]);

    const handleSave = () => {
        // Validate API key formats before saving
        const trimmedYoutubeKey = youtubeKey.trim();
        const trimmedGeminiKey = geminiKey.trim();

        // YouTube/Gemini keys should match: AIza + 35 alphanumeric/underscore/hyphen
        const keyRegex = /^AIza[A-Za-z0-9_-]{35}$/;

        if (trimmedYoutubeKey && !keyRegex.test(trimmedYoutubeKey)) {
            toast({
                title: "Invalid YouTube Key",
                description: "YouTube API keys should start with 'AIza' and be 39 characters long.",
                variant: "destructive"
            });
            return;
        }

        if (trimmedGeminiKey && !keyRegex.test(trimmedGeminiKey)) {
            toast({
                title: "Invalid Gemini Key",
                description: "Gemini API keys should start with 'AIza' and be 39 characters long.",
                variant: "destructive"
            });
            return;
        }

        updateApiKeys({
            youtube: trimmedYoutubeKey,
            gemini: trimmedGeminiKey
        });

        setIsOpen(false);
        toast({
            title: "Keys Saved",
            description: "Your custom API keys will be prioritized over the server defaults.",
        });
    };

    const handleClearAll = () => {
        setYoutubeKey('');
        setGeminiKey('');
    };

    const handleReset = () => {
        setYoutubeKey(preferences.apiKeys?.youtube || '');
        setGeminiKey(preferences.apiKeys?.gemini || '');
    };

    const handleRemoveKeys = () => {
        updateApiKeys({ youtube: '', gemini: '' });
        setYoutubeKey('');
        setGeminiKey('');
        toast({
            title: "Keys Removed",
            description: "Custom keys removed. The app will now use the server's default keys.",
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "Copied!",
                description: "API key copied to clipboard.",
            });
        });
    };

    const hasYoutubeKey = !!preferences.apiKeys?.youtube;
    const hasGeminiKey = !!preferences.apiKeys?.gemini;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-white hover:bg-gray-800 relative"
                    title="API Configuration"
                >
                    <Settings className="h-5 w-5" />
                    {/* Show green dot if using CUSTOM keys */}
                    {(hasYoutubeKey || hasGeminiKey) && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-gray-900" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="border-gray-800 bg-gray-900 sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl text-white">
                        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2">
                            <Settings className="h-5 w-5 text-white" />
                        </div>
                        API Configuration
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Manage your custom API keys.
                    </DialogDescription>
                </DialogHeader>

                {/* Info Block */}
                <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-300">Bring Your Own Key (Optional)</p>
                            <p className="text-xs text-gray-400">
                                This app runs on a shared server quota. If the daily limit is reached, you can enter your own
                                personal API keys here to continue using the app without interruption.
                                Your keys are sent securely to the backend and never exposed.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-gray-800 pb-2 mt-2">
                    <button
                        onClick={() => setActiveTab('youtube')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'youtube'
                            ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`}
                    >
                        <Globe className="h-4 w-4" />
                        YouTube
                        {hasYoutubeKey && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('gemini')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'gemini'
                            ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`}
                    >
                        <Key className="h-4 w-4" />
                        Gemini AI
                        {hasGeminiKey && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                    </button>
                </div>

                <div className="min-h-[200px] mt-4">
                    {/* YouTube Tab */}
                    {activeTab === 'youtube' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center justify-between">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${hasYoutubeKey
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-700/50 text-gray-400'
                                    }`}>
                                    {hasYoutubeKey ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3" />
                                            Using Custom Key
                                        </>
                                    ) : (
                                        <>
                                            <Info className="h-3 w-3" />
                                            Using Server Default
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-200">
                                    YouTube Data API v3 Key
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showYoutubeKey ? "text" : "password"}
                                        placeholder="AIzaSy... (leave empty to use server default)"
                                        value={youtubeKey}
                                        onChange={(e) => setYoutubeKey(e.target.value)}
                                        className="pr-20 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                        >
                                            {showYoutubeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                        {youtubeKey && (
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(youtubeKey)}
                                                className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Gemini Tab */}
                    {activeTab === 'gemini' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="flex items-center justify-between">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${hasGeminiKey
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-gray-700/50 text-gray-400'
                                    }`}>
                                    {hasGeminiKey ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3" />
                                            Using Custom Key
                                        </>
                                    ) : (
                                        <>
                                            <Info className="h-3 w-3" />
                                            Using Server Default
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-200">
                                    Gemini AI API Key
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showGeminiKey ? "text" : "password"}
                                        placeholder="AIzaSy... (leave empty to use server default)"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        className="pr-20 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                        >
                                            {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                        {geminiKey && (
                                            <button
                                                type="button"
                                                onClick={() => copyToClipboard(geminiKey)}
                                                className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Collapsible Guide */}
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden transition-all duration-300 mt-6">
                        <button
                            onClick={() => setUserGuideOpen(!userGuideOpen)}
                            className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-gray-400" />
                                How to get your own keys
                            </div>
                            {userGuideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {userGuideOpen && (
                            <div className="p-4 pt-0 text-sm text-gray-400 space-y-3 animate-in slide-in-from-top-2">
                                <div className="h-px bg-gray-800 mb-3" />
                                <p><strong>YouTube Key:</strong> Go to Google Cloud Console → APIs & Services → Create Credentials.</p>
                                <p><strong>Gemini Key:</strong> Go to Google AI Studio → Get API Key.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-6 border-t border-gray-800">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            disabled={!hasChanges}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50"
                        >
                            Reset
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleClearAll}
                            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                            Clear Form
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        {(hasYoutubeKey || hasGeminiKey) && (
                            <Button
                                variant="outline"
                                onClick={handleRemoveKeys}
                                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Custom Keys
                            </Button>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Save Configuration
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
