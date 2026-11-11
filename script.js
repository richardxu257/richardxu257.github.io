(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];
  const themeButton = document.querySelector('.theme-toggle');
  // Refresh the shared stylesheet on pages that still reference its previous version.
  const stylesheet = document.querySelector('link[rel="stylesheet"]');
  if (stylesheet?.getAttribute('href') === 'styles.css?v=6') stylesheet.href = 'styles.css?v=7';

  // Keep the same profile controls on the home and detail pages.
  const headerActions = document.createElement('div');
  headerActions.className = 'header-actions';
  headerActions.innerHTML = `
    <div class="profile-links" role="group" aria-label="Profile links">
      <a class="profile-link" href="https://www.linkedin.com/in/richardxu257/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" title="LinkedIn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96C2 21.32 2.69 22 3.55 22h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85H15.8V14.1c0-1.11-.02-2.54-1.55-2.54-1.55 0-1.79 1.21-1.79 2.46v4.73H9.51V9.2h2.83v1.3h.04c.4-.75 1.36-1.55 2.79-1.55 2.98 0 3.58 1.96 3.58 4.51v5.29Z"/></svg>
      </a>
      <span class="profile-link profile-placeholder" role="link" aria-disabled="true" aria-label="GitHub — coming soon" title="GitHub — coming soon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1.01 1.72 2.64 1.22 3.28.93.1-.73.39-1.22.72-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15A10.8 10.8 0 0 1 12 6.16c.96 0 1.92.13 2.82.38 2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.04.76 2.1v3.08c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z"/></svg>
      </span>
      <span class="profile-link profile-placeholder cv-placeholder" role="link" aria-disabled="true" aria-label="CV — coming soon" title="CV — coming soon">CV</span>
    </div>`;
  themeButton.before(headerActions);
  headerActions.append(themeButton);

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
