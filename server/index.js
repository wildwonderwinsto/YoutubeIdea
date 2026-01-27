require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { processVideo, generateJobId, getJobStatus } = require('./video-analyzer');

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
    if (q && (typeof q !== 'string' || q.trim().length < 1 || q.length > 200)) {
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
const proxyYouTubeRequest = async (endpoint, req, res) => {
    // Priority: 1. User-provided key (Header) 2. Server env key
    // Validate user key format to prevent injection attacks
    const userKey = req.headers['x-youtube-api-key'];
    let apiKey;

    if (userKey) {
        // YouTube API keys are typically 39 characters: AIza + 35 alphanumeric/underscore/hyphen
        // Example: AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI
        if (typeof userKey === 'string' && /^AIza[A-Za-z0-9_-]{35}$/.test(userKey)) {
            apiKey = userKey;
        } else {
            return res.status(400).json({ error: 'Invalid API key format' });
        }
    } else {
        apiKey = process.env.YOUTUBE_API_KEY;
    }

    if (!apiKey) {
        // No YouTube API key configured: use a public HTML-scraping fallback for basic searches
        try {
            const { youtubeSearchFallback, youtubeChannelFallback } = require('./local-fallbacks');

            // Basic routing based on endpoint
            if (endpoint === 'search') {
                const q = req.query.q;
                if (!q) return res.status(400).json({ error: 'Missing query (q)' });
                const data = await youtubeSearchFallback(q, req.query);
                return res.json(data);
            }

            if (endpoint === 'channels') {
                const id = req.query.id || req.query.forHandle;
                if (!id) return res.status(400).json({ error: 'Missing channel id' });
                const data = await youtubeChannelFallback(id);
                return res.json(data);
            }

            // For other endpoints we return a helpful message indicating limited support
            return res.status(501).json({ error: 'YouTube API key not configured: limited fallback available for search and channels only' });
        } catch (err) {
            console.error('YouTube fallback error:', err);
            return res.status(500).json({ error: 'Server configuration error: YouTube API key missing and fallback failed' });
        }
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
    // Priority: 1. User-provided key (Header) 2. Server env key
    // Validate user key format to prevent injection attacks
    const userKey = req.headers['x-gemini-api-key'];
    let apiKey;

    if (userKey) {
        // Gemini API keys follow same format as YouTube (both are Google APIs)
        if (typeof userKey === 'string' && /^AIza[A-Za-z0-9_-]{35}$/.test(userKey)) {
            apiKey = userKey;
        } else {
            return res.status(400).json({ error: 'Invalid API key format' });
        }
    } else {
        apiKey = process.env.GEMINI_API_KEY;
    }

    const { prompt, enableSearch } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Invalid prompt' });
    }

    if (!apiKey) {
        // Use a local fallback implementation when Gemini key is not provided
        try {
            const { localGeminiFallback } = require('./local-fallbacks');
            const data = localGeminiFallback(prompt, enableSearch);
            return res.json(data);
        } catch (err) {
            console.error('Local Gemini fallback failed:', err);
            return res.status(500).json({ error: 'Gemini API key not configured and local fallback failed' });
        }
    }

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    };

    if (enableSearch) {
        requestBody.tools = [{ googleSearch: {} }];
    }

    try {
        // Retry logic for rate limits (429)
        const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
            try {
                const response = await fetch(url, options);

                if (response.status === 429 && retries > 0) {
                    console.log(`Gemini 429 (Rate Limit), retrying in ${backoff}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }

                return response;
            } catch (error) {
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                throw error;
            }
        };

        const response = await fetchWithRetry(
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
app.get('/api/youtube/videos', (req, res) => proxyYouTubeRequest('videos', req, res));
app.get('/api/youtube/channels', (req, res) => proxyYouTubeRequest('channels', req, res));
app.get('/api/youtube/playlistItems', (req, res) => proxyYouTubeRequest('playlistItems', req, res));

// YouTube Autocomplete Proxy (No API Key needed)
app.get('/api/youtube/autocomplete', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json({ suggestions: [] });

    // YouTube's autocomplete API
    const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const text = await response.text();

        // Parse JSONP response: window.google.ac.h(["query", [["suggestion", 0], ...]])
        // We need to extract the array inside the callback
        const jsonStr = text.replace(/^[^[]*/, '').replace(/[^]]*$/, '');
        const json = JSON.parse(jsonStr);
        const suggestions = json[1].map(item => item[0]);

        res.json({ suggestions });
    } catch (error) {
        console.error('Autocomplete fetch failed:', error);
        res.status(500).json({ error: 'Autocomplete fetch failed' });
    }
});

// Video Analyzer Endpoints
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only video files allowed (.mp4, .mov, .avi, .mkv, .webm)'));
        }
    }
});

app.post('/api/analyze/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
    }

    const jobId = generateJobId();
    const videoPath = req.file.path;

    if (isDevelopment) {
        console.log(`📹 Video upload: ${req.file.originalname} (${req.file.size} bytes) -> Job ${jobId}`);
    }

    // Start async processing
    processVideo(jobId, videoPath).catch(err => {
        console.error('🚨 Processing failed:', err);
    });

    res.json({ jobId, status: 'processing' });
});

app.get('/api/analyze/status/:jobId', (req, res) => {
    const status = getJobStatus(req.params.jobId);
    res.json(status);
});

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ViralVision Server (with Proxy) is Running 🚀' });
});

app.get('/health', (req, res) => {
    const hasYoutubeKey = !!process.env.YOUTUBE_API_KEY;
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    const warnings = [];
    if (!hasYoutubeKey) warnings.push('YouTube API key not configured - running in limited fallback mode');
    if (!hasGeminiKey) warnings.push('Gemini API key not configured - using local fallback for AI');

    res.json({
        status: warnings.length ? 'healthy (limited)' : 'healthy',
        service: 'viral-vision-server',
        timestamp: new Date().toISOString(),
        apis: {
            youtube: hasYoutubeKey ? 'configured' : 'missing (fallback)',
            gemini: hasGeminiKey ? 'configured' : 'missing (local fallback)'
        },
        warnings
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

const server = app.listen(PORT, () => {
    if (isDevelopment) {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    }
});

// Handle server errors gracefully (e.g., EADDRINUSE when port is already in use)
server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Another server may be running. Use a different PORT or stop the conflicting process.`);
        if (isDevelopment) {
            console.error('Tip: run `npx kill-port ' + PORT + '` or stop the other process and restart.');
        }
        process.exit(1);
    }

    console.error('Server error:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.close(() => process.exit(0));
});
