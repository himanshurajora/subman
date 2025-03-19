import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-800 shadow-inner">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {currentYear} <span className="font-bold">SubMan</span>. {t('app.tagline')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
} 