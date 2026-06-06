/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    BOT_RPC_URL: process.env.BOT_RPC_URL || 'http://localhost:8560',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  },
};

module.exports = nextConfig;
