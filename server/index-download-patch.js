// DOWNLOAD ENDPOINT PATCH - Replace lines 477-525 in server/index.js with this section:

    // Handle YouTube cookies if provided via env var (base64-encoded)
    let cookiesFilePath = null;
    if (process.env.YOUTUBE_COOKIES) {
        try {
            const cookiesContent = Buffer.from(process.env.YOUTUBE_COOKIES, 'base64').toString('utf-8');
            cookiesFilePath = path.join(tempDir, `yt_cookies_${Date.now()}.txt`);
            fs.writeFileSync(cookiesFilePath, cookiesContent);
            console.log(`✓ YouTube cookies file written to: ${cookiesFilePath}`);
        } catch (e) {
            console.warn('Failed to decode YouTube cookies from env var:', e && e.message);
        }
    }

    try {
        // Build base args that both strategies share
        const baseArgs = [
            '--merge-output-format', 'mp4', // Let yt-dlp auto-select best combo
            '--no-check-certificate',
            '--no-playlist',
            '--prefer-free-formats',
            '--no-mtime',
            '--ffmpeg-location', ffmpegLocation,
            '--js-runtimes', 'node:/usr/bin/node', // Explicit path to Node.js for YouTube extraction
            '-o', tempFilePath,
        ];

        // Add cookies if available
        if (cookiesFilePath) {
            baseArgs.push('--cookies', cookiesFilePath);
        }

        // Primary strategy: let yt-dlp choose best format with postprocessor hint
        const primaryArgs = [
            ...baseArgs,
            '--postprocessor-args', 'ffmpeg:-c:v copy -c:a copy',
            videoUrl
        ];

        // Fallback strategy: simpler args without postprocessor
        const fallbackArgs = [
            ...baseArgs,
            videoUrl
        ];

        // Helper that wires request.close handling into the proc lifecycle
        const runWithClientClose = (args) => {
            return new Promise((resolve, reject) => {
                console.log('Spawning yt-dlp with args:', args.join(' '));
                const proc = spawn(ytDlpBinary, args);
                let cleanupOnClose = () => {
                    try { proc.kill(); } catch (e) {}
                    if (fs.existsSync(tempFilePath)) {
                        try { fs.unlinkSync(tempFilePath); } catch (e) {}
                    }
                    // Cleanup cookies file if created
                    if (cookiesFilePath && fs.existsSync(cookiesFilePath)) {
                        try { fs.unlinkSync(cookiesFilePath); } catch (e) {}
                    }
                    reject(new Error('Client disconnected'));
                };

                req.on('close', cleanupOnClose);

                let stderrAccum = '';
                proc.stderr.on('data', (data) => {
                    const text = data.toString();
                    stderrAccum += text;
                    if (isDevelopment) console.log(`yt-dlp: ${text}`);
                });

                proc.on('close', (code) => {
                    req.off('close', cleanupOnClose);
                    if (code !== 0) {
                        const msg = stderrAccum.trim() || `yt-dlp exited with code ${code}`;
                        reject(new Error(msg));
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
            console.log('Starting primary yt-dlp download...');
            await runWithClientClose(primaryArgs);
            console.log('Primary yt-dlp download succeeded');
        } catch (primaryErr) {
            console.warn('Primary yt-dlp attempt failed, trying fallback...', primaryErr && primaryErr.message);
            try {
                console.log('Starting fallback yt-dlp download...');
                await runWithClientClose(fallbackArgs);
                console.log('Fallback yt-dlp download succeeded');
            } catch (fallbackErr) {
                console.error('Both yt-dlp attempts failed:', fallbackErr && fallbackErr.message);
                throw fallbackErr;
            }
        }
