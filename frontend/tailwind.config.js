/********************************************************
 * Tailwind config tuned for AG UI (Premium/Top-Class).
 *******************************************************/
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"], // Optional: for headings if we add Outfit
      },
      colors: {
        border: "hsl(220 13% 91%)",
        input: "hsl(220 13% 91%)",
        ring: "hsl(224 71% 45%)", // Deep Indigo Ring
        background: "hsl(210 40% 98%)", // Very subtle cool gray
        foreground: "hsl(222 47% 11%)",
        
        primary: {
          DEFAULT: "hsl(224 71% 45%)", // Deep Royal Indigo
          foreground: "#fff",
          50: "hsl(226 100% 97%)",
          100: "hsl(226 100% 94%)",
          200: "hsl(228 100% 89%)",
          300: "hsl(228 100% 82%)",
          400: "hsl(227 92% 73%)",
          500: "hsl(226 85% 62%)",
          600: "hsl(224 71% 45%)", // Main Primary
          700: "hsl(224 64% 33%)",
          800: "hsl(224 60% 25%)",
          900: "hsl(224 56% 18%)",
        },
        secondary: {
          DEFAULT: "hsl(210 40% 96.1%)",
          foreground: "hsl(222 47% 11.2%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(210 40% 98%)",
        },
        muted: {
          DEFAULT: "hsl(210 40% 96.1%)",
          foreground: "hsl(215 16.3% 46.9%)",
        },
        accent: {
          DEFAULT: "hsl(210 40% 96.1%)",
          foreground: "hsl(222 47% 11.2%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(222 47% 11.2%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(222 47% 11.2%)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        "soft": "0 2px 10px rgba(0, 0, 0, 0.03)",
        "medium": "0 4px 20px rgba(0, 0, 0, 0.06)",
        "hard": "0 4px 12px rgba(0, 0, 0, 0.1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: 0, transform: "translateY(16px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
      },
    },
  },
  plugins: [],
};
