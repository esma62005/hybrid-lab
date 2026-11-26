module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        jet: "#000000",
        panel: "#0b0a10",
        line: "rgba(255,255,255,0.08)",
        amethyst: { DEFAULT: "#8b5cf6", deep: "#5b2bb5", soft: "#b79cff" },
        cyan: { electric: "#22e5ff" },
        orchid: "#ff5fa2",
        mint: "#4ff0b0",
        mist: "#8f8ba6",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-manrope)", "system-ui", "sans-serif"],
      },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: 1, transform: "scale(1)" }, "50%": { opacity: 0.45, transform: "scale(0.8)" } },
        sweep: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
      },
      animation: { pulseDot: "pulseDot 1.8s ease-in-out infinite", sweep: "sweep 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
