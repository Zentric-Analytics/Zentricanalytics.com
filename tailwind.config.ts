import type { Config } from 'tailwindcss';
const config: Config = { content: ['./src/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#0c1222', brand: '#123c69', accent: '#1f7a8c' } } }, plugins: [] };
export default config;
