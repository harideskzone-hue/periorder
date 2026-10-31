/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      colors: {
        apple: {
          blue: "#0071e3",
          hover: "#0077ed",
          darkblue: "#005bb5",
          gray: {
            50: "#fbfbfd",
            100: "#f5f5f7",
            200: "#e8e8ed",
            300: "#d2d2d7",
            400: "#86868b",
            500: "#6e6e73",
            600: "#424245",
            700: "#333336",
            800: "#1d1d1f",
            900: "#161617",
          },
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'apple-card': '0 2px 12px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.08)',
        'apple-card-hover': '0 8px 24px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.12)',
        'apple-dropdown': '0 12px 32px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}
