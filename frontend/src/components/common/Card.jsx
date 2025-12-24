const Card = ({
  children,
  className = '',
  padding = 'md',
  hover = true,
  variant = 'default',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const variantStyles = {
    default: 'bg-white border border-gray-100',
    primary: 'bg-primary-50 border border-primary-100',
    secondary: 'bg-secondary-50 border border-secondary-100',
    accent: 'bg-accent-50 border border-accent-100',
    gradient: 'bg-gradient-to-br from-white to-gray-50 border border-gray-100',
  };

  return (
    <div
      className={`
        rounded-2xl shadow-card
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${hover ? 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', border = true }) => (
  <div className={`${border ? 'border-b border-gray-100 pb-4 mb-4' : 'mb-4'} ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', as: Component = 'h3' }) => (
  <Component className={`text-lg font-bold text-gray-900 font-heading ${className}`}>
    {children}
  </Component>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-500 mt-1 ${className}`}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', border = true }) => (
  <div className={`${border ? 'border-t border-gray-100 pt-4 mt-4' : 'mt-4'} ${className}`}>
    {children}
  </div>
);

export default Card;
