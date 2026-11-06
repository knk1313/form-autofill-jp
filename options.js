const lib = globalThis.__formAutofillJp;
const form = document.getElementById('profile');
const pref = form.elements.prefecture;

for (const [ja] of lib.PREFS) pref.add(new Option(ja, ja));

function readForm() {
  const p = {};
  for (const el of form.elements) if (el.name) p[el.name] = el.value.trim();
  return p;
}

function preview() {
  const p = lib.derive(readForm());
  document.getElementById('prefEn').textContent = p.prefectureEn || '（都道府県から自動）';
  const b = p.birth;
  const w = b?.wareki;
  document.getElementById('wareki').textContent = w
    ? `和暦：${w.era.ja}${w.year === 1 ? '元' : w.year}年${b.m}月${b.d}日（和暦の欄にはこの形で入ります）`
    : '';
}

// フリガナの欄は、ひらがなで入れられてもカタカナに直す
for (const el of form.querySelectorAll('[data-kana]')) {
  el.addEventListener('blur', () => { el.value = lib.toKatakana(el.value); });
}

form.addEventListener('input', preview);
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  for (const el of form.querySelectorAll('[data-kana]')) el.value = lib.toKatakana(el.value);
  await chrome.storage.local.set({ profile: readForm() });
  const saved = document.getElementById('saved');
  saved.textContent = '保存しました';
  setTimeout(() => { saved.textContent = ''; }, 2000);
});

chrome.storage.local.get('profile').then(({ profile }) => {
  if (profile) for (const [k, v] of Object.entries(profile)) if (form.elements[k]) form.elements[k].value = v;
  preview();
});
