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

const birthday = form.elements.birthday;
const birthdayError = document.getElementById('birthday-error');

// 生年月日を YYYY-MM-DD にそろえる（DADS の DatePicker と同じく、全角数字・「/」「.」「年月日」・8桁の数字を受け付ける）。
// 日付として読めなければ null、空なら '' を返す
function normalizeDate(s) {
  const t = s.normalize('NFKC').trim();
  if (!t) return '';
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/) || t.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function checkBirthday() {
  const v = normalizeDate(birthday.value);
  if (v === null) {
    birthday.setAttribute('aria-invalid', 'true');
    birthdayError.textContent = '日付として読めません。1990-01-23 の形で入れてください。';
    birthdayError.hidden = false;
    return false;
  }
  birthday.value = v;
  birthday.removeAttribute('aria-invalid');
  birthdayError.hidden = true;
  return true;
}
birthday.addEventListener('blur', () => { checkBirthday(); preview(); });

function preview() {
  const p = lib.derive({ ...readForm(), birthday: normalizeDate(birthday.value) || '' });
  document.getElementById('prefEn').textContent = p.prefectureEn || '—';
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
  if (!checkBirthday()) {
    showBanner(saved, 'error', '生年月日を直してから、もう一度保存してください。');
    birthday.focus();
    return;
  }
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
