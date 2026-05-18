import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const TOKEN_PATH = path.join(DATA_DIR, 'youtube_tokens.json');

function getOAuth2Client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback';

  if (!clientId || !clientSecret) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      oauth2.setCredentials(tokens);
      oauth2.on('tokens', (newTokens) => {
        const current = fs.existsSync(TOKEN_PATH) ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8')) : {};
        const merged = { ...current, ...newTokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
      });
      return oauth2;
    }
  } catch {}

  return null;
}

export function getAuthUrl() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback';

  if (!clientId || !clientSecret) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
  ];

  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true
  });
}

export async function handleCallback(code) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback';

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2.getToken(code);

  if (!fs.existsSync(path.dirname(TOKEN_PATH))) {
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  return tokens;
}

export function isAuthenticated() {
  return getOAuth2Client() !== null;
}

export async function uploadVideo({ videoPath, title, description, tags, thumbnailPath }) {
  const auth = getOAuth2Client();
  if (!auth) throw new Error('YouTube not authenticated');

  const youtube = google.youtube({ version: 'v3', auth });

  const videoMetadata = {
    snippet: {
      title,
      description: description || '',
      tags: tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [],
      categoryId: '28'
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
      embeddable: true
    }
  };

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: videoMetadata,
    media: {
      body: fs.createReadStream(videoPath)
    }
  });

  const videoId = res.data.id;
  const youtubeUrl = `https://youtube.com/shorts/${videoId}`;

  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          body: fs.createReadStream(thumbnailPath)
        }
      });
    } catch (err) {
      console.error('Thumbnail upload failed:', err.message);
    }
  }

  return { videoId, youtubeUrl };
}

export async function getChannelInfo() {
  const auth = getOAuth2Client();
  if (!auth) return null;

  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.channels.list({
    part: 'snippet,statistics',
    mine: true
  });

  if (!res.data.items?.length) return null;
  const channel = res.data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url,
    subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
    viewCount: parseInt(channel.statistics.viewCount || '0'),
    videoCount: parseInt(channel.statistics.videoCount || '0')
  };
}

export async function getAnalyticsMetrics(dimensions = 'day', startDate = '2025-01-01', endDate = '2026-12-31') {
  const auth = getOAuth2Client();
  if (!auth) return null;

  const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

  try {
    const res = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares',
      dimensions
    });
    return res.data;
  } catch (err) {
    console.error('Analytics query failed:', err.message);
    return null;
  }
}

export async function getChannelVideos(maxResults = 50) {
  const auth = getOAuth2Client();
  if (!auth) return [];

  const youtube = google.youtube({ version: 'v3', auth });

  try {
    const channelRes = await youtube.channels.list({ part: 'contentDetails', mine: true });
    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) return [];

    const playlistRes = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults
    });

    const videoIds = playlistRes.data.items?.map(item => item.contentDetails.videoId).filter(Boolean) || [];

    if (videoIds.length === 0) return [];

    const videosRes = await youtube.videos.list({
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(',')
    });

    return videosRes.data.items?.map(v => ({
      id: v.id,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      publishedAt: v.snippet.publishedAt,
      duration: v.contentDetails?.duration || '',
      views: parseInt(v.statistics?.viewCount || '0'),
      likes: parseInt(v.statistics?.likeCount || '0'),
      comments: parseInt(v.statistics?.commentCount || '0')
    })) || [];
  } catch (err) {
    console.error('Failed to fetch channel videos:', err.message);
    return [];
  }
}

export async function getVideoStats() {
  const auth = getOAuth2Client();
  if (!auth) return [];

  const youtube = google.youtube({ version: 'v3', auth });
  try {
    const res = await youtube.videos.list({
      part: 'statistics',
      mine: true,
      maxResults: 50
    });
    return res.data.items || [];
  } catch {
    return [];
  }
}