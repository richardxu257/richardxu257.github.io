(() => {
  'use strict';
  // Render text without evaluating HTML, so writing content cannot run scripts.
  function renderWriting(target, body) {
    target.replaceChildren();
    for (const block of body.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
      if (!block.trim()) continue;
      const heading = block.match(/^(#{1,3})\s+([^\n]+)$/);
      const element = document.createElement(heading ? `h${heading[1].length + 1}` : 'p');
      element.textContent = heading ? heading[2] : block;
      target.append(element);
    }
  }
  window.renderWriting = renderWriting;
  const list = document.querySelector('#writing-list');
  const article = document.querySelector('#published-writing');
  if (!list && !article) return;
  const formatDate = date => new Date(date).toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});
  fetch('writings.json', {cache: 'no-store'}).then(response => {
    if (!response.ok) throw new Error('Unable to load writings. Please try again later.');
    return response.json();
  }).then(data => {
    if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Unable to load writings.');
    if (list) {
      list.replaceChildren();
      for (const entry of [...data.entries].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
        const link = document.createElement('a');
        link.className = 'writing-card';
        link.href = `writing.html?id=${encodeURIComponent(entry.id)}`;
        const time = document.createElement('time');
        time.dateTime = entry.publishedAt; time.textContent = formatDate(entry.publishedAt);
        const title = document.createElement('h2'); title.textContent = entry.title;
        const summary = document.createElement('p'); summary.textContent = entry.summary;
        const action = document.createElement('span'); action.className = 'card-action'; action.textContent = 'Read writing →';
        link.append(time, title, summary, action); list.append(link);
      }
      if (!data.entries.length) list.textContent = 'No writings published yet.';
    }
    if (article) {
      const id = new URLSearchParams(location.search).get('id');
      const entry = data.entries.find(item => item.id === id);
      if (!entry) throw new Error('This writing is not available.');
      article.querySelector('h1').textContent = entry.title;
      article.querySelector('time').textContent = formatDate(entry.publishedAt);
      article.querySelector('time').dateTime = entry.publishedAt;
      renderWriting(article.querySelector('.writing-body'), entry.body);
      document.title = `${entry.title} — Richard`;
    }
  }).catch(error => {
    if (list) list.textContent = error.message;
    if (article) { article.querySelector('h1').textContent = 'Writing unavailable'; article.querySelector('.writing-body').textContent = error.message; }
  });
})();
