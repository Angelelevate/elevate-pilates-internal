import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
        'soft-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'in-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(14px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'backdrop-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(18px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'spinner-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'in-up': 'in-up 0.42s soft both',
        'page-enter': 'page-enter 0.48s soft both',
        'toast-in': 'toast-in 0.4s soft both',
        'backdrop-in': 'backdrop-in 0.28s ease-out both',
        'modal-in': 'modal-in 0.42s soft both',
        'spinner-soft': 'spinner-soft 1.2s ease-in-out infinite',
        shimmer: 'shimmer 2.5s ease-in-out infinite',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#1c1917',
        mist: '#faf8f5',
        clay: {
          DEFAULT: '#c4a484',
          50: '#fdf8f3',
          100: '#f5ead9',
          200: '#e8d4b4',
          300: '#d4b895',
          400: '#c4a484',
          500: '#b08d6a',
          600: '#9a7555',
          700: '#7d5d43',
          800: '#5f4633',
          900: '#3f2e21',
        },
        sage: {
          DEFAULT: '#6b7f6a',
          50: '#f3f6f3',
          100: '#dfe6de',
          200: '#c2d0c1',
          300: '#9db49c',
          400: '#7e9a7d',
          500: '#6b7f6a',
          600: '#566755',
          700: '#445043',
          800: '#343d33',
          900: '#232922',
        },
        deep: {
          DEFAULT: '#2d3a2c',
          50: '#f0f3f0',
          100: '#d6ddd6',
          200: '#a8b5a7',
          300: '#7a8f79',
          400: '#536e52',
          500: '#3d5340',
          600: '#2d3a2c',
          700: '#222c21',
          800: '#171e17',
          900: '#0d110d',
        },
      },
      boxShadow: {
        'warm-sm': '0 1px 3px 0 rgba(196, 164, 132, 0.12), 0 1px 2px -1px rgba(196, 164, 132, 0.08)',
        warm: '0 4px 12px -2px rgba(196, 164, 132, 0.16), 0 2px 4px -2px rgba(196, 164, 132, 0.10)',
        'warm-md': '0 8px 24px -4px rgba(196, 164, 132, 0.18), 0 4px 8px -4px rgba(196, 164, 132, 0.10)',
        'warm-lg': '0 16px 40px -8px rgba(196, 164, 132, 0.20), 0 8px 16px -8px rgba(196, 164, 132, 0.12)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 0 rgba(0, 0, 0, 0.03)',
        'card-elevated': '0 4px 12px -2px rgba(45, 58, 44, 0.08), 0 2px 4px -2px rgba(196, 164, 132, 0.06)',
        'card-hover': '0 12px 28px -6px rgba(45, 58, 44, 0.12), 0 4px 8px -4px rgba(196, 164, 132, 0.10)',
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [typography],
}
