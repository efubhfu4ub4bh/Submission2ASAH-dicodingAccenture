const DB_NAME = 'story-app-db';
const DB_VERSION = 2;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      
      // Stories store for caching API data
      if (!_db.objectStoreNames.contains('stories')) {
        const storiesStore = _db.createObjectStore('stories', { keyPath: 'id' });
        storiesStore.createIndex('createdAt', 'createdAt', { unique: false });
        storiesStore.createIndex('name', 'name', { unique: false });
        console.log('[IDB] Created stories store');
      }
      
      // Offline stories (outbox) for sync
      if (!_db.objectStoreNames.contains('outbox')) {
        const outboxStore = _db.createObjectStore('outbox', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
        outboxStore.createIndex('synced', 'synced', { unique: false });
        console.log('[IDB] Created outbox store');
      }
      
      // Bookmarks store for user's favorite stories
      if (!_db.objectStoreNames.contains('bookmarks')) {
        const bookmarksStore = _db.createObjectStore('bookmarks', { keyPath: 'id' });
        bookmarksStore.createIndex('bookmarkedAt', 'bookmarkedAt', { unique: false });
        bookmarksStore.createIndex('name', 'name', { unique: false });
        console.log('[IDB] Created bookmarks store');
      }
    };
    req.onsuccess = () => {
      db = req.result;
      console.log('[IDB] Database opened');
      resolve(db);
    };
    req.onerror = () => {
      console.error('[IDB] Error opening database');
      reject(req.error);
    };
  });
}

async function addToStore(storeName, value) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).add(value);
    request.onsuccess = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function putToStore(storeName, value) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromStore(storeName) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getFromStore(storeName, key) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromStore(storeName, key) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName) {
  if (!db) await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function searchStories(query) {
  const stories = await getAllFromStore('stories');
  const lowerQuery = query.toLowerCase();
  return stories.filter(story => 
    story.name.toLowerCase().includes(lowerQuery) ||
    story.description.toLowerCase().includes(lowerQuery)
  );
}

async function sortStories(field = 'createdAt', order = 'desc') {
  const stories = await getAllFromStore('stories');
  return stories.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}

async function saveStories(stories) {
  if (!db) await openDB();
  const tx = db.transaction('stories', 'readwrite');
  const store = tx.objectStore('stories');
  
  for (const story of stories) {
    store.put(story);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`[IDB] Saved ${stories.length} stories`);
      resolve(true);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function saveOfflineStory(storyData) {
  const offlineStory = {
    ...storyData,
    timestamp: new Date().toISOString(),
    synced: false
  };
  return await addToStore('outbox', offlineStory);
}

async function getUnsyncedStories() {
  const allOutbox = await getAllFromStore('outbox');
  return allOutbox.filter(story => !story.synced);
}

async function markStorySynced(id) {
  const story = await getFromStore('outbox', id);
  if (story) {
    story.synced = true;
    story.syncedAt = new Date().toISOString();
    await putToStore('outbox', story);
  }
}

// ========== BOOKMARK FUNCTIONS ==========

async function addBookmark(story) {
  const bookmark = {
    ...story,
    bookmarkedAt: new Date().toISOString()
  };
  try {
    await putToStore('bookmarks', bookmark);
    console.log(`[IDB] Bookmarked story: ${story.name}`);
    return true;
  } catch (error) {
    console.error('[IDB] Failed to add bookmark:', error);
    return false;
  }
}

async function removeBookmark(storyId) {
  try {
    await deleteFromStore('bookmarks', storyId);
    console.log(`[IDB] Removed bookmark: ${storyId}`);
    return true;
  } catch (error) {
    console.error('[IDB] Failed to remove bookmark:', error);
    return false;
  }
}

async function getBookmarks() {
  try {
    const bookmarks = await getAllFromStore('bookmarks');
    // Sort by most recently bookmarked
    return bookmarks.sort((a, b) => 
      new Date(b.bookmarkedAt) - new Date(a.bookmarkedAt)
    );
  } catch (error) {
    console.error('[IDB] Failed to get bookmarks:', error);
    return [];
  }
}

async function isBookmarked(storyId) {
  try {
    const bookmark = await getFromStore('bookmarks', storyId);
    return !!bookmark;
  } catch (error) {
    console.error('[IDB] Failed to check bookmark:', error);
    return false;
  }
}

async function toggleBookmark(story) {
  const bookmarked = await isBookmarked(story.id);
  if (bookmarked) {
    return await removeBookmark(story.id);
  } else {
    return await addBookmark(story);
  }
}

async function getBookmarkCount() {
  try {
    const bookmarks = await getAllFromStore('bookmarks');
    return bookmarks.length;
  } catch (error) {
    console.error('[IDB] Failed to get bookmark count:', error);
    return 0;
  }
}

window.IDB = {
  openDB,
  addToStore,
  putToStore,
  getAllFromStore,
  getFromStore,
  deleteFromStore,
  clearStore,
  searchStories,
  sortStories,
  saveStories,
  saveOfflineStory,
  getUnsyncedStories,
  markStorySynced,
  // Bookmark functions
  addBookmark,
  removeBookmark,
  getBookmarks,
  isBookmarked,
  toggleBookmark,
  getBookmarkCount
};
