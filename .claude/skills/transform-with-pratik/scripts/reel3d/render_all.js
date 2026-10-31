// node render_all.js workerIndex nWorkers [startFrame endFrame]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [wi, nw, f0a, f1a] = process.argv.slice(2).map(Number);
  const TL = JSON.parse(fs.readFileSync('/home/claude/reel/timeline.json'));
  const N = Math.round(TL.total * 30); const f0 = isNaN(f0a) ? 0 : f0a, f1 = isNaN(f1a) ? N : f1a;
  fs.mkdirSync('/home/claude/reel/ov', { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('ERR', e.message.slice(0, 2000)));
  await p.goto('file:///home/claude/reel/gfx/index.html'); await p.evaluate(() => window.ready);
  const t0 = Date.now(); let done = 0;
  for (let f = f0; f < f1; f++) {
    if (f % nw !== wi) continue;
    const out = `/home/claude/reel/ov/f${String(f).padStart(5, '0')}.png`;
    if (fs.existsSync(out)) continue;
    await p.evaluate(T => renderAt(T), (f + 0.5) / 30);
    await p.screenshot({ path: out + '.tmp.png', omitBackground: true }); fs.renameSync(out + '.tmp.png', out);
    if (++done % 50 === 0) console.log(`w${wi} ${done} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
  console.log(`w${wi} done ${done}`); await b.close();
})();
