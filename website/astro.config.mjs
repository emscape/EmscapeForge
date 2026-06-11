// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import icon from "astro-icon"; // Import astro-icon

// https://astro.build/config
export default defineConfig({
  integrations: [react(), icon()], // Add icon() to integrations
  server: {
    port: 3000,
    host: true,
    headers: {
      'Content-Security-Policy': "frame-src https://view.officeapps.live.com"
    }
  },
  site: 'https://emscapeforge.com',
  outDir: './dist',
  markdown: {
    // We'll add custom markdown extensions later
  }
});
