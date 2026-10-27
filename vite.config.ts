import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /<repo>/. The deploy workflow sets
// BASE_PATH; local dev and preview run from the root.
const base = process.env.BASE_PATH ?? '/';

// The site's public address, for links that must be absolute (canonical URL, social
// previews, sitemap). The deploy workflow sets it from GitHub Pages' own setting.
const siteUrl = (process.env.SITE_URL || 'https://wow.drnz.se').replace(/\/?$/, '/');

/** Fills %SITE_URL% in index.html and writes robots.txt and sitemap.xml for the site's address. */
function siteFiles(): Plugin {
  return {
    name: 'site-files',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${siteUrl}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n` +
          '</urlset>\n',
      });
    },
  };
}

/**
 * Serves news.json from Wowhead's feed in the dev server. Builds don't fetch it: the deploy and
 * news workflows write dist/news.json with scripts/fetch-news.mjs.
 */
function devNews(): Plugin {
  let cached: { at: number; body: string } | undefined;
  return {
    name: 'dev-news',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(`${base}news.json`, async (_req, res) => {
        try {
          if (!cached || Date.now() - cached.at > 5 * 60_000) {
            // Vite runs this config from a bundled copy, so the script is found from the project root
            // (and the URL, a plain string, keeps the type checker out of the untyped script).
            const script = pathToFileURL(join(server.config.root, 'scripts/fetch-news.mjs')).href;
            const { fetchNews } = await import(script);
            cached = { at: Date.now(), body: JSON.stringify(await fetchNews()) };
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(cached.body);
        } catch (err) {
          res.statusCode = 502;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), siteFiles(), devNews()],
});
