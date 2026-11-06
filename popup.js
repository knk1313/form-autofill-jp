const $ = (id) => document.getElementById(id);

const MESSAGES = {
  'no-profile': 'プロフィールがまだありません。先に登録してください。',
  'cannot-access': 'このページには入力できません（chrome:// のページやウェブストアなど）。',
};

async function init() {
  const { profile } = await chrome.storage.local.get('profile');
  if (profile) {
    const name = [profile.lastName, profile.firstName].filter(Boolean).join(' ') || '名前なし';
    $('who').textContent = `${name} として入力します`;
  } else {
    $('who').textContent = 'プロフィールがまだありません。';
    $('fill').textContent = 'プロフィールを登録する';
  }

  $('fill').addEventListener('click', async () => {
    if (!profile) return chrome.runtime.openOptionsPage();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    $('fill').disabled = true;
    $('status').textContent = '入力しています…';
    const res = await chrome.runtime.sendMessage({ type: 'fill', tabId: tab.id, overwrite: $('overwrite').checked });
    $('fill').disabled = false;
    if (res?.error) {
      $('status').textContent = MESSAGES[res.error] || '入力できませんでした。';
    } else if (!res?.found) {
      $('status').textContent = '入力できる欄が見つかりませんでした。';
    } else if (!res.filled) {
      $('status').textContent = `${res.found}か所の欄を見つけましたが、すべて入力済みでした。`;
    } else {
      $('status').textContent = `${res.filled}か所に入力しました（緑の枠）。送る前に中身を確かめてください。`;
    }
  });

  $('edit').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
