const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// Simple in-memory job store (TODO: upgrade to database for persistence)
const jobs = new Map();

function generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function processVideo(jobId, videoPath) {
    try {
        updateJobStatus(jobId, { status: 'processing', progress: 5, step: 'Validating video' });

        // 1. Get video duration first
        const duration = await getVideoDuration(videoPath);
        updateJobStatus(jobId, { status: 'processing', progress: 10, step: 'Extracting audio', duration });

        // 2. Extract audio
        const audioPath = await extractAudio(videoPath);
        updateJobStatus(jobId, { status: 'processing', progress: 20, step: 'Transcribing with Whisper (this takes 10-20 min)' });

        // 3. Transcribe with Whisper (Python API)
        const transcript = await transcribeWithWhisper(audioPath);
        updateJobStatus(jobId, { status: 'processing', progress: 60, step: 'Detecting scene changes' });

        // 4. Detect scenes
        const scenes = await detectScenes(videoPath);
        updateJobStatus(jobId, { status: 'processing', progress: 75, step: 'Analyzing audio features' });

        // 5. Audio analysis with silence detection
        const audioFeatures = await analyzeAudioFeatures(videoPath);
        updateJobStatus(jobId, { status: 'processing', progress: 85, step: 'Running AI analysis with Gemini' });

        // 6. Analyze with Gemini
        const { buildAnalysisPrompt } = require('./prompts/video-analysis-prompt');
        const prompt = buildAnalysisPrompt({
            transcript,
            scenes,
            audioFeatures,
            duration
        });

        const analysis = await analyzeWithGemini(prompt);
        updateJobStatus(jobId, { status: 'complete', progress: 100, result: analysis });

        // Cleanup temporary files
        await fs.unlink(videoPath).catch(() => { });
        await fs.unlink(audioPath).catch(() => { });

    } catch (error) {
        console.error(`Job ${jobId} failed:`, error);
        updateJobStatus(jobId, {
            status: 'error',
            error: error.message,
            errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Cleanup on error
        await fs.unlink(videoPath).catch(() => { });
    }
}

async function extractAudio(videoPath) {
    // FIX: Ensure output path has .wav extension
    // If no extension exists, append .wav; otherwise replace extension
    const audioPath = videoPath.includes('.')
        ? videoPath.replace(/\.[^.]+$/, '.wav')
        : videoPath + '.wav';

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
            '-i', videoPath,
            '-vn', // no video
            '-acodec', 'pcm_s16le',
            '-ar', '16000', // 16kHz sample rate for speech
            '-ac', '1', // mono
            '-y', // overwrite output file if it exists
            audioPath
        ]);

        let stderrOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            stderrOutput += data.toString();
            // Log progress if needed
            if (process.env.NODE_ENV === 'development') {
                console.log('FFmpeg audio:', data.toString());
            }
        });

        ffmpeg.on('close', code => {
            if (code === 0) {
                resolve(audioPath);
            } else {
                reject(new Error(`FFmpeg audio extraction failed with code ${code}: ${stderrOutput}`));
            }
        });

        ffmpeg.on('error', (err) => {
            reject(new Error(`FFmpeg spawn error: ${err.message}`));
        });
    });
}

