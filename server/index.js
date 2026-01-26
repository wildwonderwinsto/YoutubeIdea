require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Security: CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Logging
if (isDevelopment) {
    app.use(morgan('dev'));
} else {
    // Basic logging for production
    app.use(morgan('combined'));
}

app.use(express.json());

// Security: Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 searches per minute (slightly higher than 10 to allow for bursts)
    message: { error: 'Search rate limit exceeded. Please wait.' }
});

// Apply rate limits
app.use('/api/', apiLimiter);
app.use('/download', searchLimiter);

// Validation Middleware
const validateYouTubeRequest = (req, res, next) => {
    const { q, maxResults, regionCode } = req.query;

    // Validate search query
    if (q && (typeof q !== 'string' || q.length > 200)) {
        return res.status(400).json({ error: 'Invalid search query' });
    }

    // Validate maxResults
    if (maxResults && (isNaN(maxResults) || parseInt(maxResults) > 50)) {
        return res.status(400).json({ error: 'Invalid maxResults' });
    }

    // Validate regionCode (basic check)
    if (regionCode && (typeof regionCode !== 'string' || regionCode.length > 2)) {
        return res.status(400).json({ error: 'Invalid region code' });
    }

    next();
};

// Helper for proxying YouTube requests with better error handling
const proxyYouTubeRequest = (endpoint, req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: YouTube API key missing' });
    }

    const queryParams = new URLSearchParams(req.query);
    queryParams.append('key', apiKey);

    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${queryParams.toString()}`;

    if (isDevelopment) {
        console.log(`📡 Proxying ${endpoint} request`);
    }

    const request = https.get(url, { timeout: 10000 }, (upstreamRes) => {
        const { statusCode } = upstreamRes;
        const contentType = upstreamRes.headers['content-type'];

        res.status(statusCode);
        if (contentType) res.set('Content-Type', contentType);

        upstreamRes.pipe(res);

        upstreamRes.on('error', (e) => {
            console.error('Upstream error:', e);
            if (!res.headersSent) {
                res.status(502).json({ error: 'Upstream service error' });
            }
        });
    });

    request.on('timeout', () => {
        request.destroy();
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout' });
        }
    });

    request.on('error', (e) => {
        console.error(`Proxy Error (${endpoint}):`, e);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Proxy request failed', details: e.message });
        }
    });
};

// Gemini Proxy Endpoint
app.post('/api/gemini/generate', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const { prompt, enableSearch } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Invalid prompt' });
    }

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    };

    if (enableSearch) {
        requestBody.tools = [{ googleSearch: {} }];
    }

    try {
        // Use fetch (available in node 18+)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// YouTube API Proxy Endpoints with Validation
app.get('/api/youtube/search', validateYouTubeRequest, (req, res) => proxyYouTubeRequest('search', req, res));
app.get('/api/youtube/videos', (req, res) => proxyYouTubeRequest('videos', req, res)); // ID validation is complex, skipping for now
app.get('/api/youtube/channels', (req, res) => proxyYouTubeRequest('channels', req, res));
app.get('/api/youtube/playlistItems', (req, res) => proxyYouTubeRequest('playlistItems', req, res));

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ViralVision Server (with Proxy) is Running 🚀' });
});

app.get('/health', (req, res) => {
    const hasYoutubeKey = !!process.env.YOUTUBE_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    res.json({
        status: hasYoutubeKey && hasGeminiKey ? 'healthy' : 'degraded',
        service: 'viral-vision-server',
        timestamp: new Date().toISOString(),
        apis: {
            youtube: hasYoutubeKey ? 'configured' : 'missing',
            gemini: hasGeminiKey ? 'configured' : 'missing'
        }
    });
});

// Download endpoint - uses temp file approach for reliable video+audio merging
app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    const filename = req.query.filename || 'video';

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video URL' });
    }

    if (isDevelopment) {
        console.log(`📥 Download request: ${videoUrl}`);
    }

    // Detect platform and get appropriate yt-dlp binary
    const platform = process.platform;
    let ytDlpBinary;

    if (platform === 'win32') {
        ytDlpBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    } else if (platform === 'darwin') {
        ytDlpBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    } else {
        // Linux and other platforms
        ytDlpBinary = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
    }

    if (isDevelopment) {
        console.log(`Using yt-dlp binary at: ${ytDlpBinary} (platform: ${platform})`);

        // Check if ffmpeg is available (needed for merging video+audio)
        const { execSync } = require('child_process');
        try {
            execSync('ffmpeg -version', { stdio: 'ignore' });
            console.log('✅ ffmpeg is available for video+audio merging');
        } catch (e) {
            console.warn('⚠️ WARNING: ffmpeg not found! Video+audio merging may fail. Install ffmpeg for proper downloads.');
        }
    }

    // Sanitize filename for use in Content-Disposition header
    const sanitizedFilename = filename
        .replace(/[^a-z0-9]/gi, '_')
        .substring(0, 100) // Limit length
        .toLowerCase() || 'video';
    const finalFilename = `${sanitizedFilename}.mp4`;

    // Create temp file path
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `viralvision_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);

    try {
        // Download to temp file with proper format selection
        // Format priority: 
        // 1. Progressive formats (already have video+audio merged) - preferred
        // 2. bestvideo+bestaudio (will be merged with ffmpeg)
        // This ensures we get audio even if merge fails
        // Format selector: Prioritize formats with both video AND audio
        // Strategy: Use bestvideo+bestaudio which ensures we get both streams
        // yt-dlp will merge them automatically if ffmpeg is available
        // Fallback to best if merge fails (but best might be video-only, so not ideal)
        const ytDlp = spawn(ytDlpBinary, [
            '-f', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--no-check-certificate',
            '--no-playlist',
            '--prefer-free-formats',
            '--no-mtime', // Don't set file modification time
            '--postprocessor-args', 'ffmpeg:-c:v copy -c:a copy', // Copy streams without re-encoding (faster)
            '-o', tempFilePath, // Output to temp file
            videoUrl
        ]);

        let hasError = false;
        let errorMessage = '';

        // Collect stderr for error messages and format info
        ytDlp.stderr.on('data', (data) => {
            const errorText = data.toString();
            if (isDevelopment) {
                // Log all stderr output to see what format is being selected
                console.log(`yt-dlp: ${errorText}`);
            }

            // Check for empty file error specifically
            if (errorText.toLowerCase().includes('downloaded file is empty') ||
                errorText.toLowerCase().includes('file is empty')) {
                hasError = true;
                errorMessage += 'Downloaded file is empty. This usually means no format matched the selector. ';
            }

            // Check for empty file error specifically (this is a critical error)
            if (errorText.toLowerCase().includes('downloaded file is empty') ||
                errorText.toLowerCase().includes('file is empty')) {
                hasError = true;
                errorMessage += 'Downloaded file is empty. Format selector may be too restrictive. ';
            }

            // Check for actual errors (not just warnings)
            if (errorText.toLowerCase().includes('error') ||
                errorText.toLowerCase().includes('unable') ||
                errorText.toLowerCase().includes('failed') ||
                errorText.toLowerCase().includes('unavailable')) {
                hasError = true;
                errorMessage += errorText;
            }

            // Log format and merge information
            if (errorText.toLowerCase().includes('merging formats') ||
                errorText.toLowerCase().includes('ffmpeg') ||
                errorText.toLowerCase().includes('postprocessor') ||
                errorText.toLowerCase().includes('deleting original file')) {
                // These are info messages about the merge process
                if (isDevelopment) {
                    console.log(`ℹ️ ${errorText.trim()}`);
                }
            }

            // Check for merge failures
            if (errorText.toLowerCase().includes('error merging') ||
                errorText.toLowerCase().includes('merge failed') ||
                errorText.toLowerCase().includes('ffmpeg not found') ||
                errorText.toLowerCase().includes('ffmpeg is not installed')) {
                hasError = true;
                errorMessage += `Merge error: ${errorText}. Make sure ffmpeg is installed and in PATH. `;
            }

            // Check if it's downloading video-only (no audio)
            if (errorText.toLowerCase().includes('video only') ||
                errorText.toLowerCase().includes('only video')) {
                if (isDevelopment) {
                    console.warn(`⚠️ Warning: Video-only format detected. Audio may be missing.`);
                }
            }
        });

        // Wait for download to complete
        await new Promise((resolve, reject) => {
            const onClose = () => {
                ytDlp.kill();
                if (fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
                if (isDevelopment) {
                    console.log('🚫 Client disconnected during YouTube download');
                }
                reject(new Error('Client disconnected'));
            };

            req.on('close', onClose);

            ytDlp.on('close', (code) => {
                req.off('close', onClose); // Remove listener so it doesn't fire during streaming

                if (code !== 0 || hasError) {
                    // Clean up temp file on error
                    if (fs.existsSync(tempFilePath)) {
                        try {
                            fs.unlinkSync(tempFilePath);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    }
                    reject(new Error(errorMessage || `yt-dlp exited with code ${code}`));
                } else {
                    resolve();
                }
            });

            ytDlp.on('error', (error) => {
                req.off('close', onClose);

                // Clean up temp file on error
                if (fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
                reject(error);
            });
        });

        // Check if file exists and has content
        if (!fs.existsSync(tempFilePath)) {
            throw new Error('Downloaded file not found');
        }

        const stats = fs.statSync(tempFilePath);
        if (stats.size === 0) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                // Ignore cleanup errors
            }
            throw new Error('Downloaded file is empty');
        }

        // Basic validation: audio-only files are typically much smaller
        // A 1-minute video at 1080p should be at least a few MB
        // If file is suspiciously small, it might be audio-only
        const fileSizeMB = stats.size / 1024 / 1024;
        if (fileSizeMB < 1) { // Less than 1MB
            if (isDevelopment) {
                console.warn(`⚠️ Warning: Downloaded file is very small (${fileSizeMB.toFixed(2)}MB). This might be audio-only.`);
                console.warn('⚠️ Make sure ffmpeg is installed and in PATH for video+audio merging.');
            }
            // Don't fail, but log warning - some short videos might legitimately be small
        }

        if (isDevelopment) {
            console.log(`✅ Download complete: ${fileSizeMB.toFixed(2)}MB`);
            console.log(`📁 File path: ${tempFilePath}`);
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);
        res.setHeader('Content-Length', stats.size);

        // Stream file to response
        const fileStream = fs.createReadStream(tempFilePath);

        fileStream.on('error', (error) => {
            if (isDevelopment) {
                console.error('File stream error:', error);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'File stream error', details: error.message });
            }
            // Clean up temp file
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        });

        fileStream.pipe(res);

        // Clean up temp file after streaming completes
        res.on('finish', () => {
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    if (isDevelopment) {
                        console.log('🧹 Cleaned up temp file');
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        });

        res.on('close', () => {
            if (fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    if (isDevelopment) {
                        console.log('🧹 Cleaned up temp file (connection closed)');
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        });

    } catch (error) {
        // Clean up temp file on any error
        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        if (isDevelopment) {
            console.error('❌ Download error:', error);
        }

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Download failed',
                details: error.message || 'Unknown error occurred'
            });
        }
    }
});

app.listen(PORT, () => {
    if (isDevelopment) {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    }
});
