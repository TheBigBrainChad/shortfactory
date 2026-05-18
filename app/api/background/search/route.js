import { NextResponse } from 'next/server';
import { authenticate } from '../../../../lib/auth.js';

export async function GET(request) {
  const user = authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'gameplay';

    const searchQuery = `${query} ${category} background no commentary site:youtube.com OR site:youtu.be`;

    const braveKey = process.env.BRAVE_API_KEY || '';
    if (!braveKey) return NextResponse.json({ error: 'Brave API key not configured' }, { status: 400 });

    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=12&search_lang=en`,
      { headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey } }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Brave API error: ${res.status}`, details: text }, { status: res.status });
    }

    const data = await res.json();
    const results = (data.web?.results || [])
      .filter(r => r.url && (r.url.includes('youtube.com/watch') || r.url.includes('youtu.be/')))
      .map(r => {
        let videoId = '';
        try {
          const url = new URL(r.url);
          videoId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop() || '';
        } catch {
          videoId = r.url.split('/').pop()?.split('?')[0] || '';
        }
        if (videoId.length > 11) videoId = videoId.slice(0, 11);

        return {
          videoId,
          url: r.url,
          title: r.title?.replace(/ - YouTube$/, '').trim() || 'Untitled',
          description: r.description || '',
          thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : (r.thumbnail?.src || ''),
          duration: r.video?.duration || null,
          channel: r.extra_snippets?.[0] || r.meta_url?.hostname || ''
        };
      })
      .filter(r => r.videoId);

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}