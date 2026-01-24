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
a
```bash
cd viral-vision
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

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `VITE_YOUTUBE_API_KEY`
   - `VITE_GEMINI_API_KEY`
4. Deploy

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
