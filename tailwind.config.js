/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: "#f5c542",
        "gold-soft": "#facc6b",
        dark: "#020617",
      },
      boxShadow: {
        glow: "0 0 30px rgba(245, 197, 66, 0.35)",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
