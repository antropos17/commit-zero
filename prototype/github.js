(() => {
  const sources = window.COMMIT_ZERO_SOURCES;
  const viewer = document.getElementById('source-lines');
  const scroll = document.getElementById('source-scroll');
  const copy = document.getElementById('copy-source');
  const copyStatus = document.getElementById('copy-status');
  let current = 'play.js';
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function highlight(line, name) {
    if (!name.endsWith('.js')) return escape(line);
    const pattern = /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|new|true|false|null|document|window)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*(?=\())/g;
    let last = 0, result = '';
    for (const match of line.matchAll(pattern)) {
      result += escape(line.slice(last, match.index));
      const token = match[0];
      const type = token.startsWith('//') ? 'comment' : /^["'`]/.test(token) ? 'string' : /^\d/.test(token) ? 'number' : /^(const|let|var|function|return|if|else|for|while|new|true|false|null|document|window)$/.test(token) ? 'keyword' : 'function';
      result += `<span class="token-${type}">${escape(token)}</span>`;
      last = match.index + token.length;
    }
    return result + escape(line.slice(last));
  }
  function selectFile(name) {
    current = name;
    const source = sources[name], lines = source.text.trimEnd().split('\n');
    document.getElementById('source-name').textContent = name;
    document.getElementById('source-stats-text').textContent = `${lines.length} строк · ${source.size} КБ`;
    document.getElementById('raw-source').href = 'raw.html?file=' + encodeURIComponent(name);
    document.getElementById('download-source').href = name;
    document.getElementById('download-source').download = name;
    viewer.innerHTML = lines.map((line, i) => `<div class="source-line"><span class="line-number" aria-hidden="true">${i + 1}</span><code class="line-code">${highlight(line, name) || ' '}</code></div>`).join('');
    scroll.scrollTop = 0; scroll.scrollLeft = 0;
    document.querySelectorAll('[data-source]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.source === name)));
    copyStatus.textContent = '';
  }
  document.querySelectorAll('[data-source]').forEach(button => button.addEventListener('click', () => selectFile(button.dataset.source)));
  copy.addEventListener('click', async () => {
    const text = sources[current].text;
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = 'Скопировано'; }
    catch { copyStatus.textContent = 'Не удалось скопировать. Открой исходник.'; }
  });
  const sections = [...document.querySelectorAll('.gh-tabs a')];
  function setActive(hash) {
    sections.forEach(a => { if (a.hash === hash) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
  }
  sections.forEach(a => a.addEventListener('click', () => setActive(a.hash)));
  window.addEventListener('hashchange', () => setActive(location.hash || '#source'));
  selectFile(current); setActive(location.hash || '#source');
})();
