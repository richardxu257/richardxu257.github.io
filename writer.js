(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const store = new WritingData.WritingStore();
  let selected = null;
  let dirty = false;
  let busy = false;
  const form = $('draft-form');
  const status = $('writer-status');
  function message(text, error = false) { status.textContent = text; status.classList.toggle('error-message', error); }
  function values() { return {id: selected, title: $('draft-title').value, summary: $('draft-summary').value, body: $('draft-body').value}; }
  function controls() {
    for (const element of document.querySelectorAll('#workspace button, #workspace input, #workspace textarea')) element.disabled = busy;
    $('publish-draft').disabled = busy || dirty || !selected || !store.drafts.some(entry => entry.id === selected && entry.title.trim() && entry.body.trim());
    $('save-draft').disabled = busy || !selected || !dirty;
    $('disconnect').disabled = busy;
  }
  function drawList() {
    $('draft-list').replaceChildren();
    const entries = store.drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    $('draft-count').textContent = `${entries.length} saved ${entries.length === 1 ? 'entry' : 'entries'}`;
    for (const entry of entries) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'draft-list-item';
      if (entry.id === selected) button.setAttribute('aria-current', 'true');
      const title = document.createElement('strong'); title.textContent = entry.title || 'Untitled draft';
      const state = document.createElement('span');
      state.textContent = entry.publishedAt ? (entry.publishedRevision === entry.revision ? 'Published · saved copy' : 'Published · unpublished edits') : 'Private draft';
      const date = document.createElement('small'); date.textContent = new Date(entry.updatedAt).toLocaleString();
      button.append(title, state, date); button.addEventListener('click', () => openDraft(entry));
      $('draft-list').append(button);
    }
  }
  function discardOkay() { return !dirty || confirm('Leave this draft without saving your changes?'); }
  function openDraft(entry) {
    if (!discardOkay()) return;
    selected = entry.id; $('published-link').hidden = true;
    $('draft-title').value = entry.title; $('draft-summary').value = entry.summary; $('draft-body').value = entry.body;
    dirty = false; form.hidden = false; $('draft-empty').hidden = true; $('draft-preview').hidden = true;
    $('preview-draft').setAttribute('aria-expanded', 'false');
    drawList(); controls(); message('Saved privately. Editing this entry will not change its published version.');
  }
  async function run(action) {
    if (busy) return;
    busy = true; controls();
    try { await action(); }
    catch (error) { message(error.message || 'Could not complete the action. Your current text is still in the editor.', true); }
    finally { busy = false; controls(); }
  }
  $('connect-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    busy = true; $('connect').disabled = true;
    const token = $('github-token').value.trim(); $('github-token').value = '';
    message('Checking your GitHub account and private draft storage…');
    try {
      await store.connect(token);
      $('sign-in').hidden = true; $('workspace').hidden = false; $('disconnect').hidden = false;
      drawList(); message('Connected as Richard. Drafts are private; only Publish makes an entry public.');
    } catch (error) { message(error.message, true); }
    finally { busy = false; $('connect').disabled = false; controls(); }
  });
  $('disconnect').addEventListener('click', () => {
    if (!discardOkay()) return;
    store.disconnect(); selected = null; dirty = false;
    form.reset(); $('published-link').hidden = true; $('draft-preview').hidden = true; $('draft-preview').replaceChildren(); $('draft-list').replaceChildren(); $('draft-count').textContent = '';
    $('workspace').hidden = true; $('sign-in').hidden = false; $('disconnect').hidden = true;
    form.hidden = true; $('draft-empty').hidden = false;
    message('Disconnected. Your saved drafts remain in your private repository.');
  });
  $('new-draft').addEventListener('click', () => {
    if (!discardOkay()) return;
    dirty = false; openDraft({id: crypto.randomUUID(), title: '', summary: '', body: ''});
    dirty = true; controls(); message('New private draft. Save it to return to it later.'); $('draft-title').focus();
  });
  form.addEventListener('input', () => { dirty = true; $('draft-preview').hidden = true; controls(); message('Unsaved changes. Save draft to keep this version.'); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      const entry = await store.save(values()); dirty = false; drawList();
      message(`Saved privately at ${new Date(entry.updatedAt).toLocaleTimeString()}.`);
    });
  });
  $('preview-draft').addEventListener('click', () => {
    const preview = $('draft-preview'); preview.hidden = !preview.hidden;
    $('preview-draft').setAttribute('aria-expanded', String(!preview.hidden));
    window.renderWriting(preview, $('draft-body').value);
  });
  $('download-draft').addEventListener('click', () => {
    const draft = values();
    const url = URL.createObjectURL(new Blob([`# ${draft.title || 'Untitled draft'}\n\n${draft.summary}\n\n${draft.body}\n`], {type: 'text/markdown;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'writing-backup.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('publish-draft').addEventListener('click', () => {
    $('publish-title').textContent = $('draft-title').value;
    $('publish-confirmation').showModal();
  });
  $('cancel-publish').addEventListener('click', () => $('publish-confirmation').close());
  $('confirm-publish').addEventListener('click', () => {
    $('publish-confirmation').close();
    run(async () => {
      message('Publishing this saved entry…');
      const result = await store.publish(selected); drawList();
      message(result.warning || 'Published to GitHub. The live Writings page will update after GitHub Pages finishes deploying.');
      $('published-link').href = `writing.html?id=${encodeURIComponent(result.entry.id)}`;
      $('published-link').hidden = false;
    });
  });
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && store.connected && selected) {
      event.preventDefault(); if (dirty && !busy) form.requestSubmit();
    }
  });
})();
