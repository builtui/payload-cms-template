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
      // TODO: Add your production domain(s) here, e.g.:
      // { protocol: 'https', hostname: 'hugenottenhaus-kassel.com' },
    ],
    // Quality levels the image optimizer will accept (Next.js 15+).
    // Fewer values → less cache fragmentation. Use 65 for thumbnails,
    // 80 for content imagery, 90 only if you sell the quality (photo studios).
    qualities: [65, 80, 90],
    // Prefer AVIF → fallback WebP → fallback JPEG (chosen by browser).
    formats: ['image/avif', 'image/webp'],
    // How long Next.js caches each optimized variant on disk (sec).
    // Default is 4 hours — way too short; Sharp re-runs on every expiry.
    // 30 days means the first hit pays the cost, all subsequent are free.
    minimumCacheTTL: 2592000,
    // Reduce srcset fan-out. Default is 8 widths (640/750/828/1080/1200/
    // 1920/2048/3840) which bloats the image-cache storage + runtime
    // work. 3 desktop widths + 3 thumbnail widths covers 99% of layouts.
    deviceSizes: [640, 1080, 1920],
    imageSizes: [256, 384, 640],
  },
  // Production hardening
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Inline critical CSS into <style> tags — eliminates a render-blocking
    // request on the first page load. Measurably better LCP.
    inlineCss: true,
  },
}

export default withPayload(nextConfig)
