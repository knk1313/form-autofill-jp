const lib = globalThis.__formAutofillJp;
const form = document.getElementById('profile');
const pref = form.elements.prefecture;
const saved = document.getElementById('saved');

for (const [ja] of lib.PREFS) pref.add(new Option(ja, ja));

function readForm() {
  const p = {};
  for (const el of form.elements) if (el.name) p[el.name] = el.value.trim();
  return p;
}

function preview() {
  const p = lib.derive(readForm());
  document.getElementById('prefEn').textContent = p.prefectureEn || '都道府県を選ぶと決まります';
  const b = p.birth;
  const w = b?.wareki;
  document.getElementById('wareki').textContent = w
    ? `和暦では${w.era.ja}${w.year === 1 ? '元' : w.year}年${b.m}月${b.d}日です。`
    : '';
}

// フリガナの欄は、ひらがなで入れられてもカタカナに直す
for (const el of form.querySelectorAll('[data-kana]')) {
  el.addEventListener('blur', () => { el.value = lib.toKatakana(el.value); });
}

form.addEventListener('input', () => {
  preview();
  saved.hidden = true;
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  for (const el of form.querySelectorAll('[data-kana]')) el.value = lib.toKatakana(el.value);
  try {
    await chrome.storage.local.set({ profile: readForm() });
    showBanner(saved, 'success', '保存しました。');
  } catch {
    showBanner(saved, 'error', '保存できませんでした。もう一度、保存するを押してください。');
  }
});

chrome.storage.local.get('profile').then(({ profile }) => {
  if (profile) for (const [k, v] of Object.entries(profile)) if (form.elements[k]) form.elements[k].value = v;
  preview();
});
