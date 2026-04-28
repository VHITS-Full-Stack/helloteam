import { useState } from 'react';

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const isValidSrc = (src) => src && src !== 'undefined' && src !== 'null';

const Avatar = ({
  src,
  alt = '',
  name = '',
  size = 'md',
  className = '',
  status,
}) => {
  const [imgError, setImgError] = useState(false);

  const getInitials = (name) => {
    if (!name || name.toLowerCase().includes('undefined') || name.toLowerCase().includes('null')) return '?';
    const names = name.trim().split(' ').filter(Boolean);
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0] ? names[0].slice(0, 2).toUpperCase() : '?';
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500',
  };

  const showImage = isValidSrc(src) && !imgError;

  return (
    <div className="relative inline-block">
      {showImage ? (
        <img
          src={src}
          alt={alt || name}
          className={`${sizes[size]} rounded-full object-cover ${className}`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-primary-100 text-primary flex items-center justify-center font-semibold ${className}`}
        >
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColors[status]}`}
        />
      )}
    </div>
  );
};

export default Avatar;
