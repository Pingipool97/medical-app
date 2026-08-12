/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'bcryptjs'],
    // Il DB della demo non è raggiunto da import statici: senza questo Vercel
    // non lo impacchetta nella funzione serverless e a runtime non esiste.
    outputFileTracingIncludes: {
      '/**/*': ['./prisma/dev.db'],
    },
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
      ],
    },
  ],
};

export default nextConfig;
