import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Medium', plural: 'Medien' },
  access: { read: () => true },
  // Native folders feature (Payload 3.x+) — drag-drop tree in admin.
  // Replaces the previous hand-rolled `folder` select field. Don't ship both
  // simultaneously: a `folder` field collides with Payload's auto-injected
  // `folder` relationship (rename workaround does NOT work — drop the select).
  folders: true,
  admin: {
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    listSearchableFields: ['alt', 'filename'],
  },
  upload: {
    staticDir: 'media',
    imageSizes: [
      // Cropped variants (both width AND height set) — for thumbnails / cards
      // where a fixed aspect ratio is wanted.
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card',      width: 768, height: 576, position: 'centre' },
      // Aspect-preserving variants (height: undefined) — for srcset inside
      // arbitrary aspect-ratio containers. Cropped variants would mis-frame.
      // PayloadImage's srcset uses these three plus the original.
      { name: 'small-w',   width: 800,  height: undefined, position: 'centre' },
      { name: 'medium-w',  width: 1280, height: undefined, position: 'centre' },
      { name: 'hero',      width: 1920, height: undefined, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
    // Allow images and video. PayloadMedia auto-picks the right renderer.
    // Per-collection override: set `mimeTypes: ['image/*']` if a project
    // doesn't transcode video and shouldn't accept .mp4/.mov uploads.
    mimeTypes: ['image/*', 'video/*'],
    formatOptions: {
      format: 'webp',
      options: { quality: 82 },
    },
  },
  fields: [
    { name: 'alt', type: 'text', required: true, localized: true },
  ],
}
