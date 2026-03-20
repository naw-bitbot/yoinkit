const yoinkitPreset = require("@yoinkit/ui/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [yoinkitPreset],
  plugins: [],
};
