import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import process from 'node:process';

// Favicon links are normally emitted as separate assets by Vite, even with a
// high assetsInlineLimit. Embed the project's supplied icon for the standalone
// HTML too, including offline and sandboxed previews.
function inlineProjectFavicon() {
  return {
    name: 'nexora-inline-project-favicon',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const png = readFileSync(new URL('./src/assets/nexora-icon.png', import.meta.url));
        return html.replace(
          'href="/src/assets/nexora-icon.png"',
          `href="data:image/png;base64,${png.toString('base64')}"`,
        );
      },
    },
  };
}

const apiProxy = {
  '/api': {
    target: process.env.NEXORA_API_PROXY_TARGET || 'http://127.0.0.1:8080',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [inlineProjectFavicon(), viteSingleFile()],
  server: { host: '0.0.0.0', allowedHosts: true, proxy: apiProxy },
  preview: { host: '0.0.0.0', allowedHosts: true, proxy: apiProxy },
  build: { assetsInlineLimit: 10000000 },
});
