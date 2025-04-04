// tailwind.config.ts
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
      extend: {
        // ... your existing theme extensions
      },
    },
    plugins: [
      require('@tailwindcss/typography'), // Add this line
    ],
  }