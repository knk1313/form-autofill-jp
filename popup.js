const $ = (id) => document.getElementById(id);

const MESSAGES = {
  'no-profile': 'プロフィールがまだありません。先に登録してください。',
  'cannot-access': 'このページには入力できません。chrome:// のページやウェブストアでは使えません。',
};

async function init() {
  const { profile } = await chrome.storage.local.get('profile');
  if (profile) {
    const name = [profile.lastName, profile.firstName].filter(Boolean).join(' ') || '名前なし';
    $('who').textContent = `${name}さんのプロフィールで入力します。`;
  } else {
    $('who').textContent = 'プロフィールがまだありません。';
    $('fill').textContent = 'プロフィールを登録する';
  }

  $('fill').addEventListener('click', async () => {
    if (!profile) return chrome.runtime.openOptionsPage();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    $('fill').disabled = true;
    $('fill').setAttribute('aria-busy', 'true');
    const res = await chrome.runtime.sendMessage({ type: 'fill', tabId: tab.id, overwrite: $('overwrite').checked });
    $('fill').disabled = false;
    $('fill').removeAttribute('aria-busy');
    const banner = $('status');
    if (res?.error) {
      showBanner(banner, 'error', MESSAGES[res.error] || '入力できませんでした。');
    } else if (!res?.found) {
      showBanner(banner, 'info', '入力できる欄が見つかりませんでした。');
    } else if (!res.filled) {
      showBanner(banner, 'info', `${res.found}か所の欄を見つけましたが、すべて入力済みでした。`);
    } else {
      showBanner(banner, 'success', `${res.filled}か所に入力しました。送る前に、中身を確かめてください。`);
    }
  });

  $('edit').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

init();
