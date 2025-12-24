/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#478ac9',
          light: '#77aad9',
          dark: '#387cbd',
          50: '#f0f7fc',
          100: '#e0eef8',
          200: '#b8d9f0',
          300: '#8fc3e7',
          400: '#5fa8d8',
          500: '#478ac9',
          600: '#387cbd',
          700: '#2d6399',
          800: '#264f7a',
          900: '#1f3f61',
        },
        secondary: {
          DEFAULT: '#3be8e0',
          light: '#6aeee8',
          dark: '#2bc9c2',
          50: '#edfffe',
          100: '#d0fffe',
          200: '#a7fffe',
          300: '#6bf5f2',
          400: '#3be8e0',
          500: '#1fccc5',
          600: '#15a3a0',
          700: '#168281',
          800: '#186768',
          900: '#185656',
        },
        accent: {
          DEFAULT: '#f1c50e',
          light: '#f5d54a',
          dark: '#d4ac00',
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#f9d00f',
          500: '#f1c50e',
          600: '#ca9a06',
          700: '#a17109',
          800: '#855a10',
          900: '#714a14',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontFamily: {
        heading: ['Roboto', 'sans-serif'],
        body: ['Open Sans', 'sans-serif'],
        condensed: ['Roboto Condensed', 'sans-serif'],
      },
      borderRadius: {
        'pill': '50px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'sidebar': '2px 0 8px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
