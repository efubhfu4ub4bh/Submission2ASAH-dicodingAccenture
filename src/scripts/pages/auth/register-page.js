import ApiService from '../../data/api';

export default class RegisterPage {
  async render() {
    return `
      <section class="auth-container container">
        <div class="auth-card">
          <h1 class="auth-title">Buat Akun</h1>
          <p class="auth-description">Bergabunglah dengan Local Market dan mulai berjualan!</p>
          
          <form id="register-form" class="auth-form" aria-label="Form pendaftaran">
            <div class="form-group">
              <label for="name" class="form-label">Nama Lengkap</label>
              <input 
                type="text" 
                id="name" 
                name="name" 
                class="form-input" 
                placeholder="Masukkan nama lengkap"
                required
                aria-required="true"
                autocomplete="name"
                minlength="3"
              />
            </div>

            <div class="form-group">
              <label for="email" class="form-label">Alamat Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                class="form-input" 
                placeholder="Masukkan email Anda"
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
                placeholder="Masukkan kata sandi (min. 8 karakter)"
                required
                aria-required="true"
                autocomplete="new-password"
                minlength="8"
              />
              <small class="form-hint">Kata sandi minimal 8 karakter</small>
            </div>

            <div id="error-message" class="error-message" role="alert" aria-live="polite"></div>

            <button type="submit" class="btn btn-primary" id="register-button">
              <span class="btn-text">Buat Akun</span>
              <span class="btn-loader" aria-hidden="true"></span>
            </button>
          </form>

          <p class="auth-footer">
            Sudah punya akun? 
            <a href="#/login" class="auth-link">Masuk di sini</a>
          </p>
        </div>
      </section>
    `;
  }

  async afterRender() {
    const form = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');
    const registerButton = document.getElementById('register-button');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      // Validation
      errorMessage.textContent = '';
      errorMessage.style.display = 'none';

      if (name.length < 3) {
        this._showError(errorMessage, 'Nama minimal 3 karakter');
        return;
      }

      if (!this._validateEmail(email)) {
        this._showError(errorMessage, 'Masukkan alamat email yang valid');
        return;
      }

      if (password.length < 8) {
        this._showError(errorMessage, 'Kata sandi minimal 8 karakter');
        return;
      }

      // Show loading
      registerButton.classList.add('loading');
      registerButton.disabled = true;

      try {
        await ApiService.register({ name, email, password });
        this._showSuccess(errorMessage, 'Akun berhasil dibuat! Mengalihkan ke halaman login...');
        
        setTimeout(() => {
          window.location.hash = '#/login';
        }, 1500);
      } catch (error) {
        this._showError(errorMessage, error.message);
        registerButton.classList.remove('loading');
        registerButton.disabled = false;
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