async function transcribeWithWhisper(audioPath) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        // Call Python script that uses Whisper API
        // Use 'python' instead of 'python3' for Windows compatibility
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

        const whisper = spawn(pythonCommand, [
            path.join(__dirname, 'whisper_transcribe.py'),
            audioPath,
            'base' // model size
        ]);

        whisper.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        whisper.stderr.on('data', (data) => {
            stderr += data.toString();
            // Log progress
            if (process.env.NODE_ENV === 'development') {
                console.log('Whisper:', data.toString());
            }
        });

        whisper.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Whisper failed with code ${code}: ${stderr}`));
            }

            try {
                const result = JSON.parse(stdout);

                if (result.error) {
                    return reject(new Error(result.error));
                }

                // Return segments array
                resolve(result.segments || []);
            } catch (err) {
                reject(new Error(`Failed to parse Whisper output: ${err.message}`));
            }
        });

        whisper.on('error', reject);
    });
}

async function detectScenes(videoPath) {
    return new Promise((resolve, reject) => {
        const scenes = [];

        const ffmpeg = spawn(ffmpegPath, [
            '-i', videoPath,
            '-filter:v', 'select=gt(scene\\,0.4),showinfo',
            '-f', 'null',
            '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            // Parse scene change timestamps
            const matches = output.matchAll(/pts_time:([\d.]+)/g);

            for (const match of matches) {
                const time = parseFloat(match[1]);
                if (time > 0 && !scenes.includes(time)) {
                    scenes.push(time);
                }
            }
        });

        ffmpeg.on('close', () => {
            resolve(scenes.sort((a, b) => a - b));
        });

        ffmpeg.on('error', reject);
    });
}

async function analyzeAudioFeatures(videoPath) {
    // Run two analyses in parallel: volume detection and silence detection
    const [volumeData, silenceData] = await Promise.all([
        getVolumeStats(videoPath),
        detectSilence(videoPath)
    ]);

    return {
        ...volumeData,
        ...silenceData
    };
}

async function getVolumeStats(videoPath) {
    return new Promise((resolve, reject) => {
        let volumeData = '';

        const ffmpeg = spawn(ffmpegPath, [
            '-i', videoPath,
            '-af', 'volumedetect',
            '-f', 'null',
            '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            volumeData += data.toString();
        });

        ffmpeg.on('close', () => {
            const meanVolume = volumeData.match(/mean_volume: ([-\d.]+) dB/)?.[1];
            const maxVolume = volumeData.match(/max_volume: ([-\d.]+) dB/)?.[1];

            resolve({
                meanVolume: parseFloat(meanVolume) || -20,
                maxVolume: parseFloat(maxVolume) || 0
            });
        });

        ffmpeg.on('error', reject);
    });
}

async function detectSilence(videoPath) {
    return new Promise((resolve, reject) => {
        let silenceData = '';
        const silenceRanges = [];

        // Detect silence: noise threshold -40dB, min duration 0.5s
        const ffmpeg = spawn(ffmpegPath, [
            '-i', videoPath,
            '-af', 'silencedetect=noise=-40dB:d=0.5',
            '-f', 'null',
            '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            silenceData += data.toString();
        });

        ffmpeg.on('close', () => {
            // Parse silence_start and silence_end
            const startMatches = silenceData.matchAll(/silence_start: ([\d.]+)/g);
            const endMatches = silenceData.matchAll(/silence_end: ([\d.]+)/g);

            const starts = [...startMatches].map(m => parseFloat(m[1]));
            const ends = [...endMatches].map(m => parseFloat(m[1]));

            for (let i = 0; i < starts.length && i < ends.length; i++) {
                silenceRanges.push({
                    start: starts[i],
                    end: ends[i],
                    duration: ends[i] - starts[i]
                });
            }

            resolve({
                hasSilence: silenceRanges.length > 0,
                silenceRanges,
                totalSilenceDuration: silenceRanges.reduce((sum, r) => sum + r.duration, 0)
            });
        });

        ffmpeg.on('error', reject);
    });
}

async function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn(ffprobePath, [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`ffprobe failed with code ${code}`));
            }
            resolve(parseFloat(output.trim()));
        });

        ffprobe.on('error', reject);
    });
}

async function analyzeWithGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    const fetchWithRetry = async (url, options, retries = 5, backoff = 2000) => {
        try {
            const response = await fetch(url, options);

            if (response.status === 429) {
                if (retries <= 0) return response;

                let waitTime = backoff;
                try {
                    // Try to parse retry delay from error body
                    const errorBody = await response.clone().json();
                    const details = errorBody.error?.details || [];
                    const retryInfo = details.find(d => d['@type']?.includes('RetryInfo'));

                    if (retryInfo?.retryDelay) {
                        const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
                        if (!isNaN(seconds)) {
                            console.log(`Gemini requested wait time: ${seconds}s`);
                            waitTime = Math.ceil(seconds * 1000) + 2000; // Add 2s buffer
                        }
                    }
                } catch (e) {
                    // Ignore parsing error, stick to exponential backoff
                }

                console.log(`Gemini 429 (Rate Limit), retrying in ${waitTime}ms... (Retries left: ${retries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return fetchWithRetry(url, options, retries - 1, waitTime > backoff ? backoff : backoff * 2);
            }

            return response;
        } catch (error) {
            if (retries > 0) {
                console.log(`Fetch error: ${error.message}, retrying in ${backoff}ms...`);
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
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json'
                }
            })
        },
        5, // Max retries
        5000 // Initial backoff
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Gemini API failed: ${response.status} ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No response from Gemini');
    }

    // Parse JSON response
    try {
        return JSON.parse(text);
    } catch (err) {
        // If JSON parse fails, try to extract JSON from markdown code blocks
        const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/) || text.match(/```\n([\s\S]+?)\n```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }
        throw new Error(`Failed to parse Gemini response as JSON: ${err.message}`);
    }
}

function updateJobStatus(jobId, update) {
    const current = jobs.get(jobId) || {};
    jobs.set(jobId, {
        ...current,
        ...update,
        updatedAt: new Date().toISOString()
    });
}

function getJobStatus(jobId) {
    return jobs.get(jobId) || { status: 'not_found' };
}

// Cleanup old jobs (older than 24 hours)
setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobs.entries()) {
        const updatedAt = new Date(job.updatedAt).getTime();
        if (now - updatedAt > 24 * 60 * 60 * 1000) {
            jobs.delete(jobId);
        }
    }
}, 60 * 60 * 1000); // Run every hour

module.exports = {
    processVideo,
    generateJobId,
    getJobStatus,
    updateJobStatus
};
