(function(){
  // VAPID public key for push notifications
  const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';
  
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[PWA] Service Worker registered:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[PWA] New service worker found');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New version available');
                // Show update notification
                showUpdateNotification();
              }
            });
          });
        })
        .catch(error => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PWA] Message from SW:', event.data);
        
        if (event.data.type === 'SYNC_OFFLINE_DATA') {
          // Trigger sync when coming back online
          if (window.syncOfflineStories) {
            window.syncOfflineStories();
          }
        }
      });
    });
  }

  function showUpdateNotification() {
    if (confirm('Ada versi baru tersedia! Reload untuk update?')) {
      window.location.reload();
    }
  }

  // Check push notification permission
  window.checkNotificationPermission = async function() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  };

  // Request notification permission
  window.requestNotificationPermission = async function() {
    if (!('Notification' in window)) {
      throw new Error('Browser tidak support notifikasi');
    }
    
    const permission = await Notification.requestPermission();
    return permission;
  };

  // Subscribe to push notifications
  window.subscribePush = async function(token) {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }
    
    if (!('PushManager' in window)) {
      throw new Error('Push messaging not supported');
    }

    // Request permission first
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[PWA] Subscribed to push notifications');
    }

    // Save subscription status
    localStorage.setItem('pushSubscribed', 'true');
    localStorage.setItem('pushSubscription', JSON.stringify(subscription.toJSON()));

    return subscription;
  };

  // Unsubscribe from push notifications
  window.unsubscribePush = async function() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[PWA] Unsubscribed from push notifications');
    }

    localStorage.setItem('pushSubscribed', 'false');
    localStorage.removeItem('pushSubscription');
  };

  // Check if currently subscribed
  window.isPushSubscribed = async function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch (error) {
      console.error('[PWA] Error checking subscription:', error);
      return false;
    }
  };

  // Simulate push notification for testing
  window.testPushNotification = async function(title, body, storyId) {
    if (!('serviceWorker' in navigator)) return;
    
    const registration = await navigator.serviceWorker.ready;
    
    registration.showNotification(title || 'Story App', {
      body: body || 'Ada cerita baru! Klik untuk melihat.',
      icon: '/images/logo-192.png',
      badge: '/images/logo-72.png',
      data: {
        url: '/',
        storyId: storyId
      },
      actions: [
        {
          action: 'open',
          title: 'Lihat Cerita'
        },
        {
          action: 'close',
          title: 'Tutup'
        }
      ],
      vibrate: [200, 100, 200],
      requireInteraction: false
    });
  };

  // Sync offline stories when back online
  window.syncOfflineStories = async function() {
    if (!window.IDB) {
      console.warn('[PWA] IDB not available for sync');
      return;
    }

    try {
      console.log('[PWA] Starting offline sync...');
      const unsyncedStories = await IDB.getUnsyncedStories();
      
      if (!unsyncedStories || unsyncedStories.length === 0) {
        console.log('[PWA] No offline stories to sync');
        return { success: 0, failed: 0 };
      }

      console.log(`[PWA] Found ${unsyncedStories.length} offline stories to sync`);
      let successCount = 0;
      let failedCount = 0;

      for (const story of unsyncedStories) {
        try {
          const formData = new FormData();
          formData.append('description', story.description);
          
          // Handle photo - if it's a blob or file
          if (story.photoBlob) {
            formData.append('photo', story.photoBlob, 'photo.jpg');
          } else if (story.photo) {
            formData.append('photo', story.photo);
          }
          
          if (story.lat) formData.append('lat', story.lat);
          if (story.lon) formData.append('lon', story.lon);

          const token = localStorage.getItem('token');
          const response = await fetch('https://story-api.dicoding.dev/v1/stories', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (response.ok) {
            await IDB.markStorySynced(story.id);
            successCount++;
            console.log(`[PWA] Synced story ${story.id}`);
          } else {
            failedCount++;
            console.error(`[PWA] Failed to sync story ${story.id}:`, response.status);
          }
        } catch (error) {
          failedCount++;
          console.error('[PWA] Error syncing story:', error);
        }
      }

      console.log(`[PWA] Sync complete: ${successCount} success, ${failedCount} failed`);
      
      // Show notification if any stories were synced
      if (successCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification('Sync Berhasil', {
          body: `${successCount} cerita berhasil disinkronkan`,
          icon: '/images/logo-192.png'
        });
      }

      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('[PWA] Sync failed:', error);
      throw error;
    }
  };

  // Listen for online event
  window.addEventListener('online', () => {
    console.log('[PWA] Connection restored - attempting sync');
    if (window.syncOfflineStories) {
      window.syncOfflineStories().catch(err => {
        console.error('[PWA] Auto-sync failed:', err);
      });
    }
  });

  // Listen for offline event
  window.addEventListener('offline', () => {
    console.log('[PWA] Connection lost - entering offline mode');
  });

  // Check connection status
  window.isOnline = function() {
    return navigator.onLine;
  };

  // Install prompt handling
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    // Show custom install button
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'block';
    }
  });

  window.showInstallPrompt = async function() {
    if (!deferredPrompt) {
      console.log('[PWA] Install prompt not available');
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    
    deferredPrompt = null;
    
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'none';
    }

    return outcome === 'accepted';
  };

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
  });

  console.log('[PWA] Integration loaded');
})();
