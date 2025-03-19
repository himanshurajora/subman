import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  children,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Base classes for all buttons
  const baseClasses = 'inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Variant-specific classes
  const variantClasses = {
    primary: 'border-transparent shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'border-indigo-600 text-indigo-600 bg-white hover:bg-indigo-50 focus:ring-indigo-500',
    tertiary: 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500 dark:border-gray-600 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
    danger: 'border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
  };
  
  const widthClasses = fullWidth ? 'w-full' : '';
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${widthClasses} ${className}`;

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
} 