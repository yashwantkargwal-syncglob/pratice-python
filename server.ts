import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini AI generation endpoint
app.post('/api/generate-post', async (req: Request, res: Response) => {
  try {
    const { topic, geo = 'US', apiKey } = req.body;
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    if (!effectiveKey) {
      return res.status(400).json({ 
        error: 'Gemini API Key is not configured. Please supply an API key or set GEMINI_API_KEY in .env.' 
      });
    }

    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    const localePreference = geo === 'US' ? 'US English' : 'UK English';

    const prompt = `You are a distinguished Senior Software Engineer, Technology Columnist, and SEO Specialist writing for a high-traffic developer and technology blog aimed at a tech-savvy audience in the ${geo} (${localePreference}).

TOPIC TO COVER:
"${topic}"

CRITICAL EDITORIAL AND STRUCTURAL GUIDELINES:
1. TARGET LENGTH: Between 1,000 and 1,500 words. Comprehensive, deep-dive, no fluff.
2. TONE & STYLE:
   - Engaging, authoritative, insightful, and natural human phrasing (avoid generic clichés like "in this fast-paced digital world").
   - Use clear technical vocabulary suited for developers, architects, tech leads, and tech enthusiasts.
3. HEADINGS & STRUCTURE:
   - Use structured Markdown with an engaging H1 title.
   - Use multiple H2 and H3 subheadings for logical progression (e.g., The Architectural Shift, Technical Deep-Dive, Real-World Implementations, Performance Benchmarks, Future Outlook).
   - Include actionable code snippets (e.g., Python, Bash, TypeScript, Dockerfile, or configuration files) with markdown syntax highlighting if relevant to tools, programming, or architectures.
4. IMAGE SUGGESTIONS REQUIREMENT (MANDATORY):
   - Every ~300 words of content, you MUST insert a dedicated image anchor in this exact syntax:
     [IMAGE_SUGGESTION: Highly descriptive prompt to generate or find a matching image, e.g., 'A modern high-tech server rack illuminated with neon violet LED indicators in a dark data center']
   - Ensure you include AT LEAST 3 to 4 distinct [IMAGE_SUGGESTION: ...] tags placed naturally between sections.
5. EXPLICIT SEO METADATA BLOCK:
   - At the very end of your response, output the following structured block verbatim:

### SEO_METADATA_START
META_TITLE: [Click-worthy, SEO-optimized title under 60 characters]
META_DESCRIPTION: [Compelling search snippet with primary keywords under 155 characters]
PRIMARY_KEYWORDS: [Comma-separated list of 5-8 relevant tech keywords]
### SEO_METADATA_END

Write the complete article now in clean Markdown.`;

    // Using gemini-3.8-flash for high quality and speed
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const markdownText = response.text || '';
    return res.json({ markdown: markdownText, topic, geo });
  } catch (error: any) {
    console.error('Error generating post:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
});

// Proxy endpoint to fetch live Google Trends RSS
app.get('/api/live-trends', async (req: Request, res: Response) => {
  try {
    const geo = (req.query.geo as string) || 'US';
    const rssUrl = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Trends RSS responded with status: ${response.status}`);
    }

    const xmlText = await response.text();
    return res.type('application/xml').send(xmlText);
  } catch (error: any) {
    console.warn('Could not fetch live Google Trends RSS:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch live trends' });
  }
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
