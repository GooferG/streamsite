/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'emerald-signal': '#10b981',
        'emerald-bright': '#34d399',
        'emerald-pale': '#a7f3d0',
        'emerald-haze': '#064e3b',
        'purple-gamba': '#a855f7',
        'purple-bright': '#c084fc',
        'purple-haze': '#581c87',
        'orange-admin': '#f97316',
        'orange-bright': '#fb923c',
        'amber-rust': '#e0a458',
        'amber-rust-dim': '#a8763d',
        'rainbet-blue': '#2c7cf6',
        'rainbet-blue-bright': '#60a5fa',
        'red-destructive': '#ef4444',
        'zinc-broadcast': '#09090b',
        'zinc-card': '#18181b',
        'zinc-elevated': '#27272a',
        'white-body': '#fafafa',
        'white-muted': '#a1a1aa',
        // Broadcast hifi (phosphor CRT)
        phosphor: '#1ff39a',
        'phosphor-dim': '#0e7d54',
        'crt-amber': '#ffb24d',
        'crt-cyan': '#46e6ff',
        // Casino hifi (gold)
        'gold-lite': '#f8e7b0',
        gold: '#e7c267',
        'gold-deep': '#a9812f',
        'gold-edge': '#6f5520',
        cream: '#f4ecd8',
        // Minimal hifi (cool-blue accent)
        'mn-acc': '#8fb3ff',
        'mn-acc-deep': '#5b80d8',
        // Neon hifi (synthwave)
        'nn-pink': '#ff2d95',
        'nn-pink-lite': '#ff7ac4',
        'nn-cyan': '#21e6ff',
        'nn-cyan-lite': '#8af6ff',
        'nn-violet': '#7a3dff',
        'nn-purple': '#b14dff',
        'nn-orange': '#ff8a3d',
      },
      fontFamily: {
        mono: ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Anton', 'Impact', 'Haettenschweiler', 'sans-serif'],
        'serif-luxe': ['"Cormorant Garamond"', 'Georgia', 'serif'],
        grotesk: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      letterSpacing: {
        'eyebrow-xs': '0.15em',
        'eyebrow-sm': '0.18em',
        'eyebrow': '0.22em',
        'eyebrow-md': '0.28em',
        'eyebrow-lg': '0.32em',
      },
      keyframes: {
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -10%)' },
          '20%': { transform: 'translate(-15%, 5%)' },
          '30%': { transform: 'translate(7%, -25%)' },
          '40%': { transform: 'translate(-5%, 25%)' },
          '50%': { transform: 'translate(-15%, 10%)' },
          '60%': { transform: 'translate(15%, 0%)' },
          '70%': { transform: 'translate(0%, 15%)' },
          '80%': { transform: 'translate(3%, 35%)' },
          '90%': { transform: 'translate(-10%, 10%)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.5', filter: 'blur(20px)' },
          '50%': { opacity: '0.8', filter: 'blur(30px)' },
        },
        'slow-zoom': {
          '0%': { transform: 'scale(1) translate(0, 0)' },
          '50%': { transform: 'scale(1.08) translate(-1%, -1%)' },
          '100%': { transform: 'scale(1) translate(0, 0)' },
        },
        'neon-pulse': {
          '0%, 100%': {
            textShadow:
              '0 0 6px rgba(192,132,252,0.8), 0 0 18px rgba(168,85,247,0.6)',
          },
          '50%': {
            textShadow:
              '0 0 10px rgba(192,132,252,1), 0 0 30px rgba(168,85,247,0.9)',
          },
        },
        'bc-sweep': {
          '0%': { transform: 'translateY(-160px)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'bc-flicker': {
          '0%, 96%, 100%': { opacity: '1' },
          '97%': { opacity: '0.86' },
          '98%': { opacity: '1' },
          '99%': { opacity: '0.92' },
        },
        'cs-foil': {
          '0%': { backgroundPosition: '0% 0' },
          '100%': { backgroundPosition: '250% 0' },
        },
        'nn-grid': {
          '0%': { backgroundPosition: '0 0, 0 0' },
          '100%': { backgroundPosition: '0 46px, 0 46px' },
        },
        'nn-flicker': {
          '0%, 93%, 100%': { opacity: '1' },
          '94%': { opacity: '0.7' },
          '95%': { opacity: '1' },
          '97%': { opacity: '0.85' },
        },
      },
      animation: {
        'slow-zoom': 'slow-zoom 18s ease-in-out infinite',
        'neon-pulse': 'neon-pulse 2.4s ease-in-out infinite',
        'bc-sweep': 'bc-sweep 7s linear infinite',
        'bc-flicker': 'bc-flicker 5.5s steps(60) infinite',
        'cs-foil': 'cs-foil 6s linear infinite',
        'nn-grid': 'nn-grid 1.6s linear infinite',
        'nn-flicker': 'nn-flicker 6s steps(50) infinite',
      },
    },
  },
  plugins: [],
}
