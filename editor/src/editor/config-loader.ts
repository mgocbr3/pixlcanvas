const getParam = (params: URLSearchParams, keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      return value;
    }
  }
  return null;
};

const showError = (message: string) => {
  document.body.innerHTML = `<pre>${message}</pre>`;
};

(() => {
  const win = window as Window & { config?: object };
  if (win.config) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token =
    getParam(params, ['access_token', 'token']) ||
    getParam(hashParams, ['access_token', 'token']) ||
    localStorage.getItem('pixlland_access_token');

  if (!token) {
    showError('Missing access token. Provide ?access_token=... or #access_token=...');
    return;
  }

  localStorage.setItem('pixlland_access_token', token);

  const apiUrl =
    getParam(params, ['api', 'apiUrl']) ||
    getParam(hashParams, ['api', 'apiUrl']) ||
    window.location.origin;
  const sceneId =
    getParam(params, ['sceneId', 'scene_id']) ||
    getParam(hashParams, ['sceneId', 'scene_id']);
  const projectId =
    getParam(params, ['projectId', 'project_id']) ||
    getParam(hashParams, ['projectId', 'project_id']);
  const branchId =
    getParam(params, ['branchId', 'branch_id']) ||
    getParam(hashParams, ['branchId', 'branch_id']);

  const path = window.location.pathname;
  const sceneMatch = path.match(/\/editor\/scene\/(\d+)/);
  const projectMatch = path.match(/\/editor\/project\/(\d+)/);
  const resolvedSceneId = sceneId || sceneMatch?.[1] || null;
  const resolvedProjectId = projectId || projectMatch?.[1] || null;

  const query = new URLSearchParams();
  if (resolvedSceneId) query.set('sceneId', resolvedSceneId);
  if (resolvedProjectId) query.set('projectId', resolvedProjectId);
  if (branchId) query.set('branchId', branchId);

  const configUrl = `${apiUrl.replace(/\/$/, '')}/editor/config.js?${query.toString()}`;

  const xhr = new XMLHttpRequest();
  xhr.open('GET', configUrl, false);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.send(null);

  if (xhr.status < 200 || xhr.status >= 300) {
    showError(`Config fetch failed: ${xhr.status}`);
    return;
  }

  // eslint-disable-next-line no-eval
  eval(xhr.responseText);
})();
