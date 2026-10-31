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
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          blue: "#2563EB",      // Primary Blue
          blueHover: "#1D4ED8",
          blueLight: "#EFF6FF",
          teal: "#0F766E",      // Trust Teal
          tealLight: "#F0FDFA",
        },
        status: {
          red: "#DC2626",       // Low stock or urgent
          redLight: "#FEF2F2",
          redBorder: "#FECACA",
          amber: "#D97706",     // Expiring soon or warning
          amberLight: "#FFFBEB",
          amberBorder: "#FDE68A",
          green: "#16A34A",     // Healthy or completed
          greenLight: "#F0FDF4",
          greenBorder: "#BBF7D0",
          slate: "#64748B",     // Neutral or secondary
          slateLight: "#F8FAFC",
        },
        surface: {
          page: "#F8FAFC",      // Page Background
          card: "#FFFFFF",      // Card Background
          border: "#E2E8F0",
          borderLight: "#F1F5F9",
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 6px 16px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}
