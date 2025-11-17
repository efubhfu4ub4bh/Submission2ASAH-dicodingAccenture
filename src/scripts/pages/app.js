import routes from '../routes/routes';
import { getActiveRoute } from '../routes/url-parser';

class App {
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;

  constructor({ navigationDrawer, drawerButton, content }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;

    this.#setupDrawer();
  }

  #setupDrawer() {
    this.#drawerButton.addEventListener('click', () => {
      const isOpen = this.#navigationDrawer.classList.toggle('open');
      this.#drawerButton.setAttribute('aria-expanded', isOpen);
    });

    document.body.addEventListener('click', (event) => {
      if (
        !this.#navigationDrawer.contains(event.target) &&
        !this.#drawerButton.contains(event.target)
      ) {
        this.#navigationDrawer.classList.remove('open');
        this.#drawerButton.setAttribute('aria-expanded', 'false');
      }

      this.#navigationDrawer.querySelectorAll('a').forEach((link) => {
        if (link.contains(event.target)) {
          this.#navigationDrawer.classList.remove('open');
          this.#drawerButton.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  async renderPage() {
    const url = getActiveRoute();
    const page = routes[url];

    // Use View Transition API if supported
    if (document.startViewTransition) {
      document.startViewTransition(async () => {
        // Render new content
        this.#content.innerHTML = await page.render();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Execute page-specific logic
        await page.afterRender();
      });
    } else {
      // Fallback for browsers that don't support View Transition API
      // Add fade-out transition
      this.#content.classList.add('fade-out');

      // Wait for fade-out animation
      await new Promise(resolve => setTimeout(resolve, 300));

      // Render new content
      this.#content.innerHTML = await page.render();
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Add fade-in transition
      this.#content.classList.remove('fade-out');
      this.#content.classList.add('fade-in');

      // Execute page-specific logic
      await page.afterRender();

      // Remove fade-in class after animation
      setTimeout(() => {
        this.#content.classList.remove('fade-in');
      }, 300);
    }
  }
}

export default App;
