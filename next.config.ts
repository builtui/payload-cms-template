import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Silence workspace-root warning by pinning the project root
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      // TODO: Add your production domain here, e.g.:
      // { protocol: 'https', hostname: 'hugenottenhaus-kassel.com' },
    ],
  },
  // Production hardening
  poweredByHeader: false,
}

export default withPayload(nextConfig)
