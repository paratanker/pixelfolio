import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const { site } = JSON.parse(readFileSync('./src/data/content.json', 'utf-8'))

const escapeHtml = (str) =>
  str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Bakes site.title / site.description from content.json into the built index.html,
// so crawlers and link-preview bots that don't run JS see the real meta tags
// (useDocumentMeta.js still updates them client-side for consistency).
function injectSiteMeta() {
  return {
    name: 'inject-site-meta',
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(site.title)}</title>`)
        .replace(
          /<meta name="description" content=".*?">/,
          `<meta name="description" content="${escapeHtml(site.description)}">`
        )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Set site.baseUrl in src/data/content.json to deploy at any subpath —
  // '.' keeps the build portable across GitHub Pages, Vercel, Netlify, etc.
  base: site.baseUrl,
  plugins: [react(), tailwindcss(), injectSiteMeta()],
})
