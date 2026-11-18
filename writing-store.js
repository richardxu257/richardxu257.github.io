/* GitHub enforces access to the private draft repository. No credentials or drafts
   are placed in localStorage, the public repository, or the public reading feed. */
(() => {
  'use strict';
  const OWNER = 'richardxu257';
  const OWNER_ID = 96448524;
  const PRIVATE_REPO = 'website-writing-drafts';
  const PUBLIC_REPO = 'richardxu257.github.io';
  const encode = value => {
    const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
    if (bytes.length > 850000) throw new Error('This collection is too large to save. Download a backup before continuing.');
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  const decode = value => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g, '')), c => c.charCodeAt(0))));
  const copy = value => JSON.parse(JSON.stringify(value));
  function validateCollection(value) {
    if (value?.version !== 1 || !Array.isArray(value.entries)) throw new Error('The writing collection has an unsupported format. Nothing was overwritten.');
    const ids = new Set();
    for (const entry of value.entries) {
      if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) || ids.has(entry.id) ||
          !['title', 'summary', 'body'].every(key => typeof entry[key] === 'string')) {
        throw new Error('The writing collection contains an invalid entry. Nothing was overwritten.');
      }
      ids.add(entry.id);
    }
    return value;
  }
  class WritingStore {
    #token = '';
    #fetch;
    #ready = false;
    #draftSha;
    #drafts = {version: 1, entries: []};
    #branches = {};
    constructor(fetcher = (...args) => fetch(...args)) { this.#fetch = fetcher; }
    get drafts() { return copy(this.#drafts.entries); }
    get connected() { return this.#ready; }
    disconnect() { this.#token = ''; this.#ready = false; this.#draftSha = undefined; this.#drafts = {version: 1, entries: []}; this.#branches = {}; }
    async #request(path, options = {}) {
      if (!this.#token) throw new Error('Connect your GitHub account first.');
      const response = await this.#fetch('https://api.github.com' + path, {
        ...options, cache: 'no-store', credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: {Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.#token,
          'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? {'Content-Type': 'application/json'} : {})}
      });
      if (response.status === 404 && options.allowMissing) return null;
      if (!response.ok) {
        const messages = {401: 'The GitHub token is invalid or expired. Disconnect and reconnect with a valid token.',
          403: 'GitHub denied access. Check that this token has Contents: read and write for both website repositories.',
          404: 'Repository or file not found. Check the private draft repository and token access.',
          409: 'This entry changed in another session. Download your current text, then reconnect to load the latest drafts.',
          422: 'GitHub could not save this version. Download your current text, then reconnect before trying again.'};
        throw new Error(messages[response.status] || `GitHub could not complete the request (${response.status}). Your unsaved text is still in the editor.`);
      }
      return response.status === 204 ? null : response.json();
    }
    async #checkPrivate() {
      if (!this.#ready) throw new Error('Only the site owner can access drafts.');
      const repo = await this.#request(`/repos/${OWNER}/${PRIVATE_REPO}`);
      if (repo.private !== true || repo.owner?.id !== OWNER_ID || repo.permissions?.push !== true) {
        this.disconnect();
        throw new Error('Draft access stopped: the draft repository must be private, owned by Richard, and writable by this account.');
      }
      return repo;
    }
    async connect(token) {
      this.disconnect();
      this.#token = token.trim();
      try {
        const user = await this.#request('/user');
        if (user.id !== OWNER_ID || user.login.toLowerCase() !== OWNER) throw new Error('Access denied. This editor is only available to Richard’s GitHub account.');
        this.#ready = true;
        const privateRepo = await this.#checkPrivate();
        const publicRepo = await this.#request(`/repos/${OWNER}/${PUBLIC_REPO}`);
        if (publicRepo.owner?.id !== OWNER_ID || publicRepo.permissions?.push !== true || publicRepo.private !== false) throw new Error('The token must have write access to the public website repository.');
        this.#branches[PRIVATE_REPO] = privateRepo.default_branch || 'main';
        this.#branches[PUBLIC_REPO] = publicRepo.default_branch || 'main';
        const file = await this.#read(PRIVATE_REPO, 'drafts.json', true);
        this.#drafts = file ? validateCollection(decode(file.content)) : {version: 1, entries: []};
        this.#draftSha = file?.sha;
        return this.drafts;
      } catch (error) { this.disconnect(); throw error; }
    }
    async #read(repo, file, allowMissing = false) {
      return this.#request(`/repos/${OWNER}/${repo}/contents/${file}?ref=${encodeURIComponent(this.#branches[repo])}`, {allowMissing});
    }
    async #write(repo, file, data, sha, message) {
      return this.#request(`/repos/${OWNER}/${repo}/contents/${file}`, {method: 'PUT', body: JSON.stringify({
        message, content: encode(data), branch: this.#branches[repo], ...(sha ? {sha} : {})
      })});
    }
    async save(draft) {
      await this.#checkPrivate();
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(draft.id)) throw new Error('Invalid draft identifier.');
      if (!['title', 'summary', 'body'].every(key => typeof draft[key] === 'string')) throw new Error('Invalid draft content.');
      const next = copy(this.#drafts);
      const previous = next.entries.find(entry => entry.id === draft.id);
      const now = new Date().toISOString();
      const saved = {id: draft.id, title: draft.title.trim(), summary: draft.summary.trim(), body: draft.body,
        createdAt: previous?.createdAt || now, updatedAt: now, revision: (previous?.revision || 0) + 1,
        ...(previous?.publishedAt ? {publishedAt: previous.publishedAt, publishedRevision: previous.publishedRevision} : {})};
      next.entries = [saved, ...next.entries.filter(entry => entry.id !== draft.id)];
      const result = await this.#write(PRIVATE_REPO, 'drafts.json', next, this.#draftSha, 'Save private writing draft');
      this.#drafts = next; this.#draftSha = result.content.sha;
      return copy(saved);
    }
    async publish(id) {
      await this.#checkPrivate();
      const draft = this.#drafts.entries.find(entry => entry.id === id);
      if (!draft?.title.trim() || !draft?.body.trim()) throw new Error('Save a title and writing text before publishing.');
      const current = await this.#read(PRIVATE_REPO, 'drafts.json');
      if (current.sha !== this.#draftSha) throw new Error('Drafts changed in another session. Reconnect to review the latest version before publishing.');
      const publicFile = await this.#read(PUBLIC_REPO, 'writings.json');
      const publicData = validateCollection(decode(publicFile.content));
      const previous = publicData.entries.find(entry => entry.id === id);
      const now = new Date().toISOString();
      // An explicit projection is the boundary: never copy the private collection.
      const published = {id: draft.id, title: draft.title, summary: draft.summary, body: draft.body,
        publishedAt: previous?.publishedAt || now, updatedAt: now};
      publicData.entries = [published, ...publicData.entries.filter(entry => entry.id !== id)];
      await this.#write(PUBLIC_REPO, 'writings.json', publicData, publicFile.sha, 'Publish writing: ' + draft.title.slice(0, 120));
      const next = copy(this.#drafts);
      Object.assign(next.entries.find(entry => entry.id === id), {publishedAt: published.publishedAt, publishedRevision: draft.revision});
      try {
        const result = await this.#write(PRIVATE_REPO, 'drafts.json', next, this.#draftSha, 'Record published writing revision');
        this.#drafts = next; this.#draftSha = result.content.sha;
        return {entry: published};
      } catch {
        return {entry: published, warning: 'The writing was published, but its private status could not be updated. Your draft is safe. Reconnect before editing again.'};
      }
    }
  }
  const api = {WritingStore, encode, decode, validateCollection};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.WritingData = api;
})();
