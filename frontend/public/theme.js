// Apply a saved light/dark choice before the app renders, so a reload doesn't flash
// the wrong theme. A separate file because the CSP blocks inline scripts.
try {
  var t = localStorage.getItem('nextup:theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch (e) {
  /* storage blocked: the app falls back to the system setting */
}
