import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Settings, Shield, CheckCircle2 } from 'lucide-react';

export function ApiKeySettings() {
    const [isOpen, setIsOpen] = useState(false);

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
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900" />
                </Button>
            </DialogTrigger>
            <DialogContent className="border-gray-800 bg-gray-900 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl text-white">
                        <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2">
                            <Shield className="h-5 w-5 text-white" />
                        </div>
                        API Configuration
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Secure Backend Connection Active
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg border border-green-500/20 bg-green-950/10 p-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-green-300">Enhanced Security Enabled</p>
                                <p className="text-xs text-gray-400">
                                    Your API keys for YouTube and Google Gemini are now managed securely by the backend server.
                                    They are no longer stored in your browser or exposed to the frontend.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 text-center">
                        <p>To update keys, please edit the <code>server/.env</code> file.</p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={() => setIsOpen(false)} className="bg-gray-800 hover:bg-gray-700 text-white">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
