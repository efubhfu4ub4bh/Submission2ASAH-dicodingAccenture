import HomePage from '../pages/home/home-page';
import LoginPage from '../pages/auth/login-page';
import RegisterPage from '../pages/auth/register-page';
import AddStoryPage from '../pages/product/add-story-page';
import BookmarksPage from '../pages/bookmarks/bookmarks-page';

const routes = {
  '/': new HomePage(),
  '/login': new LoginPage(),
  '/register': new RegisterPage(),
  '/add-story': new AddStoryPage(),
  '/bookmarks': new BookmarksPage(),
};

export default routes;
