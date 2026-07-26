import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EAF4FB',
          100: '#D6EAF8',
          200: '#AED6F1',
          300: '#85C1E9',
          500: '#2E86C1',
          700: '#1B4F72',
          900: '#154360',
        },
        brand: '#1B4F72',
        'industrial-blue': {
          DEFAULT: '#1B4F72',
          light: '#475569',
        },
        'safety-orange': {
          DEFAULT: '#F97316',
          dark: '#EA580C',
        },
        background: '#f0f4f8',
        surface: '#ffffff',
        outline: '#cbdceb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.8s ease-out forwards',
      }
    },
  },
  plugins: [],
}

export default config
