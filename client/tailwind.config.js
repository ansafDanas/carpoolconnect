/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep pine: calm, safe, rooted. Deliberately not taxi blue.
        primary: { DEFAULT: "#12332A", hover: "#1B4638", soft: "#E4EFE9" },
        // Marigold: warm, Indian, optimistic. Used for highlights, never fares.
        marigold: { DEFAULT: "#F2A93B", hover: "#DD9226", soft: "#FEF3DC" },
        // Leaf: the actual action colour, calm rather than aggressive.
        leaf: { DEFAULT: "#2E7D62", hover: "#256550", soft: "#E1F1EA" },
        clay: { DEFAULT: "#C9603F", hover: "#AC4C2F", soft: "#FBE9E3" },
        sky: { DEFAULT: "#3E7CA8", hover: "#326892", soft: "#E3EFF7" },
        background: "#FBF8F2",
        surface: "#FFFFFF",
        surfaceMuted: "#F4F1E9",
        text: "#16211D",
        textMuted: "#6B7A73",
        border: "#E4DFD2",
        success: { DEFAULT: "#2E7D62", soft: "#E1F1EA" },
        warning: { DEFAULT: "#C98A2E", soft: "#FDF3E2" },
        danger: { DEFAULT: "#C4503F", soft: "#FAE7E4" },
        info: { DEFAULT: "#3E7CA8", soft: "#E3EFF7" },
        // Retained aliases so older screens keep their palette.
        accent: { DEFAULT: "#2E7D62", hover: "#256550", soft: "#E1F1EA" },
        lime: { DEFAULT: "#F2A93B", hover: "#DD9226", soft: "#FEF3DC" },
        violet: { DEFAULT: "#3E7CA8", soft: "#E3EFF7" },
      },
      fontFamily: {
        display: ["Georgia", "Iowan Old Style", "serif"],
        heading: ["Georgia", "Iowan Old Style", "serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        small: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        label: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 6px 24px rgba(22, 33, 29, 0.06)",
        elevated: "0 18px 48px rgba(22, 33, 29, 0.12)",
        soft: "0 2px 8px rgba(22, 33, 29, 0.05)",
        glow: "0 8px 24px rgba(46, 125, 98, 0.18)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
