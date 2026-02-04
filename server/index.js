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

// When running behind a proxy (Render, Vercel), trust the proxy so
// express-rate-limit can identify client IPs correctly from X-Forwarded-For
app.set('trust proxy', true);

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

    // Log which yt-dlp binary we're planning to use (always log for visibility in production)
    console.log(`Using yt-dlp binary at: ${ytDlpBinary} (platform: ${platform})`);

    // If the packaged binary is missing (possible in some build flows), fall back to system binaries
    try {
        const { existsSync } = require('fs');
        if (!existsSync(ytDlpBinary)) {
            console.warn(`Packaged yt-dlp binary not found at ${ytDlpBinary}. Falling back to system 'yt-dlp' or 'youtube-dl'.`);
            // Prefer 'yt-dlp' in PATH, otherwise try 'youtube-dl'
            ytDlpBinary = 'yt-dlp';
            const which = require('child_process').spawnSync('which', [ytDlpBinary]);
            if (which.status !== 0) {
                ytDlpBinary = 'youtube-dl';
                console.warn("'yt-dlp' not found in PATH, falling back to 'youtube-dl'.");
            } else {
                console.log("Using 'yt-dlp' from PATH.");
            }
        }
    } catch (e) {
        console.warn('Error detecting yt-dlp binary fallback:', e && e.message);
    }

    // Determine ffmpeg binary location. Prefer bundled ffmpeg-static, fall back to system ffmpeg.
    let ffmpegLocation = 'ffmpeg';
    try {
        const ffmpegStatic = require('ffmpeg-static');
        if (ffmpegStatic) ffmpegLocation = ffmpegStatic;
    } catch (e) {
        // ffmpeg-static not available; we'll rely on system ffmpeg
    }

    // Helper to run yt-dlp with given args and capture stderr for error analysis
    const runYtDlp = (args) => {
        return new Promise((resolve, reject) => {
            const proc = spawn(ytDlpBinary, args);
            let hasError = false;
            let errorMessage = '';

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                if (isDevelopment) console.log(`yt-dlp: ${text}`);

                if (text.toLowerCase().includes('downloaded file is empty') || text.toLowerCase().includes('file is empty')) {
                    hasError = true;
                    errorMessage += 'Downloaded file is empty. This usually means no format matched the selector. ';
                }

                if (text.toLowerCase().includes('error') || text.toLowerCase().includes('unable') || text.toLowerCase().includes('failed') || text.toLowerCase().includes('unavailable')) {
                    hasError = true;
                    errorMessage += text;
                }
            });

            proc.on('close', (code) => {
                if (code !== 0 || hasError) {
                    reject(new Error(errorMessage || `yt-dlp exited with code ${code}`));
                } else {
                    resolve();
                }
            });

            proc.on('error', (err) => reject(err));
        });
    };

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
        // Primary strategy: bestvideo+bestaudio (merged by ffmpeg). Fallback: progressive 'best' format.
        const primaryArgs = [
            '-f', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--no-check-certificate',
            '--no-playlist',
            '--prefer-free-formats',
            '--no-mtime', // Don't set file modification time
            '--postprocessor-args', 'ffmpeg:-c:v copy -c:a copy', // Copy streams without re-encoding (faster)
            '--ffmpeg-location', ffmpegLocation,
            '-o', tempFilePath, // Output to temp file
            videoUrl
        ];

        const fallbackArgs = [
            '-f', 'best',
            '--no-check-certificate',
            '--no-playlist',
            '--no-mtime',
            '--ffmpeg-location', ffmpegLocation,
            '-o', tempFilePath,
            videoUrl
        ];

        // Helper that wires request.close handling into the proc lifecycle
        const runWithClientClose = (args) => {
            return new Promise((resolve, reject) => {
                const proc = spawn(ytDlpBinary, args);
                let cleanupOnClose = () => {
                    try { proc.kill(); } catch (e) {}
                    if (fs.existsSync(tempFilePath)) {
                        try { fs.unlinkSync(tempFilePath); } catch (e) {}
                    }
                    reject(new Error('Client disconnected'));
                };

                req.on('close', cleanupOnClose);

                proc.stderr.on('data', (data) => {
                    if (isDevelopment) console.log(`yt-dlp: ${data.toString()}`);
                });

                proc.on('close', (code) => {
                    req.off('close', cleanupOnClose);
                    if (code !== 0) {
                        reject(new Error(`yt-dlp exited with code ${code}`));
                    } else {
                        resolve();
                    }
                });

                proc.on('error', (err) => {
                    req.off('close', cleanupOnClose);
                    reject(err);
                });
            });
        };

        // Try primary, then fallback on failure
        try {
            console.log('Starting primary yt-dlp download (bestvideo+bestaudio)...');
            await runWithClientClose(primaryArgs);
            console.log('Primary yt-dlp download succeeded');
        } catch (primaryErr) {
            console.warn('Primary yt-dlp attempt failed, trying fallback (best)...', primaryErr && primaryErr.message);
            try {
                console.log('Starting fallback yt-dlp download (best progressive)...');
                await runWithClientClose(fallbackArgs);
                console.log('Fallback yt-dlp download succeeded');
            } catch (fallbackErr) {
                console.error('Both yt-dlp attempts failed:', fallbackErr && fallbackErr.message);
                throw fallbackErr;
            }
        }

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

        // Always log download errors for production visibility
        console.error('❌ Download error:', error && (error.stack || error.message || error));

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Download failed',
                details: (error && (error.message || String(error))) || 'Unknown error occurred'
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
