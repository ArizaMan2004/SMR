import withPWA from 'next-pwa';

// Configuración PWA
const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // --- CORRECCIÓN PRINCIPAL ---
  reactStrictMode: false, // <--- ESTO EVITA EL ERROR DE SHADERS/WEBGL
  // ----------------------------
  transpilePackages: ['upscaler', '@tensorflow/tfjs'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {}, 
};

export default pwaConfig(nextConfig);