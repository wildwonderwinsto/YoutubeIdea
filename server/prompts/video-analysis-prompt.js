const ANALYSIS_PROMPT = `You are an expert YouTube content strategist. Analyze this video data and provide specific, actionable feedback.

**VIDEO DATA:**

TRANSCRIPT:
{transcript}

SCENES (timestamps in seconds):
{scenes}

AUDIO:
- Mean volume: {meanVolume} dB
- Max volume: {maxVolume} dB  
- Has silence: {hasSilence}
- Total duration: {duration}s

**YOUR ANALYSIS:**

Provide a JSON response with this EXACT structure (no markdown, no backticks):

{
  "biggestProblem": "One sentence describing the main issue holding this video back",
  "viralScore": 75,
  "subscores": {
    "hook": { "score": 8, "why": "Brief explanation" },
    "pacing": { "score": 7, "why": "Brief explanation" },
    "visualVariety": { "score": 6, "why": "Brief explanation" },
    "emotionalImpact": { "score": 7, "why": "Brief explanation" },
    "clarity": { "score": 9, "why": "Brief explanation" },
    "ctas": { "score": 5, "why": "Brief explanation" }
  },
  "editPlan": [
    {
      "timestamp": "[0:00-0:15]",
      "action": "Cut the intro to 10 seconds",
      "visual": "Add text overlay with video hook",
      "audio": "Boost music by 3dB, duck when speaking",
      "goal": "Grab attention in first 3 seconds"
    }
  ],
  "packaging": {
    "titles": [
      "Title idea 1 (curiosity-driven)",
      "Title idea 2 (benefit-focused)",
      "Title idea 3 (controversial angle)"
    ],
    "thumbnails": [
      "Concept 1: Close-up face with surprised expression, bright red background",
      "Concept 2: Before/after split screen with bold text overlay"
    ],
    "audience": ["Target demographic 1", "Target demographic 2", "Target demographic 3"]
  },
  "checklist": [
    "Check 1",
    "Check 2",
    "Check 3",
    "Check 4",
    "Check 5"
  ]
}

CRITICAL RULES:
1. Scores are 0-10 (subscores) or 0-100 (viral score)
2. Edit plan should have 5-8 actionable items covering the full video
3. Be specific with timestamps
4. Focus on retention, pacing, and emotional impact
5. Respond with ONLY valid JSON - no explanatory text outside the JSON object`;

function buildAnalysisPrompt(data) {
  const transcriptText = data.transcript && data.transcript.length > 0
    ? data.transcript.map(seg => `[${seg.start.toFixed(1)}s] ${seg.text}`).join('\n')
    : 'No transcript available (silent video or transcription failed)';

  const scenesText = data.scenes && data.scenes.length > 0
    ? data.scenes.map(s => s.toFixed(1)).join(', ')
    : 'No scene changes detected';

  return ANALYSIS_PROMPT
    .replace('{transcript}', transcriptText)
    .replace('{scenes}', scenesText)
    .replace('{meanVolume}', data.audioFeatures?.meanVolume?.toFixed(1) || 'N/A')
    .replace('{maxVolume}', data.audioFeatures?.maxVolume?.toFixed(1) || 'N/A')
    .replace('{hasSilence}', data.audioFeatures?.hasSilence ? 'Yes' : 'No')
    .replace('{duration}', data.duration?.toFixed(1) || '0');
}

module.exports = { buildAnalysisPrompt };
