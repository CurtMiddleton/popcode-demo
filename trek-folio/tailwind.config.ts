import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Trek Folio brand palette
        tf: {
          white: "var(--tf-white)",
          cream: "var(--tf-cream)",
          "cream-border": "var(--tf-cream-border)",
          ink: "var(--tf-ink)",
          muted: "var(--tf-muted)",
          "border-tertiary": "var(--tf-border-tertiary)",
          "border-secondary": "var(--tf-border-secondary)",
          flight: "var(--tf-flight)",
          "flight-tint": "var(--tf-flight-tint)",
          "flight-border": "var(--tf-flight-border)",
          hotel: "var(--tf-hotel)",
          "hotel-tint": "var(--tf-hotel-tint)",
          "hotel-border": "var(--tf-hotel-border)",
          restaurant: "var(--tf-restaurant)",
          "restaurant-tint": "var(--tf-restaurant-tint)",
          "restaurant-border": "var(--tf-restaurant-border)",
          bar: "var(--tf-bar)",
          "bar-tint": "var(--tf-bar-tint)",
          "bar-border": "var(--tf-bar-border)",
          activity: "var(--tf-activity)",
          "activity-tint": "var(--tf-activity-tint)",
          "activity-border": "var(--tf-activity-border)",
          car: "var(--tf-car)",
          "car-tint": "var(--tf-car-tint)",
          "car-border": "var(--tf-car-border)",
          note: "var(--tf-note)",
          "note-tint": "var(--tf-note-tint)",
          "note-border": "var(--tf-note-border)",
          terra: "var(--tf-terra)",
          "terra-deep": "var(--tf-terra-deep)",
          "terra-light": "var(--tf-terra-light)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        pill: "20px",
        tf: "14px",
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        micro: ["9px", { letterSpacing: "0.16em", lineHeight: "1.4" }],
      },
      spacing: {
        "tf-xs": "4px",
        "tf-sm": "8px",
        "tf-md": "12px",
        "tf-lg": "16px",
        "tf-xl": "24px",
        "tf-2xl": "32px",
        "tf-3xl": "48px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
