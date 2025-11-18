// CSS imports
import '../styles/styles.css';

import App from './pages/app';
import ApiService from './data/api';
// Ensure IDB helper is executed and `window.IDB` is available
import './idb-helper.js';
// Ensure PWA integration is executed and `window.subscribePush` is available
import './pwa-integration.js';

function updateNavigation() {
  const authNavItem = document.getElementById('auth-nav-item');
  const isAuthenticated = ApiService.isAuthenticated();

  if (isAuthenticated) {
    authNavItem.innerHTML = '<a href="#" id="nav-logout">👋Keluar</a>';
    const logoutLink = document.getElementById('nav-logout');
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      ApiService.logout();
    });
  } else {
    authNavItem.innerHTML = '<a href="#/login">👋Keluar</a>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = new App({
    content: document.querySelector('#main-content'),
    drawerButton: document.querySelector('#drawer-button'),
    navigationDrawer: document.querySelector('#navigation-drawer'),
  });

  // Update navigation based on auth status
  updateNavigation();

  // Initial render
  await app.renderPage();

  window.addEventListener('hashchange', async () => {
    updateNavigation();
    await app.renderPage();
  });
});
