const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// ... (rest of imports)

async function extractAudio(videoPath) {
    const audioPath = videoPath.replace(/\.[^.]+$/, '.wav');

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
            '-i', videoPath,
            '-vn', // no video
            '-acodec', 'pcm_s16le',
            '-ar', '16000', // 16kHz sample rate for speech
            '-ac', '1', // mono
            audioPath
        ]);

        ffmpeg.stderr.on('data', (data) => {
            // Log progress if needed
            if (process.env.NODE_ENV === 'development') {
                console.log('FFmpeg audio:', data.toString());
            }
        });

        ffmpeg.on('close', code => {
            if (code === 0) resolve(audioPath);
            else reject(new Error(`FFmpeg audio extraction failed with code ${code}`));
        });

        ffmpeg.on('error', reject);
    });
}

async function transcribeWithWhisper(audioPath) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        // Call Python script that uses Whisper API
        const whisper = spawn('python3', [
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

        const ffmpeg = spawn('ffmpeg', [
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

        const ffmpeg = spawn('ffmpeg', [
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

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json' // Request JSON response
                }
            })
        }
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
