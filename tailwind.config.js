/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bcfd',
          400: '#8098fb',
          500: '#6171f6',
          600: '#4f52eb',
          700: '#4240cf',
          800: '#3636a7',
          900: '#303184',
          950: '#1e1d50',
        },
        surface: {
          50:  '#f8f9fc',
          100: '#f0f1f8',
          200: '#e4e6f0',
          300: '#cdd0e0',
          400: '#9da3be',
          500: '#6b7194',
          600: '#4e5470',
          700: '#3d4260',
          800: '#2c3050',
          900: '#1a1d35',
          950: '#0f1022',
        },
        accent: {
          pink:   '#f472b6',
          purple: '#a78bfa',
          cyan:   '#22d3ee',
          green:  '#34d399',
          amber:  '#fbbf24',
          red:    '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6171f6 0%, #a78bfa 100%)',
        'gradient-surface': 'linear-gradient(180deg, #1a1d35 0%, #0f1022 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(97,113,246,0.1) 0%, rgba(167,139,250,0.1) 100%)',
        'gradient-glow': 'radial-gradient(ellipse at center, rgba(97,113,246,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-brand': '0 0 20px rgba(97,113,246,0.4)',
        'glow-sm': '0 0 10px rgba(97,113,246,0.25)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.5)',
        'panel': '2px 0 20px rgba(0,0,0,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 10px rgba(97,113,246,0.3)' }, '50%': { boxShadow: '0 0 25px rgba(97,113,246,0.6)' } },
        bounceSubtle: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      backdropBlur: {
        'xs': '4px',
      },
    },
  },
  plugins: [],
}
