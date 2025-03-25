import { useTranslation } from 'react-i18next';

// Get the version from the global variable defined in vite.config.ts
const appVersion = __APP_VERSION__;

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-800 shadow-inner relative">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {currentYear} <span className="font-bold">SubMan</span>. {t('app.tagline')}
            </p>
          </div>
        </div>
      </div>
      
      {/* Version number with absolute positioning at bottom left */}
      <div className="absolute bottom-1 right-2 pointer-events-none select-none">
        <p className="text-[10px] text-gray-300 dark:text-gray-600 opacity-70 font-mono">
          v{appVersion}
        </p>
      </div>
    </footer>
  );
} 