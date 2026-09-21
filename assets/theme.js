(() => {
  let dark = false;
  try { dark = localStorage.getItem('darkMode') === 'true'; } catch {}
  document.documentElement.classList.toggle('dark-mode', dark);
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    const button = document.createElement('button');
    button.type = 'button';
    const update = () => {
      button.innerHTML = `<svg class="icon" aria-hidden="true" focusable="false"><use href="${new URL('./icons.svg', document.querySelector('script[src$="assets/theme.js"]').src).href}#${dark ? 'sun' : 'moon'}"></use></svg><span>${dark ? '淺色模式' : '深色模式'}</span>`;
      button.setAttribute('aria-pressed', String(dark));
    };
    button.onclick = () => {
      dark = !dark;
      document.documentElement.classList.toggle('dark-mode', dark);
      try { localStorage.setItem('darkMode', String(dark)); } catch {}
      update();
    };
    update();
    nav.append(button);
  });
})();
