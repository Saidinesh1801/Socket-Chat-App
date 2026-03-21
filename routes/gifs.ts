import { Router, Request, Response } from 'express';

const router = Router();

interface GiphyResponse {
  data: Array<{
    id: string;
    title: string;
    images: {
      fixed_height: { url: string; width: string; height: string };
      fixed_height_small: { url: string; webp?: string };
    };
  }>;
}

router.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (!query) {
    return res.json({ results: [], nextOffset: 0 });
  }
  
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    
    if (apiKey) {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g&lang=en`
      );
      
      if (response.ok) {
        const data = await response.json() as GiphyResponse;
        const results = data.data.map((gif) => ({
          id: gif.id,
          title: gif.title,
          url: gif.images.fixed_height.url,
          thumbnail: gif.images.fixed_height_small.url,
          preview: gif.images.fixed_height_small.webp || gif.images.fixed_height_small.url,
          width: gif.images.fixed_height.width,
          height: gif.images.fixed_height.height,
          provider: 'Giphy'
        }));
        
        return res.json({
          results,
          nextOffset: offset + results.length
        });
      }
    }
    
    const fallbackGifs = generateFallbackGifs(query, limit);
    return res.json({
      results: fallbackGifs,
      nextOffset: offset + fallbackGifs.length
    });
    
  } catch (error) {
    const fallbackGifs = generateFallbackGifs(query, limit);
    return res.json({
      results: fallbackGifs,
      nextOffset: offset + fallbackGifs.length
    });
  }
});

function generateFallbackGifs(query: string, limit: number) {
  const seed = query.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const gifs = [];
  
  for (let i = 0; i < limit; i++) {
    const hue = (seed + i * 37) % 360;
    gifs.push({
      id: `fallback-${seed}-${i}`,
      title: `${query} gif ${i + 1}`,
      url: `https://picsum.photos/seed/${seed + i}/200/200`,
      thumbnail: `https://picsum.photos/seed/${seed + i}/100/100`,
      preview: `https://picsum.photos/seed/${seed + i}/100/100`,
      width: 200,
      height: 200,
      provider: 'Fallback'
    });
  }
  
  return gifs;
}

router.get('/trending', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    
    if (apiKey) {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=g`
      );
      
      if (response.ok) {
        const data = await response.json() as GiphyResponse;
        const results = data.data.map((gif) => ({
          id: gif.id,
          title: gif.title,
          url: gif.images.fixed_height.url,
          thumbnail: gif.images.fixed_height_small.url,
          preview: gif.images.fixed_height_small.webp || gif.images.fixed_height_small.url,
          width: gif.images.fixed_height.width,
          height: gif.images.fixed_height.height,
          provider: 'Giphy'
        }));
        
        return res.json({ results });
      }
    }
    
    const gifs = generateFallbackGifs('trending', limit);
    return res.json({ results: gifs });
    
  } catch (error) {
    return res.json({ results: generateFallbackGifs('trending', limit) });
  }
});

export default router;
