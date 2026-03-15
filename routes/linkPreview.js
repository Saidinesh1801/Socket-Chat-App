const express = require('express');
const httpAuth = require('../middleware/httpAuth');

const router = express.Router();

function isBlockedUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '[::1]') return true;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return true;
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 127 || a === 10 || a === 0) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

router.get('/', httpAuth, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });
  if (isBlockedUrl(url)) return res.status(403).json({ error: 'URL not allowed' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ChatApp LinkPreview' },
      redirect: 'manual'
    });
    clearTimeout(timeout);
    const text = await resp.text();
    const html = text.slice(0, 50000);
    const getMetaContent = (name) => {
      const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'));
      return m ? m[1] : '';
    };
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    res.json({
      title: getMetaContent('og:title') || (titleMatch ? titleMatch[1] : ''),
      description: getMetaContent('og:description') || getMetaContent('description'),
      image: getMetaContent('og:image'),
      url
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not fetch preview' });
  }
});

module.exports = router;
