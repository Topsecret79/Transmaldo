import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  base: './',
  server: {
    allowedHosts: true
  },
  plugins: [
    react(),
    {
      name: 'save-excel-plugin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/save-excel' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { filename, base64 } = data;
                const buffer = Buffer.from(base64, 'base64');
                const exportsDir = path.resolve(process.cwd(), 'exports');
                if (!fs.existsSync(exportsDir)) {
                  fs.mkdirSync(exportsDir);
                }
                const filePath = path.join(exportsDir, filename);
                fs.writeFileSync(filePath, buffer);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: filePath }));
              } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    },
    {
      name: 'sw-build-stamp',
      closeBundle() {
        try {
          const swDistPath = path.resolve(process.cwd(), 'dist', 'sw.js');
          if (fs.existsSync(swDistPath)) {
            const content = fs.readFileSync(swDistPath, 'utf-8');
            const stamp = `\n// Build stamp: ${new Date().toISOString()}\n`;
            fs.writeFileSync(swDistPath, content + stamp, 'utf-8');
          }
        } catch (err) {
          console.warn('Warning stamping dist/sw.js:', err);
        }
      }
    }
  ],
})
