/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: 'var(--ink)',
        panel: 'var(--panel)',
        surface: 'var(--surface)',
        canvas: 'var(--canvas)',
        edge: 'var(--edge)',
        accent: {
          DEFAULT: '#ff7a1a',
          hover: '#ff9440',
        },
      },
      boxShadow: {
        brutal: '5px 5px 0 0 var(--shadow)',
        'brutal-sm': '3px 3px 0 0 var(--shadow)',
        'brutal-lg': '8px 8px 0 0 var(--shadow)',
        'brutal-edge': '5px 5px 0 0 var(--shadow-edge)',
      },
    },
  },
  plugins: [],
};
