import { forwardRef } from 'react';

const variants = {
  primary: 'bg-primary text-white enabled:hover:bg-primary-dark focus:ring-primary shadow-button enabled:hover:shadow-button-hover',
  secondary: 'bg-secondary text-gray-900 enabled:hover:bg-secondary-dark focus:ring-secondary',
  accent: 'bg-accent text-gray-900 enabled:hover:bg-accent-dark focus:ring-accent',
  outline: 'border-2 border-primary text-primary enabled:hover:bg-primary enabled:hover:text-white focus:ring-primary bg-transparent',
  'outline-secondary': 'border-2 border-secondary text-secondary-700 enabled:hover:bg-secondary enabled:hover:text-gray-900 focus:ring-secondary bg-transparent',
  'outline-accent': 'border-2 border-accent text-accent-700 enabled:hover:bg-accent enabled:hover:text-gray-900 focus:ring-accent bg-transparent',
  ghost: 'text-gray-600 enabled:hover:bg-gray-100 enabled:hover:text-gray-900 focus:ring-gray-300 bg-transparent',
  'ghost-primary': 'text-primary enabled:hover:bg-primary-50 focus:ring-primary bg-transparent',
  danger: 'bg-danger text-white enabled:hover:bg-red-600 focus:ring-danger',
  success: 'bg-success text-white enabled:hover:bg-green-600 focus:ring-success',
  warning: 'bg-warning text-gray-900 enabled:hover:bg-amber-600 focus:ring-warning',
  info: 'bg-info text-white enabled:hover:bg-blue-600 focus:ring-info',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
  xl: 'px-10 py-4 text-lg',
};

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  rounded = 'pill',
  ...props
}, ref) => {
  const roundedStyles = {
    pill: 'rounded-pill',
    lg: 'rounded-xl',
    md: 'rounded-lg',
    sm: 'rounded-md',
    none: 'rounded-none',
  };

  const baseStyles = `
    inline-flex items-center justify-center font-semibold uppercase tracking-wide
    transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
    active:scale-[0.98]
  `;

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${roundedStyles[rounded]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        <span className="flex items-center">
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 mr-2 flex-shrink-0" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 ml-2 flex-shrink-0" />}
        </span>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
