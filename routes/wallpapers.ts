import { Router, Request, Response } from 'express';
import httpAuth from '../middleware/httpAuth';

const router = Router();

interface WallhavenData {
  data?: Array<{
    id: string;
    path: string;
    thumbs?: { large?: string; original?: string; small?: string };
    resolution: string;
    colors: string[];
  }>;
  meta?: {
    last_page?: number;
    current_page?: number;
  };
}

router.get('/', httpAuth, async (req: Request, res: Response): Promise<void> => {
  const q = (req.query.q as string) || 'anime';
  const page = req.query.page || 1;
  const url = `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(q)}&page=${page}&categories=111&purity=100&sorting=relevance&order=desc`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ChatApp Wallpaper' }
    });
    clearTimeout(timeout);
    const data = await resp.json() as WallhavenData;
    const results = (data.data || []).map((item) => ({
      id: item.id,
      url: item.path,
      thumb: item.thumbs?.large || item.thumbs?.original || item.thumbs?.small,
      resolution: item.resolution,
      colors: item.colors
    }));
    res.json({ results, pages: data.meta?.last_page || 1, current: data.meta?.current_page || 1 });
  } catch (e) {
    res.status(500).json({ error: 'Could not fetch wallpapers' });
  }
});

export default router;
