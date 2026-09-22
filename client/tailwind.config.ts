/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Be Vietnam Pro"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        apple: {
          blue: '#0066cc',
          focus: '#0071e3',
          sky: '#2997ff',
          ink: '#1d1d1f',
          parchment: '#f5f5f7',
          pearl: '#fafafc',
          hairline: '#e0e0e0',
          tile1: '#272729',
          tile2: '#2a2a2c',
          tile3: '#252527',
          muted: '#76767b',
          mutedDark: '#a1a1a6',
          emerald: '#34c759',
          amber: '#ff9500',
          rose: '#ff3b30',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.78)',
          dark: 'rgba(29, 29, 31, 0.78)',
          borderLight: 'rgba(0, 0, 0, 0.08)',
          borderDark: 'rgba(255, 255, 255, 0.12)',
        }
      },
      borderRadius: {
        'apple-pill': '9999px',
        'apple-lg': '18px',
        'apple-md': '12px',
        'apple-sm': '8px',
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '9.5': '2.375rem',
      },
      fontSize: {
        'apple-body': ['15px', { lineHeight: '1.47', letterSpacing: '-0.24px' }],
        'apple-display': ['34px', { lineHeight: '1.15', letterSpacing: '-0.3px' }],
        'apple-hero': ['48px', { lineHeight: '1.08', letterSpacing: '-0.3px' }],
      },
      boxShadow: {
        'apple-product': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'glass': '0 4px 20px rgba(0, 0, 0, 0.04)',
        'glass-hover': '0 12px 28px -6px rgba(0, 0, 0, 0.08)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.45)',
        'glass-dark-hover': '0 16px 36px -6px rgba(0, 0, 0, 0.65)',
        'ios-liquid': '0 4px 20px rgba(0, 0, 0, 0.04)',
        'ios-liquid-hover': '0 12px 28px -6px rgba(0, 0, 0, 0.08)',
      },
      transitionTimingFunction: {
        'apple-spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'apple-fluid': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'apple-bounce': 'cubic-bezier(0.34, 1.45, 0.64, 1)',
        'ios-fluid': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'ios-bounce': 'cubic-bezier(0.34, 1.45, 0.64, 1)',
        'ios-smooth': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      animation: {
        'liquid-float': 'liquidFloat 10s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ios-enter': 'iosEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'ios-caustic': 'iosCaustic 3s cubic-bezier(0.16, 1, 0.3, 1) infinite',
      },
      keyframes: {
        liquidFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
          '100%': { opacity: '0.4' },
        },
        iosEnter: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        iosCaustic: {
          '0%': { transform: 'translateX(-160%) skewX(-22deg)' },
          '100%': { transform: 'translateX(260%) skewX(-22deg)' },
        },
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
}