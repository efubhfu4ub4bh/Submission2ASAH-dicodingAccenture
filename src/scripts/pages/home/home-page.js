import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ApiService from '../../data/api';

export default class HomePage {
  constructor() {
    this.map = null;
    this.markers = [];
    this.stories = [];
    this.activeMarker = null;
  }

  async render() {
    return `
      <section class="home-container">
        <div class="home-header container">
          <h1 class="page-title">Jelajahi Cerita🌏</h1>
          <p class="page-description">Temukan kisah seru & inspiratif dari teman-teman di seluruh Indonesia ✨</p>
          <div class="home-actions">
            <a href="#/add-story" class="btn btn-primary">
              <span aria-hidden="true">💌</span> Tambah Cerita
            </a>
            <a href="#/bookmarks" class="btn btn-bookmark" id="bookmarks-link">
              <span aria-hidden="true">📚</span> Bookmark <span id="bookmark-badge" class="badge">0</span>
            </a>
            <button id="logout-button" class="btn btn-secondary" aria-label="Logout">
              <span aria-hidden="true">👋</span> Keluar
            </button>
          </div>
          
          <!-- PWA Controls -->
          <div class="pwa-controls">
            <button id="install-button" class="btn btn-install" style="display: none;" aria-label="Install aplikasi">
              <span aria-hidden="true">📱</span> Install Aplikasi
            </button>
            
            <div class="notification-control">
              <label class="switch" title="Toggle notifikasi push">
                <input type="checkbox" id="notification-toggle" aria-label="Toggle notifikasi">
                <span class="slider"></span>
              </label>
              <span class="notification-label">🔔 Notifikasi</span>
            </div>
            
            <div id="connection-status" class="connection-status" role="status" aria-live="polite">
              <span class="status-dot"></span>
              <span id="status-text">Online</span>
            </div>
            
            <button id="sync-button" class="btn btn-sync" style="display: none;" aria-label="Sinkronkan cerita offline">
              <span aria-hidden="true">🔄</span> Sinkronkan
            </button>
          </div>
        </div>

        <div class="map-controls container">
          <div class="filter-controls">
            <label for="story-filter" class="filter-label">Cari Cerita🔍:</label>
            <input 
              type="text" 
              id="story-filter" 
              class="filter-input" 
              placeholder="🌟 Cari cerita favoritmu di sini"
              aria-label="Filter cerita berdasarkan nama atau deskripsi"
            />
          </div>
        </div>

        <div class="map-stories-wrapper container">
          <div class="stories-sidebar" role="complementary" aria-label="Daftar cerita">
            <h2 class="sidebar-title">Daftar Cerita📰</h2>
            <div id="stories-list" class="stories-list" role="list">
              <div class="loading-spinner" aria-label="Memuat cerita">Memuat cerita...</div>
            </div>
          </div>

          <div class="map-container">
            <div id="map" class="map" role="application" aria-label="Peta interaktif menampilkan lokasi cerita"></div>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    // Check authentication
    if (!ApiService.isAuthenticated()) {
      window.location.hash = '#/login';
      return;
    }

    this._initMap();
    await this._loadStories();
    this._initEventListeners();

    // Ensure PWA controls are re-initialized after navigation
    await this._initPWAControls();
  }

  _initMap() {
    // Initialize map centered on Indonesia
    this.map = L.map('map').setView([-2.5, 118], 5);

    // Create layer groups
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri',
      maxZoom: 19,
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
      maxZoom: 17,
    });

    // Add default layer
    osmLayer.addTo(this.map);

    // Add layer control
    const baseMaps = {
      'Street Map': osmLayer,
      'Satellite': satelliteLayer,
      'Topographic': topoLayer,
    };

    L.control.layers(baseMaps).addTo(this.map);

    // Fix marker icon issue in Leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }

  async _loadStories() {
    const storiesList = document.getElementById('stories-list');
    
    try {
      const response = await ApiService.getStories();
      console.log('API Response:', response);
      
      // Handle response structure: response.listStory (not response.data.listStory)
      this.stories = response.listStory || [];

      if (!this.stories || this.stories.length === 0) {
        storiesList.innerHTML = '<p class="no-stories">Belum ada cerita. Jadilah yang pertama berbagi!</p>';
        return;
      }

      console.log(`Loaded ${this.stories.length} stories`);
      this._renderStoriesList(this.stories);
      this._addMarkersToMap(this.stories);
    } catch (error) {
      console.error('Failed to load stories:', error);
      storiesList.innerHTML = `<p class="error-message">Gagal memuat cerita: ${error.message}</p>`;
    }
  }

  async _renderStoriesList(stories) {
    const storiesList = document.getElementById('stories-list');
    
    // Check bookmark status for all stories
    const bookmarkStatuses = {};
    for (const story of stories) {
      bookmarkStatuses[story.id] = await window.IDB?.isBookmarked?.(story.id) ?? false;
    }
    
    storiesList.innerHTML = stories.map(story => {
      // API Response structure:
      // { id, name, description, photoUrl, createdAt, lat, lon }
      const lat = story.lat || '';
      const lon = story.lon || '';
      const photoUrl = story.photoUrl || '';
      const storyName = story.name || 'Cerita Tanpa Judul';
      const description = story.description || '';
      const createdAt = story.createdAt || new Date().toISOString();
      const isBookmarked = bookmarkStatuses[story.id];
      
      return `
        <article class="story-card" data-id="${story.id}" data-lat="${lat}" data-lon="${lon}" role="listitem" tabindex="0">
          <div class="story-image-wrapper">
            <img src="${photoUrl}" alt="${storyName}" class="story-image" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E'" />
            <button 
              class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
              data-id="${story.id}" 
              aria-label="${isBookmarked ? 'Hapus dari bookmark' : 'Tambah ke bookmark'}"
              title="${isBookmarked ? 'Hapus dari bookmark' : 'Tambah ke bookmark'}"
            >
              <span aria-hidden="true">${isBookmarked ? '💖' : '🤍'}</span>
            </button>
          </div>
          <div class="story-content">
            <h3 class="story-title">${storyName}</h3>
            <p class="story-author">Oleh: ${storyName}</p>
            <p class="story-description">${description}</p>
            <time class="story-date" datetime="${createdAt}">
              ${new Date(createdAt).toLocaleDateString('id-ID', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </time>
          </div>
        </article>
      `;
    }).join('');
  }

  _addMarkersToMap(stories) {
    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    let hasMarkers = false;

    stories.forEach(story => {
      // API Response: { id, name, description, photoUrl, createdAt, lat, lon }
      const lat = story.lat;
      const lon = story.lon;
      const photoUrl = story.photoUrl || '';
      const storyName = story.name || 'Cerita Tanpa Judul';
      const description = story.description || '';
      const createdAt = story.createdAt || new Date().toISOString();
      
      if (lat && lon) {
        console.log(`Adding marker for "${storyName}" at [${lat}, ${lon}]`);
        
        const marker = L.marker([lat, lon])
          .addTo(this.map)
          .bindPopup(`
            <div class="map-popup">
              <img src="${photoUrl}" alt="${storyName}" class="popup-image" onerror="this.style.display='none'" />
              <h3 class="popup-title">${storyName}</h3>
              <p class="popup-author">Oleh: ${storyName}</p>
              <p class="popup-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</p>
              <time class="popup-date">${new Date(createdAt).toLocaleDateString('id-ID')}</time>
            </div>
          `);

        marker.storyId = story.id;
        
        marker.on('click', () => {
          this._highlightStoryCard(story.id);
          this._setActiveMarker(marker);
        });

        this.markers.push(marker);
        hasMarkers = true;
      } else {
        console.warn(`Story "${storyName}" has no location (lat: ${lat}, lon: ${lon})`);
      }
    });

    console.log(`Total markers added: ${this.markers.length}`);

    // If we have markers, fit bounds to show all markers
    if (hasMarkers && this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  async _initEventListeners() {
    // Logout button
    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', () => {
      ApiService.logout();
    });

    // Story filter
    const filterInput = document.getElementById('story-filter');
    filterInput.addEventListener('input', (e) => {
      this._filterStories(e.target.value);
    });

    // Story card click - sync with map
    const storiesList = document.getElementById('stories-list');
    storiesList.addEventListener('click', async (e) => {
      // Handle bookmark button click
      const bookmarkBtn = e.target.closest('.bookmark-btn');
      if (bookmarkBtn) {
        e.stopPropagation();
        await this._handleBookmarkClick(bookmarkBtn);
        return;
      }
      
      // Handle story card click
      const storyCard = e.target.closest('.story-card');
      if (storyCard) {
        this._onStoryCardClick(storyCard);
      }
    });

    // Keyboard navigation for story cards
    storiesList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const storyCard = e.target.closest('.story-card');
        if (storyCard) {
          e.preventDefault();
          this._onStoryCardClick(storyCard);
        }
      }
    });

    // PWA Controls
    this._initPWAControls();
    
    // Bookmark controls
    await this._updateBookmarkBadge();
    
    // Listen for bookmark changes from bookmarks page
    window.addEventListener('bookmark-changed', async () => {
      await this._updateBookmarkBadge();
      await this._loadStories(); // Refresh to update bookmark icons
    });
  }

  async _initPWAControls() {
    // Install button
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.addEventListener('click', async () => {
        if (window.showInstallPrompt) {
          const accepted = await window.showInstallPrompt();
          if (accepted) {
            console.log('[PWA] App installed');
          }
        }
      });
    }

    // Notification toggle
    const notificationToggle = document.getElementById('notification-toggle');
    if (notificationToggle && window.checkNotificationPermission) {
      // Set initial state from local storage
      const savedState = localStorage.getItem('notification-toggle-state');
      if (savedState !== null) {
        notificationToggle.checked = savedState === 'true';
      } else {
        const isSubscribed = await window.isPushSubscribed?.() || (Notification.permission === 'granted');
        notificationToggle.checked = !!isSubscribed;
      }

      notificationToggle.addEventListener('change', async (e) => {
        try {
          if (e.target.checked) {
            // Subscribe
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const result = await window.subscribePush();
              localStorage.setItem('notification-toggle-state', 'true'); // Persist state

              // Check if notification-only mode
              if (result?.backendData?.mode === 'notification-only') {
                this._showNotification('Notifikasi diaktifkan (mode lokal) 🔔', 'success');
              } else {
                this._showNotification('Notifikasi diaktifkan! 🔔', 'success');
              }
            } else {
              e.target.checked = false;
              this._showNotification('Izin notifikasi ditolak', 'error');
            }
          } else {
            // Unsubscribe
            await window.unsubscribePush();
            localStorage.setItem('notification-toggle-state', 'false'); // Persist state
            this._showNotification('Notifikasi dinonaktifkan', 'info');
          }
        } catch (error) {
          console.error('[PWA] Notification toggle error:', error);
          e.target.checked = !e.target.checked;

          // More specific error messages
          let errorMessage = 'Gagal mengubah pengaturan notifikasi';
          if (error.message.includes('login')) {
            errorMessage = 'Silakan login terlebih dahulu';
          } else if (error.message.includes('server')) {
            errorMessage = 'Gagal terhubung ke server';
          }

          this._showNotification(errorMessage, 'error');
        }
      });
    }

    // Connection status
    this._updateConnectionStatus();
    window.addEventListener('online', () => this._updateConnectionStatus());
    window.addEventListener('offline', () => this._updateConnectionStatus());

    // Sync button
    const syncButton = document.getElementById('sync-button');
    if (syncButton) {
      syncButton.addEventListener('click', async () => {
        syncButton.disabled = true;
        syncButton.innerHTML = '<span aria-hidden="true">⏳</span> Menyinkronkan...';

        try {
          const result = await window.syncOfflineStories();
          if (result.success > 0) {
            this._showNotification(`${result.success} cerita berhasil disinkronkan! ✅`, 'success');
            // Reload stories
            await this._loadStories();
          } else if (result.failed > 0) {
            this._showNotification('Gagal menyinkronkan beberapa cerita', 'error');
          } else {
            this._showNotification('Tidak ada cerita untuk disinkronkan', 'info');
          }
        } catch (error) {
          console.error('[PWA] Sync error:', error);
          this._showNotification('Gagal menyinkronkan cerita', 'error');
        } finally {
          syncButton.disabled = false;
          syncButton.innerHTML = '<span aria-hidden="true">🔄</span> Sinkronkan';
          this._updateConnectionStatus();
        }
      });
    }
  }

  _updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    const syncButton = document.getElementById('sync-button');

    if (!statusElement || !statusText) return;

    const isOnline = navigator.onLine;
    
    if (isOnline) {
      statusElement.classList.remove('offline');
      statusElement.classList.add('online');
      statusText.textContent = 'Online';
      
      // Check if there are offline stories to sync
      if (window.IDB && syncButton) {
        window.IDB.getUnsyncedStories().then(stories => {
          if (stories && stories.length > 0) {
            syncButton.style.display = 'block';
            syncButton.setAttribute('data-count', stories.length);
          } else {
            syncButton.style.display = 'none';
          }
        }).catch(err => {
          console.error('[PWA] Failed to check unsynced stories:', err);
        });
      }
    } else {
      statusElement.classList.remove('online');
      statusElement.classList.add('offline');
      statusText.textContent = 'Offline';
      if (syncButton) {
        syncButton.style.display = 'none';
      }
    }
  }

  _showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  _filterStories(searchTerm) {
    const filteredStories = this.stories.filter(story => 
      story.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    this._renderStoriesList(filteredStories);
    this._addMarkersToMap(filteredStories);
  }

  _onStoryCardClick(card) {
    const lat = parseFloat(card.dataset.lat);
    const lon = parseFloat(card.dataset.lon);
    const id = card.dataset.id;

    if (lat && lon) {
      // Pan to location
      this.map.setView([lat, lon], 13);

      // Find and open marker
      const marker = this.markers.find(m => m.storyId === id);
      if (marker) {
        marker.openPopup();
        this._setActiveMarker(marker);
      }
    }

    this._highlightStoryCard(id);
  }

  _highlightStoryCard(storyId) {
    // Remove previous highlights
    document.querySelectorAll('.story-card').forEach(card => {
      card.classList.remove('active');
    });

    // Add highlight to clicked card
    const card = document.querySelector(`.story-card[data-id="${storyId}"]`);
    if (card) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _setActiveMarker(marker) {
    // Reset previous active marker
    if (this.activeMarker) {
      this.activeMarker.setOpacity(1);
    }

    // Highlight new active marker
    marker.setOpacity(0.7);
    this.activeMarker = marker;

    // Reset opacity after 2 seconds
    setTimeout(() => {
      if (this.activeMarker === marker) {
        marker.setOpacity(1);
      }
    }, 2000);
  }

  async _handleBookmarkClick(bookmarkBtn) {
    const storyId = bookmarkBtn.dataset.id;
    const story = this.stories.find(s => s.id === storyId);
    
    if (!story) {
      console.error('[Bookmark] Story not found:', storyId);
      return;
    }

    try {
      const success = await window.IDB?.toggleBookmark?.(story);
      
      if (success) {
        const isBookmarked = await window.IDB?.isBookmarked?.(storyId) ?? false;
        
        // Update button UI
        bookmarkBtn.classList.toggle('bookmarked', isBookmarked);
        bookmarkBtn.querySelector('span').textContent = isBookmarked ? '💖' : '🤍';
        bookmarkBtn.setAttribute('aria-label', isBookmarked ? 'Hapus dari bookmark' : 'Tambah ke bookmark');
        bookmarkBtn.setAttribute('title', isBookmarked ? 'Hapus dari bookmark' : 'Tambah ke bookmark');
        
        // Show notification
        const message = isBookmarked 
          ? `"${story.name}" ditambahkan ke bookmark 💖` 
          : `"${story.name}" dihapus dari bookmark`;
        this._showNotification(message, 'success');
        
        // Update badge
        await this._updateBookmarkBadge();
      }
    } catch (error) {
      console.error('[Bookmark] Failed to toggle bookmark:', error);
      this._showNotification('Gagal mengubah bookmark', 'error');
    }
  }

  async _updateBookmarkBadge() {
    const badge = document.getElementById('bookmark-badge');
    if (badge) {
      const count = await window.IDB?.getBookmarkCount?.() ?? 0;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }
}
