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
        'gold-scatter': '#fbbf24',
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
        // On Air: the site's design language. Semantic roles, see DESIGN.md §7.
        onair: {
          signal: { DEFAULT: '#3ee0bf', light: '#7af0d6', deep: '#1fc9a8' },
          winner: {
            DEFAULT: '#ff6a1a',
            hot: '#ff8a3d',
            warm: '#ff9a5c',
            light: '#ffb27a',
            pale: '#ffd2b0',
            deep: '#e0520c',
            ink: '#1a0a02',
          },
          viewer: {
            DEFAULT: '#9146ff',
            bright: '#a26bff',
            deep: '#8240f0',
            light: '#b89cff',
            ink: '#d6cce4',
            muted: '#b7aec4',
          },
          live: '#d83a1c',
          loss: '#ff6b6b',
          surface: { 1: '#17151b', 2: '#141216', 3: '#121015', 4: '#0f0e12', raised: '#3a3540' },
          bezel: { top: '#26232c', bottom: '#141217' },
          ink: {
            1: '#ece8e1',
            2: '#e4e0e8',
            3: '#c9c4cf',
            4: '#a7a2ad',
            5: '#8a8690',
            6: '#6d6873',
            7: '#4a4550',
          },
          screen: { ink: '#c9a993', dim: '#9a8b82' },
          ticket: { top: '#2a1d3d', mid: '#231933', bottom: '#17121f' },
          // Goofer Video's label stock and the ink printed on it (DESIGN.md §7, Video store).
          paper: { DEFAULT: '#ece3cf', ink: '#231c17' },
        },
      },
      fontFamily: {
        mono: ['source-code-pro', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Anton', 'Impact', 'Haettenschweiler', 'sans-serif'],
        'serif-luxe': ['"Cormorant Garamond"', 'Georgia', 'serif'],
        grotesk: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        onair: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'onair-mono': ['"JetBrains Mono"', 'source-code-pro', 'Menlo', 'Consolas', 'monospace'],
        // Goofer Video's handwritten labels and index cards only (DESIGN.md §7).
        'onair-marker': ['"Permanent Marker"', '"Bricolage Grotesque"', 'cursive'],
      },
      letterSpacing: {
        'eyebrow-xs': '0.15em',
        'eyebrow-sm': '0.18em',
        'eyebrow': '0.22em',
        'eyebrow-md': '0.28em',
        'eyebrow-lg': '0.32em',
      },
      backgroundImage: {
        // The guess meter's dotted track.
        'onair-track': 'repeating-linear-gradient(90deg, rgba(255,255,255,.18) 0 2px, transparent 2px 12px)',
        // Scanlines over store item art (the Monitor screen's lines as a token).
        'onair-scanlines': 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px)',
      },
      borderRadius: {
        'onair-bezel': '36px',
        'onair-screen': '26px',
        'onair-card': '24px',
        'onair-row': '18px',
        'onair-inner': '16px',
        'onair-control': '14px',
        'onair-tile': '10px',
        // Goofer Video: the VHS box, and its labels, stickers and photo windows.
        'onair-case': '6px',
        'onair-label': '3px',
      },
      boxShadow: {
        'onair-bezel':
          'inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6), 0 30px 60px rgba(0,0,0,.6)',
        // The nav bar: the bezel's inset highlight and lip, no drop shadow.
        'onair-bar': 'inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6)',
        'onair-screen': 'inset 0 0 80px rgba(0,0,0,.85), inset 0 0 0 1px rgba(255,255,255,.04)',
        'onair-card': 'inset 0 1px 0 rgba(255,255,255,.06), 0 14px 30px rgba(0,0,0,.4)',
        'onair-row': 'inset 0 1px 0 rgba(255,255,255,.05)',
        'onair-well': 'inset 0 2px 6px rgba(0,0,0,.5)',
        'onair-raised': 'inset 0 1px 0 rgba(255,255,255,.25)',
        'onair-lit-signal': 'inset 0 1px 0 rgba(120,255,220,.12)',
        'onair-lit-winner': 'inset 0 1px 0 rgba(255,180,130,.2), 0 12px 30px -12px rgba(255,106,26,.45)',
        'onair-lit-viewer': 'inset 0 1px 0 rgba(200,170,255,.2), 0 12px 30px -12px rgba(145,70,255,.45)',
        'onair-live': '0 0 24px rgba(216,58,28,.6)',
        'onair-led': '0 0 10px #ff4a2a',
        'onair-ticket': '0 24px 40px -14px rgba(145,70,255,.4)',
        'onair-ticket-top': 'inset 0 1px 0 rgba(200,170,255,.18)',
        'onair-winner-ring': '0 0 0 5px #1a100c, 0 0 0 7px #ff6a1a, 0 0 60px rgba(255,106,26,.55)',
        'onair-winner-chip': '0 8px 20px rgba(255,106,26,.4)',
        'onair-dot': '0 0 0 3px #0f0b0d',
        'onair-dot-winner': '0 0 0 3px #0f0b0d, 0 0 16px #ff6a1a',
        'onair-dot-viewer': '0 0 0 3px #0f0b0d, 0 0 16px #9146ff',
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
        'modal-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // TV intro (TVStaticIntro). crt-static jumps the noise tile (second
        // background layer) around so one tile reads as live static.
        'crt-static': {
          '0%, 100%': { backgroundPosition: '0 0, 0 0' },
          '12.5%': { backgroundPosition: '0 0, -37px 61px' },
          '25%': { backgroundPosition: '0 0, 83px -29px' },
          '37.5%': { backgroundPosition: '0 0, -52px -91px' },
          '50%': { backgroundPosition: '0 0, 11px 47px' },
          '62.5%': { backgroundPosition: '0 0, 97px 13px' },
          '75%': { backgroundPosition: '0 0, -71px 38px' },
          '87.5%': { backgroundPosition: '0 0, 29px -64px' },
        },
        'crt-led': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'crt-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'crt-roll': {
          '0%': { transform: 'translateY(-20vh)' },
          '100%': { transform: 'translateY(110vh)' },
        },
        // Vertical hold settling as the page resolves under the static.
        'signal-lock': {
          '0%': { transform: 'translateY(-14px)' },
          '30%': { transform: 'translateY(6px)' },
          '55%': { transform: 'translateY(-2px)' },
          '100%': { transform: 'translateY(0)' },
        },
        // On Air monitor: channel-change static, rolling band, chyron, LIVE light.
        'onair-static': {
          '0%': { backgroundPosition: '0 0, 0 0' },
          '25%': { backgroundPosition: '-37px 21px, 13px -9px' },
          '50%': { backgroundPosition: '19px -43px, -27px 31px' },
          '75%': { backgroundPosition: '-11px 7px, 41px 17px' },
          '100%': { backgroundPosition: '29px 39px, -7px -23px' },
        },
        'onair-roll': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'onair-ticker': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'onair-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        // The wallet's stub tearing off after an order.
        'onair-tear': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(72px) rotate(-7deg)', opacity: '0' },
        },
        // The couch laptop's screensaver: the GG bug drifting corner to corner.
        // Transform only: each layer fills the screensaver, so 100% is its
        // width (or height), less the bug's box in LaptopScreen (24cqw x 10cqw).
        'onair-bounce-x': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(calc(100% - 24cqw))' } },
        'onair-bounce-y': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(calc(100% - 10cqw))' } },
        // Couch toys (spec: Toys). Transform and opacity only.
        'couch-wiggle': {
          '0%,100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-4deg)' },
          '40%': { transform: 'rotate(4deg)' },
          '60%': { transform: 'rotate(-3deg)' },
          '80%': { transform: 'rotate(2deg)' },
        },
        'couch-drop': { '0%,100%': { transform: 'translateY(0)' }, '40%,60%': { transform: 'translateY(160%)' } },
        // The controller's rumble lines flash in time with its wiggle.
        'couch-rumble': {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '12%': { opacity: '1', transform: 'scale(1)' },
          '28%': { opacity: '0.25', transform: 'scale(0.92)' },
          '44%': { opacity: '1', transform: 'scale(1.06)' },
          '60%': { opacity: '0.25', transform: 'scale(0.95)' },
          '76%': { opacity: '1', transform: 'scale(1.04)' },
          '100%': { opacity: '0', transform: 'scale(1.12)' },
        },
        // The can (fizz): a shake from its base, then a foam head swells over the
        // rim while blobs geyser out and droplets fly off. Each bit rides a wrapper
        // the size of the can's box, so its CSS variables (set per bit in
        // ToyEffects.js) are percentages of the can.
        'couch-shake': {
          '0%,100%': { transform: 'translateX(0) rotate(0deg)' },
          '20%': { transform: 'translateX(-7%) rotate(-4deg)' },
          '45%': { transform: 'translateX(6%) rotate(4deg)' },
          '70%': { transform: 'translateX(-4%) rotate(-2deg)' },
          '88%': { transform: 'translateX(2%) rotate(1deg)' },
        },
        'couch-foam-cap': {
          '0%': { transform: 'scale(0.2)', opacity: '0' },
          '15%': { transform: 'scale(1.12)', opacity: '1' },
          '25%': { transform: 'scale(0.96)' },
          '33%,85%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.05)', opacity: '0' },
        },
        // A blob rises fast to its peak (--fx, --fy), hangs, then drifts down and fades.
        'couch-foam': {
          '0%': { transform: 'translate(0, 0) scale(0.3)', opacity: '0', animationTimingFunction: 'cubic-bezier(0.15, 0.7, 0.35, 1)' },
          '12%': { opacity: '1' },
          '45%': { transform: 'translate(var(--fx), var(--fy)) scale(1)', animationTimingFunction: 'cubic-bezier(0.45, 0, 0.75, 0.6)' },
          '75%': { opacity: '1' },
          '100%': { transform: 'translate(calc(var(--fx) * 1.3), calc(var(--fy) * 0.6)) scale(1.15)', opacity: '0' },
        },
        // A droplet's arc: steady sideways (--dx) on the outer wrapper, up to --up
        // and down to --dy on the inner one.
        'couch-fling-x': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(var(--dx))' } },
        'couch-fling-y': {
          '0%': { transform: 'translateY(0) scale(0.6)', opacity: '0', animationTimingFunction: 'cubic-bezier(0.25, 0.7, 0.5, 1)' },
          '8%': { opacity: '1' },
          '40%': { transform: 'translateY(var(--up)) scale(1)', animationTimingFunction: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(var(--dy)) scale(1)', opacity: '0' },
        },
        // The candy bowl (scatter): a candy hops out to --dx and lands at --dy with a
        // tiny bounce, rests, then hops back into the bowl over --back, tumbling by --spin.
        'couch-hop-x': {
          '0%': { transform: 'translateX(0)' },
          '30%,68%': { transform: 'translateX(var(--dx))' },
          '100%': { transform: 'translateX(0)' },
        },
        'couch-hop-y': {
          '0%': { transform: 'translateY(0) rotate(0deg) scale(0.6)', opacity: '0', animationTimingFunction: 'cubic-bezier(0.25, 0.7, 0.5, 1)' },
          '4%': { opacity: '1' },
          '15%': { transform: 'translateY(var(--up)) rotate(calc(var(--spin) * 0.5)) scale(1)', animationTimingFunction: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
          '30%': { transform: 'translateY(var(--dy)) rotate(var(--spin)) scale(1)', animationTimingFunction: 'cubic-bezier(0.25, 0.7, 0.5, 1)' },
          '35%': { transform: 'translateY(calc(var(--dy) - 6%)) rotate(var(--spin)) scale(1)', animationTimingFunction: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
          '40%,68%': { transform: 'translateY(var(--dy)) rotate(var(--spin)) scale(1)', animationTimingFunction: 'cubic-bezier(0.25, 0.7, 0.5, 1)' },
          '84%': { transform: 'translateY(var(--back)) rotate(calc(var(--spin) * 0.4)) scale(1)', animationTimingFunction: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
          '92%': { opacity: '1' },
          '100%': { transform: 'translateY(0) rotate(0deg) scale(0.6)', opacity: '0' },
        },
        'couch-flicker': { '0%,100%': { opacity: '1' }, '20%': { opacity: '0.82' }, '45%': { opacity: '1' }, '70%': { opacity: '0.88' } },
        // The neon sign: the lit art stutters on, hums unevenly, flicks off. Opacity only.
        'couch-neon-on': {
          '0%': { opacity: '0' },
          '12%': { opacity: '0.9' },
          '24%': { opacity: '0.1' },
          '40%': { opacity: '1' },
          '56%': { opacity: '0.4' },
          '72%,100%': { opacity: '1' },
        },
        'couch-neon-hum': {
          '0%,100%': { opacity: '1' },
          '20%': { opacity: '0.93' },
          '34%': { opacity: '0.87' },
          '36%': { opacity: '0.5' },
          '38%': { opacity: '0.95' },
          '62%': { opacity: '0.9' },
          '80%': { opacity: '0.98' },
          '83%': { opacity: '0.7' },
          '86%': { opacity: '1' },
        },
        'couch-neon-off': {
          '0%': { opacity: '1' },
          '12%': { opacity: '0.2' },
          '26%': { opacity: '0.85' },
          '40%,100%': { opacity: '0' },
        },
        // The couch window (spec: The window).
        'couch-twinkle': { '0%,100%': { opacity: '0.85' }, '50%': { opacity: '0.35' } },
        'couch-blink': { '0%,100%': { transform: 'scaleY(1)' }, '45%,55%': { transform: 'scaleY(0.12)' } },
        'couch-shoot': {
          from: { transform: 'translate(0, 0)', opacity: '0' },
          '15%': { opacity: '1' },
          to: { transform: 'translate(320%, 160%)', opacity: '0' },
        },
        'couch-cross': { '0%': { transform: 'translateX(-35%)' }, '60%,100%': { transform: 'translateX(110%)' } },
        // The couch laptop's next window popping up on its desktop (LaptopScreen.js).
        'couch-laptop-in': { from: { opacity: '0', transform: 'translateY(6%) scale(0.94)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        // The couch TV's commercials (TvCommercial.js). Opacity and transform
        // only; each beat sets its own delay (and a push its length) inline.
        'tv-ad-cut': { from: { opacity: '0' }, to: { opacity: '1' } },
        'tv-ad-hold': { '0%,100%': { opacity: '1' } },
        'tv-ad-in': { from: { opacity: '0', transform: 'translateY(35%)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'tv-ad-pop': {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'tv-ad-push': { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.1)' } },
        'tv-ad-crawl': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
      },
      animation: {
        'slow-zoom': 'slow-zoom 18s ease-in-out infinite',
        'neon-pulse': 'neon-pulse 2.4s ease-in-out infinite',
        'bc-sweep': 'bc-sweep 7s linear infinite',
        'bc-flicker': 'bc-flicker 5.5s steps(60) infinite',
        'cs-foil': 'cs-foil 6s linear infinite',
        'nn-grid': 'nn-grid 1.6s linear infinite',
        'nn-flicker': 'nn-flicker 6s steps(50) infinite',
        'modal-in': 'modal-in 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'crt-static': 'crt-static 0.2s steps(1) infinite',
        'crt-led': 'crt-led 2.4s ease-in-out infinite',
        'crt-blink': 'crt-blink 1.1s steps(1) infinite',
        'crt-roll': 'crt-roll 0.7s ease-in-out both',
        'signal-lock': 'signal-lock 0.7s cubic-bezier(0.2, 0.7, 0.3, 1)',
        'onair-static': 'onair-static 0.12s steps(4) infinite',
        'onair-roll': 'onair-roll 0.4s linear infinite',
        'onair-ticker': 'onair-ticker 38s linear infinite',
        'onair-pulse': 'onair-pulse 1.4s ease-in-out infinite',
        'onair-tear': 'onair-tear 0.6s cubic-bezier(0.5, 0, 0.75, 0) forwards',
        'onair-bounce-x': 'onair-bounce-x 7s linear infinite alternate',
        'onair-bounce-y': 'onair-bounce-y 4.3s linear infinite alternate',
        'couch-wiggle': 'couch-wiggle 0.6s ease-in-out',
        'couch-drop': 'couch-drop 2.4s ease-in-out',
        'couch-rumble': 'couch-rumble 0.6s ease-out both',
        'couch-shake': 'couch-shake 0.25s ease-in-out',
        'couch-foam-cap': 'couch-foam-cap 1.2s ease-out 0.2s both',
        'couch-foam': 'couch-foam 0.85s both',
        'couch-fling-x': 'couch-fling-x 0.85s linear both',
        'couch-fling-y': 'couch-fling-y 0.85s both',
        'couch-hop-x': 'couch-hop-x 1.65s linear both',
        'couch-hop-y': 'couch-hop-y 1.65s both',
        'couch-flicker': 'couch-flicker 0.5s steps(2) infinite',
        'couch-neon-on': 'couch-neon-on 1.2s linear forwards',
        // The hum and the stars step (about 12 frames a second, like the grain)
        // instead of drawing every frame.
        'couch-neon-hum': 'couch-neon-hum 5.2s steps(12) infinite',
        'couch-neon-off': 'couch-neon-off 0.9s linear forwards',
        'couch-twinkle': 'couch-twinkle 3.2s steps(20) infinite',
        'couch-blink': 'couch-blink 0.7s ease-in-out',
        'couch-shoot': 'couch-shoot 0.9s ease-out forwards',
        'couch-cross': 'couch-cross 60s linear infinite',
        'couch-laptop-in': 'couch-laptop-in 240ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        // A hard cut in; visible for the GSN ident's beat; words stepping in;
        // a lineup item popping in; the slow push-in; the listings crawling up.
        'tv-ad-cut': 'tv-ad-cut 1ms linear both',
        'tv-ad-hold': 'tv-ad-hold 1.4s linear',
        'tv-ad-in': 'tv-ad-in 320ms cubic-bezier(0.2, 0.7, 0.3, 1) both',
        'tv-ad-pop': 'tv-ad-pop 420ms cubic-bezier(0.3, 0.7, 0.4, 1) both',
        'tv-ad-push': 'tv-ad-push 4s linear both',
        'tv-ad-crawl': 'tv-ad-crawl 4.5s linear both',
      },
    },
  },
  plugins: [],
}
