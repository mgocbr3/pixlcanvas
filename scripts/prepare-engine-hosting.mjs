import fs from 'fs/promises';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const srcDir = path.join(repoRoot, 'engine', 'build');
const outDir = path.join(repoRoot, 'engine-hosting');

const filesToCopy = [
  // Serve the minified build as the canonical URL expected by PIXLLAND_ENGINE_URL
  { from: 'playcanvas.min.js', to: 'playcanvas.js' },
  { from: 'playcanvas.min.js', to: 'playcanvas.min.js' },
  { from: 'playcanvas.min.mjs', to: 'playcanvas.min.mjs' },
  { from: 'playcanvas.js', to: 'playcanvas.dbg.js' },
  { from: 'playcanvas.mjs', to: 'playcanvas.dbg.mjs' }
];

const main = async () => {
  await fs.mkdir(outDir, { recursive: true });

  for (const entry of filesToCopy) {
    const src = path.join(srcDir, entry.from);
    const dst = path.join(outDir, entry.to);
    await fs.copyFile(src, dst);
  }

  // Cache headers for static hosting providers (Cloudflare Pages honors _headers)
  const headers = [
    '/playcanvas.js',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/playcanvas.min.js',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/playcanvas.min.mjs',
    '  Cache-Control: public, max-age=31536000, immutable',
    ''
  ].join('\n');

  await fs.writeFile(path.join(outDir, '_headers'), headers, 'utf8');

  // Minimal index (useful for a quick sanity check in the browser)
  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pixlland Engine</title>
  </head>
  <body>
    <pre>Pixlland Engine hosting OK. Use /playcanvas.js</pre>
  </body>
</html>`;

  await fs.writeFile(path.join(outDir, 'index.html'), indexHtml, 'utf8');

  console.log(`Prepared engine hosting in: ${path.relative(repoRoot, outDir)}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
