# References Project - Agent Instructions

## Development
```bash
npm run dev          # Start dev server (localhost:4321)
npm run build        # Build to dist/
npm run add-video    # Upload video to Oracle Object Storage
```

## Key Files
- `src/pages/index.astro` - Category grid
- `src/pages/category/[slug].astro` - Video grid per category
- `src/components/VideoPlayer.astro` - HTML5 video player
- `src/lib/data.ts` - Loads videos.json at build time
- `src/data/videos.json` - Source of truth for metadata
- `scripts/upload-video.js` - Upload script (Oracle OCI)

## Data Schema (videos.json)
```json
{
  "categories": {
    "housing": { "title": "Housing References", "description": "..." }
  },
  "videos": [
    { "id": "uuid", "category": "housing", "title": "...", "filename": "uuid.mp4", "thumbnail": "uuid.jpg", "description": "...", "uploadedAt": "2026-10-20" }
  ]
}
```

## Deploy
1. Push to GitHub → auto-deploys on Vercel
2. Vercel needs `PUBLIC_R2_PUBLIC_URL` env var

## Adding Videos
```bash
npm run add-video ./file.mp4 --category housing --title "Title"
git add src/data/videos.json public/videos.json
git commit -m "Add video: Title"
git push
```