(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  const themeButton = document.querySelector('.theme-toggle');
  const themeLabel = themeButton.querySelector('.theme-label');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let explicitTheme = false;
  try { explicitTheme = ['light', 'dark'].includes(localStorage.getItem('portfolio-theme')); } catch {}

  function activateSection() {
    if (!tabs.length) return;
    const requested = location.hash.slice(1);
    const selected = tabs.find(tab => tab.getAttribute('aria-controls') === requested) || tabs[0];
    tabs.forEach(tab => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.id !== selected.getAttribute('aria-controls'); });
    document.title = `${selected.textContent} — Personal website`;
  }

  document.querySelector('[role="tablist"]')?.addEventListener('keydown', event => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    themeLabel.textContent = dark ? 'Dark' : 'Light';
    themeButton.setAttribute('aria-pressed', String(dark));
    const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  }

  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    explicitTheme = true;
    try { localStorage.setItem('portfolio-theme', theme); } catch {}
    applyTheme(theme);
  });
  systemTheme.addEventListener('change', event => {
    if (!explicitTheme) applyTheme(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('hashchange', activateSection);
  activateSection();
  applyTheme(document.documentElement.dataset.theme);
})();
