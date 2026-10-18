/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0b0c',
        panel: '#111113',
        card: '#151517',
        card2: '#1b1b1e',
        line: '#2a2a2e',
        muted: '#8b8b93',
        dim: '#5f5f66',
        ink: '#ededef',
        accent: '#f26b1d',
        accent2: '#ff8a3d',
        ok: '#22c07a'
      },
      fontFamily: { sans: ['Inter Variable', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
