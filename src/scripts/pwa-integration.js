/**
 * PWA Integration
 * Handles service worker, push notifications, offline sync, and app installation
 */
(function() {
  'use strict';

  const CONFIG = {
    VAPID_KEY: 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk',
    API_BASE: 'https://story-api.dicoding.dev/v1',
    STORAGE_KEYS: {
      PUSH_SUBSCRIBED: 'pushSubscribed',
      PUSH_SUBSCRIPTION: 'pushSubscription',
      SUBSCRIPTION_ID: 'pushSubscriptionId',
      NOTIFICATION_MODE: 'notificationOnlyMode',
      TOKEN: 'token'
    }
  };

  // Utilities
  const Utils = {
    urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    },

    getToken() {
      return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    },

    setStorage(key, value) {
      localStorage.setItem(key, value);
    },

    getStorage(key) {
      return localStorage.getItem(key);
    },

    removeStorage(key) {
      localStorage.removeItem(key);
    }
  };

  // Service Worker Manager
  const ServiceWorkerManager = {
    init() {
      if (!('serviceWorker' in navigator)) return;

      window.addEventListener('load', () => {
        this.register();
        this.listenForMessages();
      });
    },

    async register() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA] Service Worker registered');
        
        registration.addEventListener('updatefound', () => {
          this.handleUpdate(registration.installing);
        });
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    },

    handleUpdate(newWorker) {
      console.log('[PWA] New service worker found');
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New version available');
          this.showUpdateNotification();
        }
      });
    },

    showUpdateNotification() {
      if (confirm('Ada versi baru tersedia! Reload untuk update?')) {
        window.location.reload();
      }
    },

    listenForMessages() {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PWA] Message from SW:', event.data);
        
        if (event.data.type === 'SYNC_OFFLINE_DATA' && window.syncOfflineStories) {
          window.syncOfflineStories();
        }
      });
    }
  };

  // Push Notification Manager
  const PushManager = {
    async checkPermission() {
      return 'Notification' in window ? Notification.permission : 'unsupported';
    },

    async requestPermission() {
      if (!('Notification' in window)) {
        throw new Error('Browser tidak support notifikasi');
      }
      return await Notification.requestPermission();
    },

    async subscribe() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push notification tidak didukung');
      }

      const token = Utils.getToken();
      if (!token) {
        throw new Error('Anda harus login terlebih dahulu');
      }

      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Izin notifikasi ditolak');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await this.createSubscription(registration);
        if (!subscription) return this.enableNotificationOnlyMode();
      }

      return await this.sendToBackend(subscription, token);
    },

    async createSubscription(registration) {
      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Utils.urlBase64ToUint8Array(CONFIG.VAPID_KEY)
        });
        console.log('[PWA] Browser subscribed to push');
        return subscription;
      } catch (error) {
        if (error.name === 'AbortError' || error.message.includes('push service')) {
          console.log('[PWA] Using notification-only mode');
          return null;
        }
        throw error;
      }
    },

    enableNotificationOnlyMode() {
      Utils.setStorage(CONFIG.STORAGE_KEYS.PUSH_SUBSCRIBED, 'true');
      Utils.setStorage(CONFIG.STORAGE_KEYS.NOTIFICATION_MODE, 'true');
      return {
        subscription: null,
        backendData: {
          error: false,
          message: 'Notification enabled (local mode)',
          mode: 'notification-only'
        }
      };
    },

    async sendToBackend(subscription, token) {
      try {
        const subscriptionData = subscription.toJSON();
        // Remove expirationTime if exists
        delete subscriptionData.expirationTime;
        
        const response = await fetch(`${CONFIG.API_BASE}/notifications/subscribe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscriptionData),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Gagal subscribe ke backend');
        }

        console.log('[PWA] Subscription berhasil dikirim ke backend');
        
        Utils.setStorage(CONFIG.STORAGE_KEYS.PUSH_SUBSCRIBED, 'true');
        Utils.setStorage(CONFIG.STORAGE_KEYS.PUSH_SUBSCRIPTION, JSON.stringify(subscription.toJSON()));
        Utils.setStorage(CONFIG.STORAGE_KEYS.SUBSCRIPTION_ID, data.data?.id || '');
        Utils.removeStorage(CONFIG.STORAGE_KEYS.NOTIFICATION_MODE);

        return { subscription, backendData: data };
      } catch (error) {
        if (subscription) await subscription.unsubscribe();
        throw new Error('Gagal mendaftarkan notifikasi: ' + error.message);
      }
    },

    async unsubscribe() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          await this.removeFromBackend(subscription);
          await subscription.unsubscribe();
          console.log('[PWA] Browser unsubscribed');
        }

        Utils.setStorage(CONFIG.STORAGE_KEYS.PUSH_SUBSCRIBED, 'false');
        Utils.removeStorage(CONFIG.STORAGE_KEYS.PUSH_SUBSCRIPTION);
        Utils.removeStorage(CONFIG.STORAGE_KEYS.SUBSCRIPTION_ID);
        Utils.removeStorage(CONFIG.STORAGE_KEYS.NOTIFICATION_MODE);
        
        console.log('[PWA] Push notification dinonaktifkan');
      } catch (error) {
        console.error('[PWA] Unsubscribe error:', error);
        throw error;
      }
    },

    async removeFromBackend(subscription) {
      const token = Utils.getToken();
      if (!token) return;

      try {
        const response = await fetch(`${CONFIG.API_BASE}/notifications/subscribe`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endpoint: subscription.toJSON().endpoint }),
        });

        if (response.ok) {
          console.log('[PWA] Unsubscribe dari backend berhasil');
        }
      } catch (error) {
        console.warn('[PWA] Gagal menghubungi backend:', error.message);
      }
    },

    async isSubscribed() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
      }

      const localStatus = Utils.getStorage(CONFIG.STORAGE_KEYS.PUSH_SUBSCRIBED);
      if (localStatus === 'true') return true;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription !== null;
      } catch {
        return localStatus === 'true';
      }
    },

    async showNotification(title, body, data = {}) {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker not supported');
      }

      if (Notification.permission !== 'granted') {
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }
      
      const registration = await navigator.serviceWorker.ready;
      
      try {
        await registration.showNotification(title || 'Story App', {
          body: body || 'Ada cerita baru!',
          icon: '/images/logo-192.png',
          badge: '/images/logo-72.png',
          data: { url: '/', ...data },
          actions: [
            { action: 'open', title: 'Lihat' },
            { action: 'close', title: 'Tutup' }
          ],
          vibrate: [200, 100, 200]
        });
        
        console.log('[PWA] Notification sent');
        return true;
      } catch (error) {
        // Fallback
        if (Notification.permission === 'granted') {
          new Notification(title || 'Story App', {
            body: body || 'Ada cerita baru!',
            icon: '/images/logo-192.png'
          });
          return true;
        }
        throw error;
      }
    }
  };

  // Offline Sync Manager
  const SyncManager = {
    async syncOfflineStories() {
      if (!window.IDB) {
        console.warn('[PWA] IndexedDB not available');
        return { success: 0, failed: 0 };
      }

      const unsyncedStories = await IDB.getUnsyncedStories();
      
      if (!unsyncedStories || unsyncedStories.length === 0) {
        console.log('[PWA] No offline stories to sync');
        return { success: 0, failed: 0 };
      }

      console.log(`[PWA] Syncing ${unsyncedStories.length} offline stories`);
      let successCount = 0;
      let failedCount = 0;

      for (const story of unsyncedStories) {
        try {
          await this.syncStory(story);
          successCount++;
          console.log(`[PWA] Synced story ${story.id}`);
        } catch (error) {
          failedCount++;
          console.error('[PWA] Failed to sync:', error);
        }
      }

      console.log(`[PWA] Sync complete: ${successCount} success, ${failedCount} failed`);
      
      if (successCount > 0) {
        await PushManager.showNotification('Sync Berhasil', 
          `${successCount} cerita berhasil disinkronkan`
        );
      }

      return { success: successCount, failed: failedCount };
    },

    async syncStory(story) {
      const formData = new FormData();
      formData.append('description', story.description);
      
      if (story.photoBlob) {
        formData.append('photo', story.photoBlob, 'photo.jpg');
      } else if (story.photo) {
        formData.append('photo', story.photo);
      }
      
      if (story.lat) formData.append('lat', story.lat);
      if (story.lon) formData.append('lon', story.lon);

      const token = Utils.getToken();
      const response = await fetch(`${CONFIG.API_BASE}/stories`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await IDB.markStorySynced(story.id);
    },

    init() {
      window.addEventListener('online', () => {
        console.log('[PWA] Connection restored');
        this.syncOfflineStories().catch(err => {
          console.error('[PWA] Auto-sync failed:', err);
        });
      });

      window.addEventListener('offline', () => {
        console.log('[PWA] Connection lost');
      });
    }
  };

  // Install Manager
  const InstallManager = {
    deferredPrompt: null,

    init() {
      window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA] Install prompt available');
        e.preventDefault();
        this.deferredPrompt = e;
        this.showInstallButton();
      });

      window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed');
        this.deferredPrompt = null;
      });
    },

    showInstallButton() {
      const installButton = document.getElementById('install-button');
      if (installButton) {
        installButton.style.display = 'block';
      }
    },

    hideInstallButton() {
      const installButton = document.getElementById('install-button');
      if (installButton) {
        installButton.style.display = 'none';
      }
    },

    async prompt() {
      if (!this.deferredPrompt) {
        console.log('[PWA] Install prompt not available');
        return false;
      }

      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`[PWA] Install: ${outcome}`);
      
      this.deferredPrompt = null;
      this.hideInstallButton();

      return outcome === 'accepted';
    }
  };

  // Initialize all managers
  ServiceWorkerManager.init();
  SyncManager.init();
  InstallManager.init();

  // Export public API
  window.checkNotificationPermission = () => PushManager.checkPermission();
  window.requestNotificationPermission = () => PushManager.requestPermission();
  window.subscribePush = () => PushManager.subscribe();
  window.unsubscribePush = () => PushManager.unsubscribe();
  window.isPushSubscribed = () => PushManager.isSubscribed();
  window.testPushNotification = (title, body, data) => PushManager.showNotification(title, body, data);
  window.syncOfflineStories = () => SyncManager.syncOfflineStories();
  window.showInstallPrompt = () => InstallManager.prompt();
  window.isOnline = () => navigator.onLine;

  console.log('[PWA] Integration loaded');
})();
