/** @type {import('next').Config} */
const nextConfig = {
  // Handle external packages
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    // Improve build stability
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
  },
  // Improve build performance and stability
  swcMinify: true,
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  // Configure webpack to handle SSR issues and search buildout conflicts
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // PDF.js has been removed to prevent build issues
    // PDF files will show a download link instead of preview

    // Improve build stability in development
    if (dev) {
      config.watchOptions = {
        poll: process.env.NODE_ENV === 'development' ? 3000 : 2000, // Increased for dev
        aggregateTimeout: process.env.NODE_ENV === 'development' ? 1000 : 500, // Increased for dev
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/dist/**',
          '**/build/**',
          '**/*.log',
          '**/coverage/**',
        ],
      };
      
      // Reduce hot reload conflicts
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Create a vendor chunk for better stability
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };

      // Add development-specific optimizations
      if (process.env.NODE_ENV === 'development') {
        config.optimization.minimize = false;
        config.optimization.minimizer = [];
      }
    }
    
    return config;
  },
  // NextAuth.js specific configuration
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  // Ensure proper error page handling
  async redirects() {
    return [];
  },
  async rewrites() {
    return [
      // Proxy Socket.IO to backend
      {
        source: '/socket.io/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vssyl-server-235369681725.us-central1.run.app'}/socket.io/:path*`,
      },
      // Proxy specific auth endpoints to backend (register, etc.)
      {
        source: '/api/auth/register',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vssyl-server-235369681725.us-central1.run.app'}/api/auth/register`,
      },
      // Note: All other API routes are handled by the API proxy route handler at /api/[...slug]/route.ts
      // This avoids conflicts between Next.js rewrites and the API proxy route handler
    ];
  },
  // Improve build output for Cloud Run
  output: 'standalone',
  // Skip static generation for error pages to prevent Html import issues
  // This prevents Next.js from trying to statically generate /404 and /500 pages
  generateBuildId: async () => {
    // Use a consistent build ID to avoid regeneration issues
    return process.env.BUILD_ID || `build-${Date.now()}`;
  },
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Enable compression
    compress: true,
    // Optimize images
    images: {
      domains: ['storage.googleapis.com'],
      formats: ['image/webp', 'image/avif'],
    },
    // Production headers
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin',
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=()',
            },
          ],
        },
        {
          source: '/api/(.*)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-cache, no-store, must-revalidate',
            },
          ],
        },
      ];
    },
  }),
  // Development-specific optimizations
  ...(process.env.NODE_ENV === 'development' && {
    // Reduce hot reload frequency
    onDemandEntries: {
      maxInactiveAge: 120 * 1000, // 2 minutes (increased)
      pagesBufferLength: 3, // Reduced from 5
    },
    // Improve development server stability
    devIndicators: {
      buildActivity: false,
      buildActivityPosition: 'bottom-right',
    },
    // Add development-specific headers
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-cache, no-store, must-revalidate',
            },
          ],
        },
      ];
    },
  }),
};

module.exports = nextConfig; 