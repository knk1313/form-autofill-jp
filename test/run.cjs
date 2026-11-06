const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
// 見本のフォーム（test/*.html）に test/profile.json を入れ、data-expect と突き合わせる
// 使い方: npm i --no-save jsdom@24 && node test/run.cjs
const root = path.join(__dirname, "..");
const profile = JSON.parse(fs.readFileSync(path.join(root, 'test/profile.json'), 'utf8'));
const src = fs.readFileSync(path.join(root, 'fill.js'), 'utf8');
(async () => {
  let fail = 0, pass = 0;
  for (const f of ['ja.html', 'en.html']) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'test', f), 'utf8'), { runScripts: 'outside-only' });
    dom.window.eval(src);
    const res = await dom.window.eval('__formAutofillJp').fill(profile);
    console.log(`== ${f}: filled ${res.filled} / found ${res.found}`);
    for (const el of dom.window.document.querySelectorAll('[data-expect],[data-expect-checked]')) {
      const id = el.name || el.id;
      const ok = el.hasAttribute('data-expect-checked')
        ? String(el.checked) === el.dataset.expectChecked
        : el.value === el.dataset.expect;
      if (ok) pass++; else { fail++; console.log(`  NG ${id}: got ${JSON.stringify(el.type==='radio'?el.checked:el.value)} want ${JSON.stringify(el.dataset.expect ?? el.dataset.expectChecked)}`); }
    }
  }
  console.log(`pass ${pass}, fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
