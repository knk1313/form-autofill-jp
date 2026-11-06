// 通知のバナーに出すアイコン（lucide の CircleCheck・CircleAlert・Info。NotificationBanner と同じもの）
// 色は CSS の --banner-color を currentColor で受け取る
globalThis.BANNER_ICONS = (() => {
  const svg = (body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;
  return {
    success: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    error: svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'),
    info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  };
})();

// バナーを出す。type は success・error・info
globalThis.showBanner = (el, type, text) => {
  el.dataset.type = type;
  el.querySelector('[aria-hidden]').innerHTML = globalThis.BANNER_ICONS[type];
  el.querySelector('p').textContent = text;
  el.hidden = false;
};
