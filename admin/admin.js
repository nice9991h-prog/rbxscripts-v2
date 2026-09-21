"use strict";

const state = {};
const $ = selector => document.querySelector(selector);
const statusEl = $('#status');
const loginErrorEl = $('#loginError');

function setStatus(message, isError = false) {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ff8ca8' : '#6ee7b7';
  }
}

function setLoginError(message) {
  if (loginErrorEl) {
    loginErrorEl.textContent = message;
  }
}

function getValue(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setValue(object, path, value) {
  const keys = path.split('.');
  let cursor = object;
  keys.slice(0, -1).forEach(key => {
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Admin authentication required.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function bindPaths() {
  document.querySelectorAll('[data-path]').forEach(element => {
    const value = getValue(state, element.dataset.path);
    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
    } else {
      element.value = value ?? '';
    }

    element.oninput = () => {
      const nextValue = element.type === 'checkbox' ? element.checked : element.value;
      setValue(state, element.dataset.path, nextValue);
    };
  });
}

function renderEditors() {
  const fields = {
    socials: [
      { key: 'icon', label: 'Icon' },
      { key: 'title', label: 'Title' },
      { key: 'url', label: 'URL' },
      { key: 'enabled', label: 'Enabled', type: 'checkbox' }
    ],
    scripts: [
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'Script URL' },
      { key: 'tags', label: 'Tags (comma separated)' },
      { key: 'thumbnail', label: 'Thumbnail' },
      { key: 'enabled', label: 'Enabled', type: 'checkbox' }
    ],
    stats: [
      { key: 'label', label: 'Label' },
      { key: 'value', label: 'Value' },
      { key: 'icon', label: 'Icon' },
      { key: 'enabled', label: 'Enabled', type: 'checkbox' }
    ]
  };

  Object.entries(fields).forEach(([key, columns]) => {
    const root = key === 'socials' ? $('#socialEditor') : key === 'scripts' ? $('#scriptEditor') : $('#statEditor');
    if (!root) return;
    root.innerHTML = '';

    (state[key] || []).forEach((item, index) => {
      const box = document.createElement('div');
      box.className = 'item';

      columns.forEach(column => {
        const label = document.createElement('label');
        label.textContent = column.label;

        const input = document.createElement(column.type === 'textarea' ? 'textarea' : 'input');
        if (column.type !== 'textarea') {
          input.type = column.type || 'text';
        }

        if (input.type === 'checkbox') {
          input.checked = item[column.key] !== false;
        } else {
          input.value = Array.isArray(item[column.key]) ? item[column.key].join(', ') : (item[column.key] ?? '');
        }

        input.oninput = () => {
          if (input.type === 'checkbox') {
            item[column.key] = input.checked;
          } else if (column.key === 'tags') {
            item[column.key] = input.value.split(',').map(value => value.trim()).filter(Boolean);
          } else {
            item[column.key] = input.value;
          }
        };

        label.appendChild(input);
        box.appendChild(label);
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Delete';
      removeButton.className = 'danger';
      removeButton.onclick = () => {
        state[key].splice(index, 1);
        renderEditors();
      };
      box.appendChild(removeButton);
      root.appendChild(box);
    });
  });

  const sectionRoot = $('#sectionEditor');
  if (sectionRoot) {
    sectionRoot.innerHTML = '';
    Object.entries(state.sections || {}).forEach(([key, item]) => {
      const box = document.createElement('div');
      box.className = 'item';

      const titleLabel = document.createElement('label');
      titleLabel.textContent = `${key} title`;
      const titleInput = document.createElement('input');
      titleInput.value = item.title || '';
      titleInput.oninput = () => {
        item.title = titleInput.value;
      };
      titleLabel.appendChild(titleInput);

      const enabledLabel = document.createElement('label');
      enabledLabel.textContent = 'Enabled';
      const enabledInput = document.createElement('input');
      enabledInput.type = 'checkbox';
      enabledInput.checked = item.enabled !== false;
      enabledInput.onchange = () => {
        item.enabled = enabledInput.checked;
      };
      enabledLabel.appendChild(enabledInput);

      box.appendChild(titleLabel);
      box.appendChild(enabledLabel);
      sectionRoot.appendChild(box);
    });
  }
}

async function loadDashboard() {
  try {
    const session = await request('/api/admin/session');
    if (!session.authenticated) {
      $('#loginView').hidden = false;
      $('#app').hidden = true;
      return;
    }

    Object.assign(state, await request('/api/admin/site-config'));
    bindPaths();
    renderEditors();
    setStatus('Configuration loaded');
    $('#loginView').hidden = true;
    $('#app').hidden = false;
  } catch (error) {
    setStatus(error.message, true);
  }
}

$('#loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    username: form.get('username'),
    password: form.get('password')
  };

  try {
    await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setLoginError('');
    await loadDashboard();
  } catch (error) {
    setLoginError(error.message);
  }
});

$('#logout')?.addEventListener('click', async () => {
  try {
    await request('/api/admin/logout', { method: 'POST' });
    location.reload();
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.addEventListener('click', event => {
  const addButton = event.target.closest('[data-add]');
  if (!addButton) return;

  const key = addButton.dataset.add;
  state[key] = state[key] || [];

  if (key === 'stats') {
    state[key].push({ label: 'New stat', value: '0', icon: '★', enabled: true });
  } else if (key === 'socials') {
    state[key].push({ icon: '◉', title: 'New link', url: '#', enabled: true });
  } else {
    state[key].push({ name: 'New script', description: '', url: '', tags: [], thumbnail: '', enabled: true });
  }

  renderEditors();
});

$('#save')?.addEventListener('click', async () => {
  try {
    await request('/api/admin/site-config', {
      method: 'PUT',
      body: JSON.stringify(state)
    });
    setStatus('Saved successfully');
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('#reset')?.addEventListener('click', () => loadDashboard());
loadDashboard();
