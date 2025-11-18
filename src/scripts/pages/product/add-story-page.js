import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ApiService from '../../data/api';

export default class AddStoryPage {
  constructor() {
    this.map = null;
    this.marker = null;
    this.selectedLocation = null;
    this.mediaStream = null;
    this.capturedImage = null;
  }

  async render() {
    return `
      <section class="add-story-container container">
        <div class="add-story-header">
          <h1 class="page-title">☕Tulis Ceritamu dengan Bebas</h1>
          <p class="page-description">🌻 Tuliskan kenangan yang bikin kamu tersenyum</p>
        </div>

        <form id="add-story-form" class="add-story-form" aria-label="Form tambah cerita">
          <div class="form-section">
            <h2 class="section-title">☁️ Cerita Hari Ini</h2>
            
            <div class="form-group">
              <label for="story-title" class="form-label">Judul Cerita *</label>
              <input 
                type="text" 
                id="story-title" 
                name="story-title" 
                class="form-input" 
                placeholder="Contoh: Mark lee si Canada boy🍁"
                required
                aria-required="true"
                minlength="3"
              />
              <small class="form-hint">Minimal 3️⃣ karakter iyaa</small>
            </div>

            <div class="form-group">
              <label for="description" class="form-label">Deskripsi Cerita *</label>
              <textarea 
                id="description" 
                name="description" 
                class="form-textarea" 
                placeholder="🪶 Tulis kisah serumu di sini..."
                required
                aria-required="true"
                rows="4"
                minlength="20"
              ></textarea>
              <small class="form-hint">Minimal 20 karakter ya, biar kisahmu lebih berwarna 🌸</small>
            </div>

            <div class="form-group">
              <label class="form-label">Foto Cerita *</label>
              <div class="photo-input-wrapper">
                <div class="photo-tabs" role="tablist">
                  <button 
                    type="button" 
                    class="photo-tab active" 
                    data-tab="upload"
                    role="tab"
                    aria-selected="true"
                    aria-controls="upload-panel"
                  >
                    📁 Upload Foto
                  </button>
                  <button 
                    type="button" 
                    class="photo-tab" 
                    data-tab="camera"
                    role="tab"
                    aria-selected="false"
                    aria-controls="camera-panel"
                  >
                    📷 Ambil Foto
                  </button>
                </div>

                <div id="upload-panel" class="photo-panel active" role="tabpanel" aria-labelledby="upload-tab">
                  <input 
                    type="file" 
                    id="photo-upload" 
                    name="photo" 
                    class="form-file-input" 
                    accept="image/*"
                    aria-label="Upload foto cerita"
                  />
                  <label for="photo-upload" class="file-label" tabindex="0">
                    <span class="file-icon" aria-hidden="true">🖼️</span>
                    <span class="file-text">Pilih foto atau drag di sini</span>
                    <span class="file-hint">format PNG, JPG maksimal 10MB🗂️</span>
                  </label>
                </div>

                <div id="camera-panel" class="photo-panel" role="tabpanel" aria-labelledby="camera-tab" hidden>
                  <div id="camera-container" class="camera-container">
                    <video id="camera-video" class="camera-video" autoplay playsinline aria-label="Preview kamera"></video>
                    <div class="camera-controls">
                      <button type="button" id="start-camera" class="btn btn-secondary">
                        🎥Buka Kamera
                      </button>
                      <button type="button" id="capture-photo" class="btn btn-primary" style="display:none;">
                        📸 Ambil Foto
                      </button>
                      <button type="button" id="stop-camera" class="btn btn-secondary" style="display:none;">
                        📴Tutup Kamera
                      </button>
                    </div>
                  </div>
                </div>

                <div id="photo-preview" class="photo-preview" style="display:none;">
                  <img id="preview-image" src="" alt="Preview foto cerita" class="preview-image" />
                  <button type="button" id="remove-photo" class="btn-remove" aria-label="Hapus foto">
                    ❌
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h2 class="section-title">📍 Lokasi Cerita</h2>
            <p class="section-description">Klik pada peta untuk menandai lokasi cerita Anda🗺️</p>
            
            <div id="location-map" class="location-map" role="application" aria-label="Klik pada peta untuk memilih lokasi"></div>
            
            <div id="selected-location" class="selected-location" style="display:none;">
              <p class="location-info">
                <strong>Lokasi Dipilih:</strong><br>
                Latitude: <span id="selected-lat">-</span><br>
                Longitude: <span id="selected-lon">-</span>
              </p>
              <button type="button" id="clear-location" class="btn btn-secondary btn-sm">
                🗑️Hapus Lokasi
              </button>
            </div>
          </div>

          <div id="form-message" class="form-message" role="alert" aria-live="polite"></div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="window.history.back()">
              ⬅️Batal
            </button>
            <button type="submit" class="btn btn-primary" id="submit-button">
              <span class="btn-text">📤Bagikan Ceritaku!</span>
              <span class="btn-loader" aria-hidden="true"></span>
            </button>
          </div>
        </form>
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
    this._initEventListeners();
  }

  _initMap() {
    this.map = L.map('location-map').setView([-2.5, 118], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    // Fix marker icon
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    // Click to select location
    this.map.on('click', (e) => {
      this._selectLocation(e.latlng);
    });
  }

  _selectLocation(latlng) {
    // Remove existing marker
    if (this.marker) {
      this.marker.remove();
    }

    // Add new marker
    this.marker = L.marker([latlng.lat, latlng.lng]).addTo(this.map);
    this.selectedLocation = { lat: latlng.lat, lon: latlng.lng };

    // Update UI
    document.getElementById('selected-lat').textContent = latlng.lat.toFixed(6);
    document.getElementById('selected-lon').textContent = latlng.lng.toFixed(6);
    document.getElementById('selected-location').style.display = 'block';
  }

  _initEventListeners() {
    // Photo tabs
    const photoTabs = document.querySelectorAll('.photo-tab');
    photoTabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchPhotoTab(tab));
    });

    // File input
    const photoUpload = document.getElementById('photo-upload');
    const fileLabel = document.querySelector('.file-label');
    
    photoUpload.addEventListener('change', (e) => this._handleFileSelect(e));
    
    fileLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        photoUpload.click();
      }
    });

    // Camera controls
    document.getElementById('start-camera').addEventListener('click', () => this._startCamera());
    document.getElementById('capture-photo').addEventListener('click', () => this._capturePhoto());
    document.getElementById('stop-camera').addEventListener('click', () => this._stopCamera());

    // Remove photo
    document.getElementById('remove-photo').addEventListener('click', () => this._removePhoto());

    // Clear location
    document.getElementById('clear-location').addEventListener('click', () => this._clearLocation());

    // Form submit
    const form = document.getElementById('add-story-form');
    form.addEventListener('submit', (e) => this._handleSubmit(e));
  }

  _switchPhotoTab(clickedTab) {
    const tabName = clickedTab.dataset.tab;

    // Update tabs
    document.querySelectorAll('.photo-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });
    clickedTab.classList.add('active');
    clickedTab.setAttribute('aria-selected', 'true');

    // Update panels
    document.querySelectorAll('.photo-panel').forEach(panel => {
      panel.classList.remove('active');
      panel.hidden = true;
    });
    const activePanel = document.getElementById(`${tabName}-panel`);
    activePanel.classList.add('active');
    activePanel.hidden = false;

    // Stop camera if switching away from camera tab
    if (tabName !== 'camera' && this.mediaStream) {
      this._stopCamera();
    }
  }

  _handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this._showMessage('🧷Mohon pilih file gambar', 'error');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        this._showMessage('💾Ukuran file maksimal 10MB', 'error');
        return;
      }

      this._showPhotoPreview(file);
    }
  }

  async _startCamera() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      const video = document.getElementById('camera-video');
      video.srcObject = this.mediaStream;
      video.style.display = 'block';

      document.getElementById('start-camera').style.display = 'none';
      document.getElementById('capture-photo').style.display = 'inline-block';
      document.getElementById('stop-camera').style.display = 'inline-block';
    } catch (error) {
      this._showMessage('🔒Tidak dapat mengakses kamera: ' + error.message, 'error');
    }
  }

  _capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'product-photo.jpg', { type: 'image/jpeg' });
      this.capturedImage = file;
      this._showPhotoPreview(file);
      this._stopCamera();
    }, 'image/jpeg', 0.9);
  }

  _stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    const video = document.getElementById('camera-video');
    video.style.display = 'none';
    video.srcObject = null;

    document.getElementById('start-camera').style.display = 'inline-block';
    document.getElementById('capture-photo').style.display = 'none';
    document.getElementById('stop-camera').style.display = 'none';
  }

  _showPhotoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('preview-image').src = e.target.result;
      document.getElementById('photo-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  _removePhoto() {
    document.getElementById('photo-upload').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    this.capturedImage = null;
  }

  _clearLocation() {
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
    this.selectedLocation = null;
    document.getElementById('selected-location').style.display = 'none';
  }

  async _handleSubmit(event) {
    event.preventDefault();

    const storyTitle = document.getElementById('story-title').value.trim();
    const description = document.getElementById('description').value.trim();
    const photoFile = this.capturedImage || document.getElementById('photo-upload').files[0];
    const submitButton = document.getElementById('submit-button');
    const formMessage = document.getElementById('form-message');

    // Clear previous messages
    formMessage.textContent = '';
    formMessage.style.display = 'none';

    // Validation
    if (storyTitle.length < 3) {
      this._showMessage('🔢Judul cerita minimal 3 karakter', 'error');
      return;
    }

    if (description.length < 20) {
      this._showMessage('💭Deskripsi minimal 20 karakter', 'error');
      return;
    }

    if (!photoFile) {
      this._showMessage('🎞️Mohon pilih atau ambil foto cerita', 'error');
      return;
    }

    if (!this.selectedLocation) {
      this._showMessage('📌Mohon tandai lokasi cerita Anda pada peta', 'error');
      return;
    }

    // Show loading
    submitButton.classList.add('loading');
    submitButton.disabled = true;

    // Check if online
    const isOnline = navigator.onLine;

    try {
      const storyData = {
        description: description,
        photo: photoFile,
        lat: this.selectedLocation.lat,
        lon: this.selectedLocation.lon,
      };

      console.log('Sending story data:', { 
        description: description.substring(0, 50) + '...', 
        photoSize: photoFile.size,
        lat: this.selectedLocation.lat,
        lon: this.selectedLocation.lon,
        isOnline 
      });

      if (!isOnline && window.IDB) {
        // Save to IndexedDB for later sync
        await window.IDB.saveOfflineStory({
          description: description,
          photoBlob: photoFile,
          lat: this.selectedLocation.lat,
          lon: this.selectedLocation.lon,
          timestamp: Date.now(),
          synced: false
        });
        
        this._showMessage('📴 Offline: Cerita disimpan dan akan disinkronkan saat online', 'warning');
        
        // Clean up camera
        this._stopCamera();

        setTimeout(() => {
          window.location.hash = '#/';
        }, 2000);
      } else {
        // Online: Submit directly to API
        await ApiService.addStory(storyData);
        
        this._showMessage('🚀 Cerita berhasil dibagikan! Mengalihkan...', 'success');
        
        // Show local notification if subscribed
        this._showSuccessNotification(description);
        
        // Clean up camera
        this._stopCamera();

        setTimeout(() => {
          window.location.hash = '#/';
        }, 1500);
      }
    } catch (error) {
      console.error('Submit error:', error);
      
      // If API fails and we're online, try saving offline
      if (isOnline && window.IDB) {
        try {
          await window.IDB.saveOfflineStory({
            description: description,
            photoBlob: photoFile,
            lat: this.selectedLocation.lat,
            lon: this.selectedLocation.lon,
            timestamp: Date.now(),
            synced: false
          });
          
          this._showMessage('⚠️ Gagal mengirim, cerita disimpan untuk disinkronkan nanti', 'warning');
          
          setTimeout(() => {
            window.location.hash = '#/';
          }, 2000);
        } catch (dbError) {
          console.error('Failed to save offline:', dbError);
          this._showMessage('❌ ' + error.message, 'error');
        }
      } else {
        this._showMessage('❌ ' + error.message, 'error');
      }
      
      submitButton.classList.remove('loading');
      submitButton.disabled = false;
    }
  }

  _showMessage(message, type) {
    const formMessage = document.getElementById('form-message');
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}-message`;
    formMessage.style.display = 'block';
  }

  async _showSuccessNotification(description) {
    // Check if push notification is enabled or if Notification permission is granted.
    // We show a local notification if the user has granted Notification permission
    // (even when not subscribed for backend push), to give immediate feedback.
    const isPushSubscribed = await window.isPushSubscribed?.() || (Notification.permission === 'granted');
    if (!isPushSubscribed) {
      return; // Don't show notification if user hasn't enabled it and permission isn't granted
    }

    // Show local notification (mimicking backend push notification)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification('Story berhasil dibuat', {
            body: `Anda telah membuat story baru dengan deskripsi: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`,
            icon: '/images/logo-192.png',
            badge: '/images/logo-72.png',
            tag: 'story-created',
            data: {
              url: '/',
              dateTime: Date.now()
            },
            actions: [
              {
                action: 'view',
                title: 'Lihat Story'
              }
            ],
            vibrate: [200, 100, 200]
          });
          console.log('[PWA] ✅ Local notification shown');
        }
      } catch (error) {
        console.error('[PWA] Failed to show notification:', error);
      }
    }
  }
}
