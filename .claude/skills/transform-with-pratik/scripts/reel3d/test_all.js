// usage: node test_all.js scene:t:d scene:t:d ...  -> frames/sheet.jpg
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message.slice(0, 3000)));
  await p.goto('file:///home/claude/reel/gfx/index.html'); await p.evaluate(() => window.ready);
  const files = [];
  for (const spec of process.argv.slice(2)) {
    const [scene, t, d, cues] = spec.split(':');
    await p.evaluate(([s, t, d, c]) => window.renderScene(s, t, d, c), [scene, +t, +d, JSON.parse(cues || '{}')]);
    const f = `/home/claude/reel/frames/t_${scene}_${t}.png`; await p.screenshot({ path: f }); files.push(f);
  }
  await b.close();
  const n = files.length; const cols = Math.min(n, 4);
  execSync(`ffmpeg -v error -y ${files.map(f => `-i ${f}`).join(' ')} -filter_complex "${files.map((_, i) => `[${i}]scale=360:640[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${n}:layout=${files.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 640}`).join('|')}" /home/claude/reel/frames/sheet.jpg`);
  console.log('ok');
})();
