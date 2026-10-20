# References

Personal video reference archive. Upload videos, organize by category, share via link.

## Features
- Categories (housing, employment, etc.)
- Oracle Object Storage backend (free tier: 10GB + 10TB/month egress)
- Transcodes to MP4, generates thumbnails
- Static site on Vercel (free)
- Share single videos or entire categories

## Setup

### 1. Oracle Cloud (one-time)
1. Create bucket in Object Storage
2. Generate Customer Secret Key (Access + Secret)
3. Enable public read on bucket
4. Note: Namespace, Region, bucket name

### 2. Environment
```bash
cp .env.example .env
# Edit .env with your Oracle credentials
```

### 3. Vercel
- Import this repo
- Add env var: `PUBLIC_R2_PUBLIC_URL` = your Oracle public bucket URL
- Deploy

## Usage

```bash
# Add a video
npm run add-video ./my-video.mp4 --category housing --title "Apartment tour"

# Deploy
git add src/data/videos.json public/videos.json
git commit -m "Add video: Apartment tour"
git push
```

## Commands
| Command | Action |
|---------|--------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run add-video <file>` | Upload + transcode + register |