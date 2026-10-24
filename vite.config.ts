import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /<repo>/. The deploy workflow sets
// BASE_PATH; local dev and preview run from the root.
const base = process.env.BASE_PATH ?? '/';

// The site's public address, for links that must be absolute (canonical URL, social
// previews, sitemap). The deploy workflow sets it from GitHub Pages' own setting.
const siteUrl = (process.env.SITE_URL || 'https://draindrain.github.io/wow-forever-helper').replace(/\/?$/, '/');

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

export default defineConfig({
  base,
  plugins: [react(), siteFiles()],
});
