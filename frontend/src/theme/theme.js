import { colors } from './colors';

const theme = {
  colors,
  shadows: {
    card: '0 2px 8px rgba(0, 0, 0, 0.08)',
    cardHover: '0 4px 16px rgba(0, 0, 0, 0.12)',
    sidebar: '2px 0 8px rgba(0, 0, 0, 0.05)',
    button: '0 2px 4px rgba(51, 78, 104, 0.3)',
    buttonHover: '0 4px 8px rgba(51, 78, 104, 0.4)',
  },
  spacing: {
    cardPaddingSm: '1rem',
    cardPaddingMd: '1.25rem',
    cardPaddingLg: '1.5rem',
    cardPaddingXl: '1.75rem',
    btnPaddingSm: '0.5rem 1rem',
    btnPaddingLg: '0.625rem 1.5rem',
  },
  fontSize: {
    btnSm: '0.8125rem',
    btnLg: '0.875rem',
  },
  borderRadius: {
    pill: '50px',
  },
  fonts: {
    heading: "'Poppins', sans-serif",
    body: "'Poppins', sans-serif",
  },
};

export default theme;
