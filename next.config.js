// next.config.js
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // lib/email.ts loads nodemailer via a webpack-ignored dynamic import (see
  // that file for why) — invisible to the standalone build's file tracer,
  // so without this it can silently go missing from the Docker image and
  // only fail once an email is actually sent in production.
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/nodemailer/**/*'],
  },
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