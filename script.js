"use strict";
const fallback = {
  profile: {
    name: 'YU',
    verified: true,
    role: 'Roblox Script Creator | Developer',
    quote: 'Better Scripts, Better Experience.',
    bio: 'Hi! I’m YU, a Roblox script creator and developer.\nI make simple, useful and high quality scripts for everyone.\nThanks for visiting my page! 🙏',
    location: 'Cambodia',
    joined: 'Sep 2025',
    platform: 'Roblox',
    image: 'assets/reference-ui.png'
  },
  socials: [],
  stats: [],
  scripts: [],
  sections: {
    about: { enabled: true, title: 'About Me' },
    projects: { enabled: true, title: 'Projects' },
    scripts: { enabled: true, title: 'Featured Scripts' },
    support: { enabled: true, title: 'Support Me' },
    contact: { enabled: true, title: 'Quick Links' }
  },
  ui: {
    title: 'YU🔵 — Roblox Scripts & Tools',
    accent: '#14a8ff',
    theme: 'dark',
    footer: '♛ YU🔵 | Roblox Scripts & Tools | Made with ❤️ for the community'
  },
  quickLinks: []
};

let config = fallback;
let toastTimer = null;

const $ = selector => document.querySelector(selector);

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}
window.scrollToSection = scrollToSection;

function demoLink(name) {
  showToast(`${name} link is ready — add your real URL in the admin panel`);
  return false;
}
window.demoLink = demoLink;

function render(siteConfig) {
  const safeConfig = siteConfig || fallback;
  const profile = safeConfig.profile || fallback.profile;
  const ui = safeConfig.ui || fallback.ui;

  document.title = ui.title || fallback.ui.title;
  document.documentElement.style.setProperty('--blue', ui.accent || ui.accentColor || '#14a8ff');

  $('#profileName').textContent = `${profile.name || 'YU'}${profile.verified ? '🔵' : ''}`;
  $('#role').textContent = profile.role || '';
  $('#quote').textContent = `“${profile.quote || fallback.profile.quote}”`;
  $('#bio').innerHTML = (profile.bio || '').replace(/\n/g, '<br>');
  $('#profileImage').src = profile.image || profile.profileImage || fallback.profile.image;
  $('#meta').innerHTML = [profile.location, profile.joined || profile.joinedDate, profile.platform]
    .filter(Boolean)
    .map(value => `<span>${value}</span>`)
    .join('');

  $('#socials').innerHTML = (safeConfig.socials || []).filter(item => item.enabled !== false).map(item => {
    const href = item.url || '#';
    const targetAttr = href.startsWith('http') ? 'target="_blank" rel="noopener"' : '';
    const clickHandler = href === '#' ? `onclick="return demoLink('${item.title || 'Link'}')"` : '';
    return `<a href="${href}" ${targetAttr} ${clickHandler}>${item.icon || '◉'} <span>${item.title}</span><b>→</b></a>`;
  }).join('');

  $('#projects').innerHTML = (safeConfig.stats || []).filter(item => item.enabled !== false).map(item => `
    <div class="stat">
      <strong>${item.icon || '★'}</strong>
      <b>${item.value || ''}</b>
      <small>${item.label || ''}</small>
    </div>
  `).join('');

  $('#scriptList').innerHTML = (safeConfig.scripts || []).filter(item => item.enabled !== false).map(item => `
    <article class="script">
      <div class="thumb" ${item.thumbnail ? `style="background: url('${item.thumbnail}') center/cover;"` : ''}>${item.thumbnail ? '' : (item.name || 'Script')}</div>
      <div class="script-info">
        <h3>${item.name || 'Untitled Script'}</h3>
        <p>${item.description || ''}</p>
        <div class="tags">${(item.tags || []).map(tag => `<span>${tag}</span>`).join('')}</div>
      </div>
      <button class="get" data-url="${item.url || ''}" data-name="${item.name || 'Script'}">Get Script ↗</button>
    </article>
  `).join('');

  $('#footer').textContent = ui.footer || ui.footerText || fallback.ui.footer;

  ['about', 'projects', 'scripts', 'support', 'contact'].forEach(id => {
    const section = document.getElementById(id);
    if (!section) return;
    const info = safeConfig.sections?.[id];
    section.hidden = info && info.enabled === false;
    const heading = section.querySelector('h2');
    if (heading && info && info.title) {
      heading.textContent = info.title;
    }
  });

  if (ui.theme === 'light') {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/site-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('API unavailable');
    config = await response.json();
  } catch (error) {
    try {
      const fallbackResponse = await fetch('/data/site-config.json', { cache: 'no-store' });
      if (fallbackResponse.ok) {
        config = await fallbackResponse.json();
      }
    } catch {
      config = fallback;
      showToast('Using starter configuration');
    }
  }

  render(config);
}

document.addEventListener('click', event => {
  const followButton = event.target.closest('[data-follow]');
  if (followButton) {
    document.querySelectorAll('[data-follow]').forEach(button => {
      const active = button.dataset.following === 'true';
      button.dataset.following = String(!active);
      button.textContent = active ? '♟ Follow' : '✓ Following';
    });
    showToast('Thanks for following YU 🔵');
    return;
  }

  const scrollTrigger = event.target.closest('[data-scroll]');
  if (scrollTrigger) {
    scrollToSection(scrollTrigger.dataset.scroll);
    return;
  }

  const scriptButton = event.target.closest('[data-url]');
  if (scriptButton) {
    const url = scriptButton.dataset.url;
    if (!url) {
      showToast('Add a script URL in the admin panel');
      return;
    }
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname === 'example.com' || parsed.hostname.endsWith('.example.com')) {
        showToast('Replace the example.com script URL');
        return;
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
      window.open(parsed.href, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast('Add a valid script URL');
    }
  }
});

$('#theme')?.addEventListener('click', () => {
  document.body.classList.toggle('light');
  showToast(document.body.classList.contains('light') ? 'Light mode enabled' : 'Dark mode enabled');
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    document.querySelectorAll('nav a').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
    });
  });
}, {
  rootMargin: '-30% 0px -60%'
});

document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
loadConfig();
