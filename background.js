// ツールバーのアイコンでページの上にトップバー（topbar.js）を出し、そのボタンから呼ばれてフォームに入力する。
// ショートカット（Alt+Shift+F）では、トップバーを出さずにすぐ入力する。

async function fillTab(tabId, options = {}) {
  const { profile } = await chrome.storage.local.get('profile');
  if (!profile) return { error: 'no-profile' };

  // 埋め込みのフォーム（iframe）にも入れる。入れられないフレームがあれば、最上位のページだけにする
  let target = { tabId, allFrames: true };
  try {
    await chrome.scripting.executeScript({ target, files: ['fill.js'] });
  } catch {
    target = { tabId };
    try {
      await chrome.scripting.executeScript({ target, files: ['fill.js'] });
    } catch {
      return { error: 'cannot-access' };
    }
  }
  const results = await chrome.scripting.executeScript({
    target,
    func: (p, o) => globalThis.__formAutofillJp?.fill(p, o),
    args: [profile, options],
  });
  return results.reduce(
    (sum, r) => ({ filled: sum.filled + (r.result?.filled || 0), found: sum.found + (r.result?.found || 0) }),
    { filled: 0, found: 0 },
  );
}

async function showBadge(tabId, result) {
  const text = result.error ? '!' : String(result.filled);
  await chrome.action.setBadgeBackgroundColor({ tabId, color: result.error || !result.filled ? '#b91c1c' : '#15803d' });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 3000);
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'fill-form' || !tab?.id) return;
  const result = await fillTab(tab.id);
  if (result.error === 'no-profile') chrome.runtime.openOptionsPage();
  await showBadge(tab.id, result);
});

// アイコンが押されたら、トップバーを出す（出ていれば閉じる。切り替えは topbar.js の中で行う）
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['topbar.js'] });
  } catch {
    // chrome:// のページなど、拡張機能が入れないページ
    await showBadge(tab.id, { error: 'cannot-access' });
  }
});

// トップバーからの依頼
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'open-options') {
    chrome.runtime.openOptionsPage();
    return false;
  }
  if (msg?.type !== 'fill' || sender.tab?.id == null) return false;
  fillTab(sender.tab.id, { overwrite: !!msg.overwrite }).then(sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
