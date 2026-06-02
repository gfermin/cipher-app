import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'app': 'var(--bg-app)',
        'sidebar': 'var(--bg-sidebar)',
        'surface': 'var(--bg-surface)',
        'surface-2': 'var(--bg-surface-2)',
        'surface-3': 'var(--bg-surface-3)',
        'accent': 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        'accent-light': 'var(--accent-light)',
        'text-1': 'var(--text-1)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        'text-4': 'var(--text-4)',
        'border': 'var(--border)',
        'border-2': 'var(--border-2)',
        'online': 'var(--online)',
        'danger': 'var(--danger)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'xs': 'var(--r-xs)',
        'sm': 'var(--r-sm)',
        'md': 'var(--r-md)',
        'lg': 'var(--r-lg)',
        'xl': 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        '3xl': 'var(--r-3xl)',
      },
      spacing: {
        '1c': 'var(--sp-1)',
        '2c': 'var(--sp-2)',
        '3c': 'var(--sp-3)',
        '4c': 'var(--sp-4)',
        '5c': 'var(--sp-5)',
        '6c': 'var(--sp-6)',
        '8c': 'var(--sp-8)',
      },
      animation: {
        'fade-in': 'fadeIn 280ms ease forwards',
        'slide-up': 'slideUp 320ms cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 220ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        'message-in': 'messageIn 220ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        'shimmer': 'shimmer 1.6s ease-in-out infinite',
        'typing': 'typingDot 1.4s ease-in-out infinite',
        'vault-reveal': 'vaultReveal 0.8s ease forwards',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        messageIn: { from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shimmer: { '0%, 100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        typingDot: { '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' }, '30%': { transform: 'translateY(-4px)', opacity: '1' } },
        vaultReveal: {
          '0%': { opacity: '0', filter: 'blur(20px)', transform: 'scale(1.1)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'scale(1)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}

export default config
