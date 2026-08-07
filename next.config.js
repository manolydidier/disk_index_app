// next.config.js
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [];
  },
};

module.exports = (phase) => ({
  ...nextConfig,
  // Autoriser les hôtes ngrok
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io'],
  // `next dev` and `next start` must never write to the same build directory —
  // when both run against this project at once (e.g. an IDE auto-starting
  // `npm run dev` alongside the deployed production server), they clobber
  // each other's manifests and the production server starts 400ing every
  // static asset. Keeping dev output in its own folder makes them independent.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});