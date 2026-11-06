export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#f7f9fc' : '#07090d');
  try {
    localStorage.setItem('nexora-ui-theme', theme);
  } catch {} // sandboxed previews can block storage
}
