import ApiService from '../../data/api';

export default class BookmarksPage {
  constructor() {
    this.bookmarks = [];
  }

  async render() {
    return `
      <section class="bookmarks-container">
        <div class="bookmarks-header container">
          <div class="header-top">
            <a href="#/" class="back-button" aria-label="Kembali ke beranda">
              <span aria-hidden="true">←</span> Kembali
            </a>
            <h1 class="page-title">📚 Bookmark Cerita</h1>
          </div>
          <p class="page-description">Cerita favorit yang telah kamu simpan ❤️</p>
          
          <div class="bookmarks-stats">
            <div class="stat-item">
              <span class="stat-icon" aria-hidden="true">📖</span>
              <span class="stat-value" id="bookmark-count">0</span>
              <span class="stat-label">Cerita Tersimpan</span>
            </div>
            <button id="clear-all-bookmarks" class="btn btn-danger" style="display: none;">
              <span aria-hidden="true">🗑️</span> Hapus Semua
            </button>
          </div>
        </div>

        <div class="bookmarks-content container">
          <div id="bookmarks-list" class="bookmarks-list" role="list">
            <div class="loading-spinner" aria-label="Memuat bookmark">Memuat bookmark...</div>
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

    await this._loadBookmarks();
    this._initEventListeners();
  }

  async _loadBookmarks() {
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarkCount = document.getElementById('bookmark-count');
    const clearAllButton = document.getElementById('clear-all-bookmarks');

    try {
      this.bookmarks = await window.IDB.getBookmarks();
      
      if (bookmarkCount) {
        bookmarkCount.textContent = this.bookmarks.length;
      }

      if (this.bookmarks.length === 0) {
        bookmarksList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon" aria-hidden="true">📚</div>
            <h2 class="empty-title">Belum Ada Bookmark</h2>
            <p class="empty-description">Mulai simpan cerita favoritmu dengan menekan tombol bookmark (💖) pada setiap cerita</p>
            <a href="#/" class="btn btn-primary">
              <span aria-hidden="true">🌏</span> Jelajahi Cerita
            </a>
          </div>
        `;
        if (clearAllButton) {
          clearAllButton.style.display = 'none';
        }
        return;
      }

      if (clearAllButton) {
        clearAllButton.style.display = 'block';
      }

      this._renderBookmarks();
    } catch (error) {
      console.error('[Bookmarks] Failed to load bookmarks:', error);
      bookmarksList.innerHTML = `
        <div class="error-message">
          <p>Gagal memuat bookmark: ${error.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Coba Lagi</button>
        </div>
      `;
    }
  }

  _renderBookmarks() {
    const bookmarksList = document.getElementById('bookmarks-list');

    bookmarksList.innerHTML = this.bookmarks.map(story => {
      const photoUrl = story.photoUrl || '';
      const storyName = story.name || 'Cerita Tanpa Judul';
      const description = story.description || '';
      const createdAt = story.createdAt || new Date().toISOString();
      const bookmarkedAt = story.bookmarkedAt || new Date().toISOString();
      const lat = story.lat || '';
      const lon = story.lon || '';

      return `
        <article class="bookmark-card" data-id="${story.id}" role="listitem">
          <div class="bookmark-image-wrapper">
            <img 
              src="${photoUrl}" 
              alt="${storyName}" 
              class="bookmark-image" 
              loading="lazy" 
              onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23ddd%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E'" 
            />
            <button 
              class="bookmark-remove-btn" 
              data-id="${story.id}" 
              aria-label="Hapus dari bookmark"
              title="Hapus dari bookmark"
            >
              <span aria-hidden="true">❌</span>
            </button>
          </div>
          <div class="bookmark-content">
            <h3 class="bookmark-title">${storyName}</h3>
            <p class="bookmark-author">Oleh: ${storyName}</p>
            <p class="bookmark-description">${description}</p>
            <div class="bookmark-meta">
              <time class="bookmark-date" datetime="${createdAt}" title="Tanggal cerita dibuat">
                <span aria-hidden="true">📅</span> ${new Date(createdAt).toLocaleDateString('id-ID', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </time>
              <time class="bookmark-saved" datetime="${bookmarkedAt}" title="Tanggal di-bookmark">
                <span aria-hidden="true">💖</span> Disimpan ${this._getRelativeTime(bookmarkedAt)}
              </time>
            </div>
            ${lat && lon ? `
              <a href="#/?lat=${lat}&lon=${lon}" class="bookmark-location" title="Lihat di peta">
                <span aria-hidden="true">📍</span> Lihat Lokasi di Peta
              </a>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  _initEventListeners() {
    const bookmarksList = document.getElementById('bookmarks-list');
    const clearAllButton = document.getElementById('clear-all-bookmarks');

    // Remove individual bookmark
    bookmarksList.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.bookmark-remove-btn');
      if (removeBtn) {
        const storyId = removeBtn.dataset.id;
        await this._removeBookmark(storyId);
      }
    });

    // Clear all bookmarks
    if (clearAllButton) {
      clearAllButton.addEventListener('click', async () => {
        if (confirm('Apakah kamu yakin ingin menghapus semua bookmark? Tindakan ini tidak dapat dibatalkan.')) {
          await this._clearAllBookmarks();
        }
      });
    }
  }

  async _removeBookmark(storyId) {
    try {
      const success = await window.IDB.removeBookmark(storyId);
      if (success) {
        this._showNotification('Bookmark dihapus ✓', 'success');
        // Reload bookmarks
        await this._loadBookmarks();
        
        // Dispatch event to update home page if it's listening
        window.dispatchEvent(new CustomEvent('bookmark-changed', { 
          detail: { storyId, action: 'removed' }
        }));
      } else {
        this._showNotification('Gagal menghapus bookmark', 'error');
      }
    } catch (error) {
      console.error('[Bookmarks] Failed to remove bookmark:', error);
      this._showNotification('Gagal menghapus bookmark', 'error');
    }
  }

  async _clearAllBookmarks() {
    try {
      const bookmarks = await window.IDB.getBookmarks();
      for (const bookmark of bookmarks) {
        await window.IDB.removeBookmark(bookmark.id);
      }
      
      this._showNotification('Semua bookmark dihapus ✓', 'success');
      await this._loadBookmarks();
      
      // Dispatch event to update home page
      window.dispatchEvent(new CustomEvent('bookmark-changed', { 
        detail: { action: 'cleared' }
      }));
    } catch (error) {
      console.error('[Bookmarks] Failed to clear bookmarks:', error);
      this._showNotification('Gagal menghapus bookmark', 'error');
    }
  }

  _getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan lalu`;
    return `${Math.floor(diffDays / 365)} tahun lalu`;
  }

  _showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'alert');
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}
