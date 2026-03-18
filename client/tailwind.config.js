/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#a855f7', // Purple
          DEFAULT: '#8b5cf6',
          dark: '#7c3aed',
        },
        secondary: {
          light: '#22d3ee', // Cyan
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
        },
        accent: {
          pink: '#ec4899',
          orange: '#f97316',
        }
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        'glass': 'rgba(255, 255, 255, 0.1)',
      },
      boxShadow: {
        'glass-card': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
      backdropBlur: {
        'glass': '10px',
      }
    },
  },
  plugins: [],
}
