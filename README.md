# ViralVision

Find your next viral video idea by discovering trending content from small channels with high viral potential.

## Features

- **Smart Niche Analysis**: Search by keyword or paste your YouTube channel URL for automatic niche detection
- **Viral Scoring Algorithm**: Proprietary scoring based on AVD estimates, engagement, recency, and small-channel bias
- **4-Tab Dashboard**:
  - **Leaderboard**: Top trending videos ranked by viral potential
  - **Outlier Radar**: Small channels (<5k subs) with explosive growth
  - **Graph View**: Visual analysis of video length vs. retention tier
  - **Strategy Feed**: AI-powered explanations of why videos went viral
- **AI-Powered Insights**: Gemini-generated "Next Video Idea" recommendations
- **Local Storage**: Save up to 50 video ideas (stored in your browser)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn-ui (Radix UI + Tailwind CSS)
- **Charts**: Recharts
- **APIs**: YouTube Data API v3, Google Gemini 1.5 Pro
- **Hosting**: Vercel (recommended)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Get API Keys

#### YouTube Data API v3
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Copy the API key

#### Google Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Copy the API key

### 3. Configure Server Environment Variables

Create a `.env` file in the **server** directory:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and add your keys:

```env
NODE_ENV=development
PORT=3000
YOUTUBE_API_KEY=your_youtube_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ALLOWED_ORIGINS=http://localhost:5173
```

### 4. Run Servers

You need to run both the backend (for API proxy & downloads) and frontend (for UI).

**Terminal 1 (Backend):**
```bash
cd server
npm install
npm start
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.
The backend runs at `http://localhost:3000`.

### 5. Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
```

## Deployment

### Backend Deployment (Render with Docker)

The backend requires `ffmpeg` and `yt-dlp` for video downloads. We use Docker to ensure these are installed.

**Prerequisites:**
- A `server/Dockerfile` is provided in this repo
- GitHub repository connected to Render

**Steps:**

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign up
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. **Configuration:**
   - **Name**: `viralvision-api` (or your choice)
   - **Root Directory**: `server` ⚠️ (Critical!)
   - **Runtime**: **Docker**
   - **Instance Type**: Free (or paid for better performance)
5. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   YOUTUBE_API_KEY=<your_youtube_api_key>
   GEMINI_API_KEY=<your_gemini_api_key>
   ALLOWED_ORIGINS=* (temporarily, will update after frontend deploy)
   ```
6. Click **Create Web Service**
7. **Note your backend URL** (e.g., `https://viralvision-api.onrender.com`)

> **Note**: Free tier "sleeps" after 15 minutes of inactivity. First request may take ~50 seconds to wake up.

### Frontend Deployment (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click **Add New...** → **Project**
3. Import your GitHub repository
4. **Configuration:**
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
5. **Environment Variables:**
   - **Key**: `VITE_BACKEND_URL`
   - **Value**: Your Render URL (e.g., `https://viralvision-api.onrender.com`)
     - ⚠️ No trailing slash!
6. Click **Deploy**
7. **Note your frontend URL** (e.g., `https://wildwonderwinsto.vercel.app`)

### Final Step: Update CORS

1. Go back to **Render Dashboard** → Your service → **Environment**
2. Edit `ALLOWED_ORIGINS`
3. Change from `*` to your Vercel URL (e.g., `https://wildwonderwinsto.vercel.app`)
4. Save (Render will auto-redeploy)

### Verify Deployment

- **Backend Health**: Visit `https://your-backend.onrender.com/health`
  - Should return: `{"status":"healthy","apis":{"youtube":"configured","gemini":"configured"}}`
- **Frontend**: Visit your Vercel URL and try a search

**Important:** The download feature requires `ffmpeg` (included in Docker) but may have limitations on free tier storage.

**Important:** The download server requires `ffmpeg` to be installed on the system for merging video and audio streams. Install it from [ffmpeg.org](https://ffmpeg.org/download.html) or via package manager:

- Windows: `choco install ffmpeg` or download from website
- macOS: `brew install ffmpeg`
- Linux: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/CentOS)

## Usage

### Search by Niche

1. Enter a niche keyword (e.g., "Fortnite montages")
2. Click "Analyze Trends"
3. Browse the ranked videos and insights

### Channel URL Analysis

1. Paste your YouTube channel URL
2. The app will automatically detect your niche
3. Get personalized trending recommendations

### Saving Ideas

- Click "Save" on any video card
- Access saved ideas via the "Saved Ideas" button in the header
- Limit: 50 saved ideas (auto-deletes oldest when full)

## Important Notes

### Content Safety

The app blocks analysis of:

- NSFW/adult content
- Hate speech or extremist content
- Dangerous challenges
- Medical or financial "get rich quick" schemes

### Data Accuracy

- **AVD Tiers** are AI estimates based on public signals (not official YouTube data)
- **Swipe rate/completion rate** is estimated from view velocity and engagement
- Always verify data and add your own creative spin to recommendations

### API Quotas

- **YouTube API**: 10,000 units/day (free tier)
- **Gemini API**: Current free tier limits
- The app caches results to minimize API usage

### Privacy

- Saved ideas are stored **locally in your browser only**
- Data may be lost if you clear browser storage
- No server-side storage or user accounts in V1

## Troubleshooting

### "YouTube API key not configured"

- Make sure your `.env` file exists and contains `VITE_YOUTUBE_API_KEY`
- Restart the dev server after adding environment variables

### "Daily limit reached"

- You've hit the YouTube API quota (10,000 units/day)
- Wait 24 hours or implement result caching

### "Channel not found"

- The channel may be private or have no public videos
- Try entering your niche manually instead

### No videos showing

- The niche may be too specific—try a broader keyword
- Click example niches to test the app functionality

## License

MIT License - feel free to use for personal or commercial projects.

## Credits

Built with:

- [React](https://react.dev/)
- [shadcn-ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
- [Radix UI](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)
