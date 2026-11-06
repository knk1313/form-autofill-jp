// ページの上に浮かせて出すトップバー。background.js が chrome.scripting で差し込む。
// ページの CSS の影響を受けないよう、Shadow DOM（closed）の中に作る。fill.js の欄探しにも引っかからない。
// 見た目は knk1313/full-page-screenshot のトップバーと同じで、
// デジタル庁デザインシステム（DADS）のトークン（knk1313/workspace-ui-template-dads の src/tokens/）に合わせている。

(() => {
  // もう一度アイコンが押されたら、出ているバーを閉じる
  if (window.__formAutofillJpBar) {
    window.__formAutofillJpBar.toggle();
    return;
  }

  const CSS = `
    :host {
      color-scheme: light dark;

      --color-surface: #ffffff;
      --color-text: #333333;
      --color-text-strong: #1a1a1a;
      --color-text-muted: #666666;
      --color-border: #949494;
      --color-primary: #0017c1;
      --color-primary-hover: #00118f;
      --color-primary-active: #000060;
      --color-text-on-primary: #ffffff;
      --color-primary-outline-hover: #c5d7fb;
      --color-primary-outline-active: #9db7f9;
      --color-primary-surface: #e8f1fe;
      --color-success: #197a4b;
      --color-error: #ce0000;
      --color-focus: #000000;
      --color-focus-ring: #ffd43d;
      --shadow: 0 4px 16px 2px rgba(0, 0, 0, 0.12), 0 2px 6px 0 rgba(0, 0, 0, 0.3);

      --font-sans: "Noto Sans JP Variable", "Noto Sans JP", -apple-system, BlinkMacSystemFont,
        "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
      --font-mono: "Noto Sans Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --color-surface: #1a1a1a;
        --color-text: #f2f2f2;
        --color-text-strong: #ffffff;
        --color-text-muted: #b3b3b3;
        --color-border: #767676;
        --color-primary: #9db7f9;
        --color-primary-hover: #c5d7fb;
        --color-primary-active: #d9e6ff;
        --color-text-on-primary: #000000;
        --color-primary-outline-hover: #000071;
        --color-primary-outline-active: #00118f;
        --color-primary-surface: #000060;
        --color-success: #71c598;
        --color-error: #ff9696;
        --color-focus: #ffd43d;
        --color-focus-ring: #000000;
        --shadow: 0 4px 16px 2px rgba(0, 0, 0, 0.5), 0 2px 6px 0 rgba(0, 0, 0, 0.6);
      }
    }

    * { box-sizing: border-box; }

    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 10px 10px 10px 16px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
      box-shadow: var(--shadow);
      color: var(--color-text);
      font-family: var(--font-sans);
      font-size: 16px;
      line-height: 1.5;
      text-align: left;
      pointer-events: auto;
      animation: enter 0.2s cubic-bezier(0.2, 0, 0, 1);
    }
    .bar:focus { outline: none; }
    @keyframes enter {
      from { opacity: 0; transform: translateY(-8px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar { animation: none; }
    }

    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--color-text-strong);
      font-size: 16px;
      font-weight: 700;
      white-space: nowrap;
    }
    .title svg { flex: none; width: 24px; height: 24px; color: var(--color-primary); }

    .actions, .status { display: flex; align-items: center; gap: 8px; }
    .status { min-height: 40px; margin: 0; padding: 0 4px; font-size: 16px; font-weight: 700; }
    .bar:not([data-state="idle"]) .actions { display: none; }
    .bar[data-state="idle"] .status { display: none; }
    .bar[data-state="done"] .status { color: var(--color-success); }
    .bar[data-state="error"] .status { color: var(--color-error); }
    .bar[data-state="busy"] .status::before {
      content: "";
      flex: none;
      width: 18px;
      height: 18px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* DADS ボタン（size sm 相当：高さ 40px）。角丸は 12px にしている */
    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      margin: 0;
      padding: 6px 12px;
      border-radius: 12px;
      font-family: inherit;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.02em;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }
    /* 塗り（プライマリー）。枠が 4px あるので、枠線のボタン（1px）と中身の位置がそろうよう余白を 3px 減らす */
    .solid {
      padding: 3px 9px;
      border: 4px double transparent;
      background: var(--color-primary);
      color: var(--color-text-on-primary);
    }
    .solid:hover { background: var(--color-primary-hover); }
    .solid:active { background: var(--color-primary-active); }
    /* 枠線（セカンダリー） */
    .outline {
      border: 1px solid currentColor;
      background: var(--color-surface);
      color: var(--color-primary);
    }
    .outline:hover { background: var(--color-primary-outline-hover); color: var(--color-primary-hover); }
    .outline:active { background: var(--color-primary-outline-active); color: var(--color-primary-active); }

    /* hover で文字にだけ下線を引く（キーの案内には引かない） */
    .label { text-underline-offset: 3px; }
    button:hover .label { text-decoration: underline 1px; }
    button:active .label { text-decoration: underline; }

    /* 閉じる（アイコンだけのボタン） */
    .close {
      justify-content: center;
      width: 40px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--color-text-muted);
    }
    .close:hover { background: var(--color-primary-surface); color: var(--color-text-strong); }
    .close svg { width: 20px; height: 20px; }

    button:focus-visible {
      outline: 4px solid var(--color-focus);
      outline-offset: 2px;
      box-shadow: 0 0 0 2px var(--color-focus-ring);
    }

    kbd {
      min-width: 22px;
      padding: 3px 5px;
      border: 1px solid currentColor;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 400;
      line-height: 1;
      text-align: center;
      opacity: 0.85;
    }

    .spacer { flex: 1 0 0; min-width: 0; }

    /* 幅が狭いときは、閉じるボタンを右上に固定し、ボタンは折り返す */
    .actions { flex-wrap: wrap; }
    @media (max-width: 640px) {
      .bar { position: relative; padding-right: 56px; }
      .close { position: absolute; top: 8px; right: 8px; }
      .spacer { display: none; }
    }
  `;

  const HTML = `
    <div class="bar" role="dialog" aria-label="フォームに入力" data-state="idle" tabindex="-1">
      <p class="title">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1.5 4a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2Zm5 0a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6Zm-5 4a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2Zm5 0a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6Zm-5 4a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2h-2Zm5 0a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-6Z"/></svg>
        フォームに入力
      </p>
      <div class="actions">
        <button class="solid" data-action="fill" type="button"><span class="label">入力</span><kbd>F</kbd></button>
        <button class="outline" data-action="overwrite" type="button"><span class="label">上書きして入力</span><kbd>O</kbd></button>
        <button class="outline" data-action="profile" type="button"><span class="label">プロフィール</span><kbd>P</kbd></button>
      </div>
      <p class="status" role="status" aria-live="polite"></p>
      <span class="spacer"></span>
      <button class="close" type="button" aria-label="閉じる（Esc）">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  `;

  const KEYS = { f: 'fill', o: 'overwrite', p: 'profile' };

  // ページの CSS に負けないよう、置き場所は !important で決める
  const host = document.createElement('form-autofill-jp-bar');
  host.style.cssText = [
    'all: initial',
    'position: fixed',
    'top: 16px',
    'left: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'display: flex',
    'justify-content: center',
    // バーの外側（左右の空き）はページを操作できるようにする
    'pointer-events: none',
  ].map((d) => d + ' !important').join(';');

  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>${HTML}`;
  const bar = root.querySelector('.bar');
  const status = root.querySelector('.status');

  let closeTimer = null;

  function setState(state, text = '') {
    bar.dataset.state = state;
    status.textContent = text;
  }

  function close() {
    clearTimeout(closeTimer);
    host.remove();
    delete window.__formAutofillJpBar;
  }

  const ERRORS = {
    'no-profile': 'プロフィールがまだありません',
    'cannot-access': 'このページには入力できません',
  };

  async function run(action) {
    if (bar.dataset.state === 'busy') return;
    clearTimeout(closeTimer);
    if (action === 'profile') {
      chrome.runtime.sendMessage({ type: 'open-options' });
      close();
      return;
    }
    setState('busy', '入力しています…');
    const res = await chrome.runtime.sendMessage({ type: 'fill', overwrite: action === 'overwrite' }).catch((err) => ({
      error: String(err?.message || err),
    }));
    if (res?.error) {
      setState('error', ERRORS[res.error] || '入力できませんでした');
      if (res.error === 'no-profile') showButton('登録する', () => run('profile'));
      return;
    }
    if (!res?.found) return setState('error', '入力できる欄が見つかりませんでした');
    if (!res.filled) return setState('error', 'すべて入力済みでした');
    setState('done', `${res.filled}か所に入力しました`);
    closeTimer = setTimeout(close, 2500);
  }

  function showButton(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'solid';
    btn.type = 'button';
    btn.innerHTML = '<span class="label"></span>';
    btn.firstChild.textContent = text;
    btn.addEventListener('click', onClick);
    status.after(btn);
    btn.focus();
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest?.('button');
    if (!btn) return;
    if (btn.classList.contains('close')) close();
    else if (btn.dataset.action) run(btn.dataset.action);
  });

  // キー操作は、フォーカスがバーの中にあるときだけ受け取る（ページへの入力を横取りしない）
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (bar.dataset.state !== 'busy') close();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = KEYS[e.key.toLowerCase()];
    if (action && bar.dataset.state === 'idle') {
      e.preventDefault();
      e.stopPropagation();
      run(action);
    }
  });

  document.documentElement.appendChild(host);
  bar.focus();

  window.__formAutofillJpBar = {
    toggle() {
      if (bar.dataset.state !== 'busy') close();
    },
  };
})();
