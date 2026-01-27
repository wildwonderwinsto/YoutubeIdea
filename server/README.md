# ViralVision Server — Local / Free mode ✅

This server includes fallbacks so the app can run without paid API keys (Gemini / YouTube) and without Whisper installed. It will work with:

- No Gemini API key — a local, heuristic-based analyzer and generator will be used.
- No YouTube API key — a lightweight HTML scraping fallback is used for search and channel lookups (limited data).
- No Whisper installed — transcription is optional and the analyzer will continue with an empty transcript.

How to run locally (no paid services required):

1. Install Node.js (v18+ recommended for built-in fetch)
2. Install Node dependencies:

   cd server
   npm install

3. (Optional) Install Whisper for better transcription:

   # Create a venv and install (Linux / macOS)
   python -m venv .venv
   source .venv/bin/activate
   pip install -U pip
   pip install -U openai-whisper

   # On Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -U pip
   python -m pip install -U openai-whisper

Note: Whisper (and its dependencies such as PyTorch) are optional; if not present the server will skip transcription and continue analysis using heuristics.

Environment variables (optional):

- `YOUTUBE_API_KEY` — set for richer, quota-backed YouTube data (recommended if you have one)
- `GEMINI_API_KEY` — set to use Gemini; otherwise local AI fallbacks will be used
- `PORT` — server port (default: 3000)

Security & Production notes:

- The server rate-limits requests and validates incoming API key formats.
- Fallback scrapers use public YouTube pages and are intentionally conservative — they provide basic functionality without any paid services.
- For production usage, consider adding a DB for job persistence and hardened HTML parsing for YouTube.

If you want help wiring up a free third-party LLM host (Hugging Face or local container), I can add optional integrations that remain free to run locally.

## Troubleshooting npm install (network issues)

- If `npm install` fails with network errors like `ECONNRESET`, try the following commands in PowerShell:
  - `npm config get proxy` and `npm config get https-proxy` (check if a proxy is set)
  - `npm set registry https://registry.npmjs.org/`
  - `npm cache clean --force`
  - `npm install --no-audit --no-fund`

- The server now relies on Node's built-in `fetch` (Node v18+). If you are running an older Node version or prefer to install `node-fetch` manually, run `npm install node-fetch` once your network issue is resolved.

If you want, I can help diagnose your network error — tell me the output of `npm config get proxy` and `npm config get https-proxy` and I’ll suggest the next steps.