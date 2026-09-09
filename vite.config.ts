import path from 'path';
import fs from 'fs';
import https from 'https';
import { defineConfig, Plugin } from 'vite';

function lfsResolverPlugin(): Plugin {
  const cacheDir = path.resolve(__dirname, 'node_modules/.cache/lfs_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  async function resolveLfsPointer(filePath: string): Promise<Buffer | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('version https://git-lfs.github.com/spec/v1')) {
        return null;
      }
      const oidMatch = content.match(/oid sha256:([a-f0-9]+)/);
      const sizeMatch = content.match(/size (\d+)/);
      if (!oidMatch || !sizeMatch) return null;

      const oid = oidMatch[1];
      const size = parseInt(sizeMatch[1], 10);
      const cachedFile = path.join(cacheDir, oid);

      if (fs.existsSync(cachedFile) && fs.statSync(cachedFile).size === size) {
        const buf = fs.readFileSync(cachedFile);
        fs.writeFileSync(filePath, buf);
        return buf;
      }

      const reqPayload = JSON.stringify({
        operation: 'download',
        transfers: ['basic'],
        objects: [{ oid, size }]
      });

      const href = await new Promise<string>((resolve, reject) => {
        const req = https.request('https://github.com/paper-rockets/Wanderlust-II.git/info/lfs/objects/batch', {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.git-lfs+json',
            'Content-Type': 'application/vnd.git-lfs+json',
            'Content-Length': Buffer.byteLength(reqPayload)
          }
        }, res => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const downloadUrl = parsed?.objects?.[0]?.actions?.download?.href;
              if (downloadUrl) resolve(downloadUrl);
              else reject(new Error('No download URL returned from LFS batch API'));
            } catch (err) {
              reject(err);
            }
          });
        });
        req.on('error', reject);
        req.write(reqPayload);
        req.end();
      });

      const buf = await new Promise<Buffer>((resolve, reject) => {
        https.get(href, res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
      });

      fs.writeFileSync(cachedFile, buf);
      fs.writeFileSync(filePath, buf);
      return buf;
    } catch (e) {
      console.error('[lfsResolverPlugin] Error resolving LFS:', e);
      return null;
    }
  }

  return {
    name: 'lfs-resolver',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url.endsWith('.glb')) {
          const cleanPath = url.replace(/^\//, '');
          const localPath = path.resolve(__dirname, 'public', cleanPath);
          if (fs.existsSync(localPath)) {
            const buf = await resolveLfsPointer(localPath);
            if (buf) {
              res.setHeader('Content-Type', 'model/gltf-binary');
              res.setHeader('Content-Length', buf.length);
              res.end(buf);
              return;
            }
          }
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [lfsResolverPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      hmr: true,
      allowedHosts: true as const,
    },
    build: {
      target: 'esnext',
      reportCompressedSize: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          low_power: path.resolve(__dirname, 'low_power.html'),
          low_power_dir: path.resolve(__dirname, 'low-power/index.html'),
        },
      },
    },
  };
});

