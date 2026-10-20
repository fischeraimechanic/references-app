#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
config();
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { join, basename, extname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

const program = new Command();

program
  .name('add-video')
  .description('Upload a video to the archive (Oracle Object Storage)')
  .argument('<file>', 'Video file path')
  .option('-c, --category <category>', 'Category slug (e.g., housing)')
  .option('-t, --title <title>', 'Video title')
  .option('-d, --description <description>', 'Video description')
  .option('--oci-endpoint <url>', 'OCI Object Storage endpoint')
  .option('--oci-bucket <name>', 'OCI bucket name')
  .option('--oci-access-key <key>', 'OCI access key')
  .option('--oci-secret-key <key>', 'OCI secret key')
  .option('--public-url <url>', 'Public URL for the bucket')
  .parse();

const options = program.opts();
const inputFile = program.args[0];

if (!inputFile) {
  console.error('Error: Video file path is required');
  program.help();
}

if (!existsSync(inputFile)) {
  console.error(`Error: File not found: ${inputFile}`);
  process.exit(1);
}

const category = options.category || 'uncategorized';
const title = options.title || basename(inputFile, extname(inputFile));
const description = options.description || '';

const OCI_ENDPOINT = options.ociEndpoint || process.env.OCI_ENDPOINT;
const OCI_BUCKET = options.ociBucket || process.env.OCI_BUCKET;
const OCI_ACCESS_KEY = options.ociAccessKey || process.env.OCI_ACCESS_KEY;
const OCI_SECRET_KEY = options.ociSecretKey || process.env.OCI_SECRET_KEY;
const PUBLIC_URL = options.publicUrl || process.env.PUBLIC_R2_PUBLIC_URL;

if (!OCI_ENDPOINT || !OCI_BUCKET || !OCI_ACCESS_KEY || !OCI_SECRET_KEY) {
  console.error('Error: Oracle Object Storage credentials required. Set via options or env vars:');
  console.error('  OCI_ENDPOINT, OCI_BUCKET, OCI_ACCESS_KEY, OCI_SECRET_KEY');
  console.error('  Optional: PUBLIC_R2_PUBLIC_URL');
  console.error('\nExample OCI_ENDPOINT:');
  console.error('  https://my-namespace.compat.objectstorage.us-ashburn-1.oraclecloud.com');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: OCI_ENDPOINT,
  credentials: {
    accessKeyId: OCI_ACCESS_KEY,
    secretAccessKey: OCI_SECRET_KEY,
  },
});

const videoId = randomUUID();
const videoExt = '.mp4';
const thumbExt = '.jpg';
const videoFilename = `${videoId}${videoExt}`;
const thumbFilename = `${videoId}${thumbExt}`;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

async function transcodeVideo(input, output) {
  console.log('Transcoding video to H.264 MP4...');
  await runFfmpeg([
    '-y', '-i', input,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    output
  ]);
}

async function generateThumbnail(input, output) {
  console.log('Generating thumbnail from first frame...');
  await runFfmpeg([
    '-y', '-i', input,
    '-vframes', '1',
    '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
    '-q:v', '2',
    output
  ]);
}

async function uploadToOCI(key, filePath, contentType) {
  console.log(`Uploading ${key}...`);
  const fileStream = createReadStream(filePath);
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: OCI_BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
    },
  });
  await upload.done();
}

function loadVideosJson() {
  const path = join(process.cwd(), 'src', 'data', 'videos.json');
  if (!existsSync(path)) {
    return { categories: {}, videos: [] };
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveVideosJson(data) {
  const json = JSON.stringify(data, null, 2);
  const publicPath = join(process.cwd(), 'public', 'videos.json');
  const srcPath = join(process.cwd(), 'src', 'data', 'videos.json');
  writeFileSync(publicPath, json);
  writeFileSync(srcPath, json);
}

async function main() {
  const tempDir = tmpdir();
  const tempVideo = join(tempDir, `video-${videoId}${videoExt}`);
  const tempThumb = join(tempDir, `thumb-${videoId}${thumbExt}`);

  try {
    await transcodeVideo(inputFile, tempVideo);
    await generateThumbnail(inputFile, tempThumb);

    await uploadToOCI(videoFilename, tempVideo, 'video/mp4');
    await uploadToOCI(thumbFilename, tempThumb, 'image/jpeg');

    const data = loadVideosJson();
    
    if (!data.categories[category]) {
      data.categories[category] = {
        title: category.charAt(0).toUpperCase() + category.slice(1),
        description: ''
      };
    }

    data.videos.push({
      id: videoId,
      category,
      title,
      filename: videoFilename,
      thumbnail: thumbFilename,
      description,
      uploadedAt: new Date().toISOString().split('T')[0],
    });

    saveVideosJson(data);

    console.log('\n✅ Upload complete!');
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Category: ${category}`);
    console.log(`   Title: ${title}`);
    console.log(`\nNext steps:`);
    console.log(`  1. git add public/videos.json src/data/videos.json`);
    console.log(`  2. git commit -m "Add video: ${title}"`);
    console.log(`  3. git push`);
    if (PUBLIC_URL) {
      console.log(`\nVideo URL: ${PUBLIC_URL}/${videoFilename}`);
      console.log(`Thumbnail: ${PUBLIC_URL}/${thumbFilename}`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    try { require('fs').unlinkSync(tempVideo); } catch {}
    try { require('fs').unlinkSync(tempThumb); } catch {}
  }
}

main();