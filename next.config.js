// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [];
  },
};

// Pour Next.js 13+
module.exports = {
  ...nextConfig,
  // Autoriser les hôtes ngrok
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io'],
};