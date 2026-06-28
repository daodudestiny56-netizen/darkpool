/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dp: {
          cream:    '#FAF8F3',   /* main bg — warm ivory */
          parchment:'#F3EFE5',   /* secondary bg — antique parchment */
          linen:    '#EDE9DE',   /* cards */
          gold:     '#C89B3C',   /* primary accent — old gold */
          'gold-light': '#E8C97A',/* gold hover */
          indigo:   '#3D3B8E',   /* rich indigo — action color */
          'indigo-light':'#5B59C2',/* lighter indigo */
          violet:   '#7C4DFF',   /* accent violet */
          crimson:  '#C0392B',   /* sell / danger */
          emerald:  '#1A7F4B',   /* buy / success */
          text:     '#1A1510',   /* near-black warm text */
          muted:    '#6B5F4A',   /* warm mid-gray */
          dim:      '#A69880',   /* light muted — labels */
          border:   '#D4C9B0',   /* border — light tan */
          'border-dark': '#B8A88A', /* hovered border */
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        serif:   ['Lora', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient':  'linear-gradient(135deg, #C89B3C 0%, #E8C97A 50%, #C89B3C 100%)',
        'indigo-gradient':'linear-gradient(135deg, #3D3B8E 0%, #7C4DFF 100%)',
        'hero-gradient':  'linear-gradient(160deg, #FAF8F3 0%, #F0EBE0 40%, #EDE0C8 100%)',
      },
      boxShadow: {
        'gold':   '0 4px 24px rgba(200,155,60,0.25)',
        'indigo': '0 4px 24px rgba(61,59,142,0.20)',
        'luxury': '0 20px 60px rgba(26,21,16,0.12)',
        'card':   '0 2px 16px rgba(26,21,16,0.08), 0 1px 4px rgba(26,21,16,0.04)',
      },
    },
  },
  plugins: [],
}
