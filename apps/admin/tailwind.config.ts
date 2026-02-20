import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0E1116',
        surface: '#161B22',
        border: '#30363D',
        accent: '#2F81F7',
        'accent-hover': '#388BFD',
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
        'status-green': '#3FB950',
        'status-red': '#F85149',
        'status-gray': '#484F58',
      },
    },
  },
  plugins: [],
};

export default config;
