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
  reactStrictMode: false,
  transpilePackages: ['upscaler', '@tensorflow/tfjs'],
  // Antes esto estaba en `true` y el build se tragaba 70 errores de tipo. Entre
  // ellos había bugs de verdad (ordenaciones que daban NaN, ids que no
  // existían, campos que se guardaban en Firestore sin estar declarados).
  // Corregidos todos, se deja el chequeo encendido para que no vuelvan a
  // colarse en silencio.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {}, 
};

export default pwaConfig(nextConfig);
