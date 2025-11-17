import CONFIG from '../config';

const ENDPOINTS = {
  REGISTER: `${CONFIG.BASE_URL}/register`,
  LOGIN: `${CONFIG.BASE_URL}/login`,
  STORIES: `${CONFIG.BASE_URL}/stories`,
  ADD_STORY: `${CONFIG.BASE_URL}/stories`,
  STORIES_WITH_LOCATION: `${CONFIG.BASE_URL}/stories?location=1`,
  PUSH_SUBSCRIBE: `${CONFIG.BASE_URL}/notifications/subscribe`,
  PUSH_UNSUBSCRIBE: `${CONFIG.BASE_URL}/notifications/subscribe`,
};

class ApiService {
  static async _fetchWithRetry(url, options = {}, retries = 2, backoff = 500) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      // Network errors (e.g., ERR_NETWORK_CHANGED) usually surface as TypeError in fetch
      if (retries > 0) {
        // wait for backoff ms then retry
        await new Promise((r) => setTimeout(r, backoff));
        return this._fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      // rethrow original error after retries exhausted
      throw err;
    }
  }
  static getToken() {
    return localStorage.getItem('token');
  }

  static setToken(token) {
    localStorage.setItem('token', token);
  }

  static removeToken() {
    localStorage.removeItem('token');
  }

  static isAuthenticated() {
    return !!this.getToken();
  }

  static async register({ name, email, password }) {
    const response = await this._fetchWithRetry(ENDPOINTS.REGISTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Pendaftaran gagal');
    }

    return data;
  }

  static async login({ email, password }) {
    const response = await this._fetchWithRetry(ENDPOINTS.LOGIN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login gagal');
    }

    // Dicoding API returns token in loginResult.token (not nested in data.data)
    if (data.loginResult && data.loginResult.token) {
      this.setToken(data.loginResult.token);
      console.log('Token saved successfully:', data.loginResult.token.substring(0, 20) + '...');
    } else {
      console.error('Token not found in response:', data);
      throw new Error('Token tidak ditemukan dalam response');
    }

    return data;
  }

  static async getStories() {
    const response = await this._fetchWithRetry(ENDPOINTS.STORIES_WITH_LOCATION, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Gagal memuat cerita');
    }

    return data;
  }

  static async addStory({ description, photo, lat, lon }) {
    const formData = new FormData();
    formData.append('description', description);
    formData.append('photo', photo);
    
    if (lat !== undefined && lon !== undefined) {
      formData.append('lat', lat);
      formData.append('lon', lon);
    }

    const response = await this._fetchWithRetry(ENDPOINTS.ADD_STORY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
      },
      body: formData,
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Gagal menambahkan cerita');
    }

    return data;
  }

  static async subscribePushNotification(subscription) {
    const subscriptionObject = subscription.toJSON ? subscription.toJSON() : subscription;
    
    const response = await this._fetchWithRetry(ENDPOINTS.PUSH_SUBSCRIBE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: subscriptionObject.endpoint,
        keys: subscriptionObject.keys
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Gagal subscribe push notification');
    }

    return data;
  }

  static async unsubscribePushNotification(endpoint) {
    const response = await this._fetchWithRetry(ENDPOINTS.PUSH_UNSUBSCRIBE, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Gagal unsubscribe push notification');
    }

    return data;
  }

  static logout() {
    this.removeToken();
    window.location.hash = '#/login';
  }
}

export default ApiService;