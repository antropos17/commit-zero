const name = new URLSearchParams(location.search).get('file') || 'play.js';
const sources = window.COMMIT_ZERO_SOURCES;
if (Object.hasOwn(sources, name)) {
  document.getElementById('name').textContent = name;
  document.title = name + ' — исходный файл';
  document.getElementById('raw').textContent = sources[name].text;
} else {
  document.getElementById('name').textContent = 'Файл не найден';
  document.getElementById('raw').textContent = 'Вернись к проекту и выбери файл из списка.';
}
