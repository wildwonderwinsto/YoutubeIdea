import { useState, useCallback } from 'react';
import { Upload, Film, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { getBackendUrl } from '@/lib/api-config';
import { toast } from './ui/use-toast';

interface VideoUploadProps {
    onUploadStart: (jobId: string) => void;
}

export function VideoUpload({ onUploadStart }: VideoUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('video/')) {
            setFile(droppedFile);
        } else {
            toast({
                title: 'Invalid File',
                description: 'Please upload a video file',
                variant: 'destructive'
            });
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        // Check file size (100MB max)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            toast({
                title: 'File Too Large',
                description: 'Maximum file size is 100MB',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('video', file);

            const response = await fetch(`${getBackendUrl()}/api/analyze/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Upload failed');
            }

            const data = await response.json();
            onUploadStart(data.jobId);

            toast({
                title: 'Upload Successful',
                description: 'Your video is being analyzed. This may take 15-20 minutes.'
            });
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: 'Upload Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive'
            });
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    border-2 border-dashed rounded-2xl p-12 text-center transition-all
                    ${isDragging ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 bg-gray-900/50'}
                    ${file ? 'border-green-500 bg-green-950/10' : ''}
                `}
            >
                {!file ? (
                    <>
                        <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Upload Your Video
                        </h3>
                        <p className="text-gray-400 mb-6">
                            Drag and drop or click to select
                        </p>
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="video-upload"
                            disabled={uploading}
                        />
                        <label htmlFor="video-upload">
                            <Button variant="outline" className="cursor-pointer" asChild>
                                <span>Select Video File</span>
                            </Button>
                        </label>
                        <p className="text-xs text-gray-500 mt-4">
                            Max file size: 100MB • Supported: MP4, MOV, AVI, MKV, WebM
                        </p>
                    </>
                ) : (
                    <>
                        <Film className="h-16 w-16 mx-auto mb-4 text-green-400" />
                        <h3 className="text-xl font-semibold text-white mb-2">
                            {file.name}
                        </h3>
                        <p className="text-gray-400 mb-6">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button
                                onClick={() => setFile(null)}
                                variant="outline"
                                disabled={uploading}
                            >
                                Change Video
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                            >
                                {uploading ? 'Uploading...' : 'Analyze Video'}
                            </Button>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-950/10 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-200">
                        <p className="font-medium mb-1">Processing time: 15-20 minutes</p>
                        <p className="text-yellow-300/80">
                            This is a free service using local processing. You can close the tab
                            and check back later using your Job ID.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
