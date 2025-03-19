import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const { language, changeLanguage } = useLanguage();

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error('Failed to logout', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
      {/* Backdrop - clicking this closes the menu */}
      <div 
        className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sidebar panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex">
        <div className="relative w-screen max-w-md">
          <div className="h-full flex flex-col py-6 bg-white dark:bg-gray-800 shadow-xl overflow-y-auto">
            {/* Close button */}
            <div className="px-4 sm:px-6 flex justify-end">
              <button
                type="button"
                className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onClick={onClose}
              >
                <span className="sr-only">Close panel</span>
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Menu content */}
            <div className="mt-6 px-4 sm:px-6 flex-1">
              <div className="flex flex-col space-y-6">
                {/* App name/logo */}
                <div className="flex-shrink-0 flex items-center px-4">
                  <Link 
                    to="/" 
                    className="text-xl font-bold text-gray-900 dark:text-white"
                    onClick={onClose}
                  >
                    {t('app.name')}
                  </Link>
                </div>
                
                {/* Navigation */}
                <nav className="flex-1">
                  <div className="space-y-1 px-2">
                    {currentUser && (
                      <>
                        <Link
                          to="/dashboard"
                          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                          onClick={onClose}
                        >
                          {t('navigation.dashboard')}
                        </Link>
                        <Link
                          to="/subscriptions"
                          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                          onClick={onClose}
                        >
                          {t('navigation.subscriptions')}
                        </Link>
                        <Link
                          to="/profile"
                          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium"
                          onClick={onClose}
                        >
                          {t('navigation.profile')}
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                        >
                          {t('navigation.logout')}
                        </button>
                      </>
                    )}
                    {!currentUser && (
                      <Link
                        to="/login"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white block px-3 py-2 rounded-md text-base font-medium text-center"
                        onClick={onClose}
                      >
                        {t('navigation.login')}
                      </Link>
                    )}
                  </div>
                </nav>
                
                {/* Theme and language toggles */}
                <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 mr-2">
                        {language === 'en' ? 'English' : 'हिंदी'}
                      </span>
                      <button
                        onClick={() => changeLanguage(language === 'en' ? 'hi' : 'en')}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {language === 'en' ? 'हिंदी' : 'EN'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 