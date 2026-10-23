/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        "surface-subtle": "#F1F5F9",
        ink: "#0F172A",
        "ink-muted": "#64748B",
        "ink-faint": "#94A3B8",
        border: "#E2E8F0",
        "border-strong": "#CBD5E1",
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          soft: "#DBEAFE",
        },
        forecast: "#2563EB",
        actual: "#0F172A",
        uncertainty: "#93C5FD",
        "positive-risk": "#DC2626",
        "positive-risk-soft": "#FEE2E2",
        "negative-error": "#0F766E",
        "negative-error-soft": "#CCFBF1",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
