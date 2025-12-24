const variants = {
  success: 'bg-success-light text-green-800 border border-green-200',
  warning: 'bg-warning-light text-amber-800 border border-amber-200',
  danger: 'bg-danger-light text-red-800 border border-red-200',
  info: 'bg-info-light text-blue-800 border border-blue-200',
  default: 'bg-gray-100 text-gray-700 border border-gray-200',
  primary: 'bg-primary-100 text-primary-700 border border-primary-200',
  secondary: 'bg-secondary-100 text-secondary-700 border border-secondary-200',
  accent: 'bg-accent-100 text-accent-700 border border-accent-200',
  // Solid variants
  'success-solid': 'bg-success text-white',
  'warning-solid': 'bg-warning text-gray-900',
  'danger-solid': 'bg-danger text-white',
  'info-solid': 'bg-info text-white',
  'primary-solid': 'bg-primary text-white',
  'secondary-solid': 'bg-secondary text-gray-900',
  'accent-solid': 'bg-accent text-gray-900',
};

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

const dotColors = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  default: 'bg-gray-500',
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
};

const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  icon: Icon,
  className = ''
}) => {
  const baseVariant = variant.replace('-solid', '');

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {dot && (
        <span className="relative mr-1.5">
          <span className={`
            w-2 h-2 rounded-full block
            ${dotColors[baseVariant] || dotColors.default}
          `} />
          {pulse && (
            <span className={`
              absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75
              ${dotColors[baseVariant] || dotColors.default}
            `} />
          )}
        </span>
      )}
      {Icon && <Icon className="w-3 h-3 mr-1" />}
      {children}
    </span>
  );
};

export default Badge;
