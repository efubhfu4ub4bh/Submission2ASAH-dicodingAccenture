import ApiService from '../../data/api';

export default class LoginPage {
  async render() {
    return `
      <section class="auth-container container">
        <div class="auth-card">
          <h1 class="auth-title">💭📖 StorySpace</h1>
          <p class="auth-description">Selamat datang! Masuk untuk mulai berbagi kisahmu 🌿</p>
          
          <form id="login-form" class="auth-form" aria-label="Form login">
            <div class="form-group">
              <label for="email" class="form-label">Alamat Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                class="form-input" 
                placeholder="Masukkan email Anda✉️"
                required
                aria-required="true"
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label for="password" class="form-label">Kata Sandi</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                class="form-input" 
                placeholder="Masukkan kata sandi🔒"
                required
                aria-required="true"
                autocomplete="current-password"
                minlength="8"
              />
            </div>

            <div id="error-message" class="error-message" role="alert" aria-live="polite"></div>

            <button type="submit" class="btn btn-primary" id="login-button">
              <span class="btn-text">🚪Masuk</span>
              <span class="btn-loader" aria-hidden="true"></span>
            </button>
          </form>

          <p class="auth-footer">
            Belum punya akun? 
            <a href="#/register" class="auth-link">Daftar di sini 🚀</a>
          </p>
        </div>
      </section>
    `;
  }

  async afterRender() {
    // If already logged in, redirect to home
    if (ApiService.isAuthenticated()) {
      window.location.hash = '#/';
      return;
    }

    const form = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      // Validation
      errorMessage.textContent = '';
      errorMessage.style.display = 'none';

      if (!this._validateEmail(email)) {
        this._showError(errorMessage, 'Masukkan alamat email yang valid');
        return;
      }

      if (password.length < 8) {
        this._showError(errorMessage, 'Kata sandi minimal 8 karakter');
        return;
      }

      // Show loading
      loginButton.classList.add('loading');
      loginButton.disabled = true;

      try {
        await ApiService.login({ email, password });
        
        // Verify token is saved before redirect
        if (!ApiService.isAuthenticated()) {
          throw new Error('Token tidak tersimpan. Silakan coba lagi.');
        }
        
        this._showSuccess(errorMessage, 'Login berhasil! Mengalihkan...');
        
        // Redirect immediately without delay
        setTimeout(() => {
          window.location.hash = '#/';
        }, 300);
      } catch (error) {
        this._showError(errorMessage, error.message);
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
      }
    });
  }

  _validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  _showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.className = 'error-message';
  }

  _showSuccess(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.className = 'success-message';
  }
}
