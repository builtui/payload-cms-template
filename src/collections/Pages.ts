import type { CollectionConfig } from 'payload'
import { allBlocks } from '../blocks'
import { slugField } from '../fields/slugField'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Seite', plural: 'Seiten' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'isHomepage', 'isArchive'],
    group: 'Inhalte',
  },
  // Reads are open at the collection level — the public frontend
  // filters `_status='published'` explicitly in each query (see
  // app/(frontend)/page.tsx and [slug]/page.tsx). Keeping the
  // collection access open means admin list-views, version-lookups,
  // and the side-by-side Live-Preview iframe all work without the
  // anonymous-vs-authenticated filter accidentally hiding things
  // from the editor. Public visibility is enforced at the route
  // level, NOT at the collection level.
  access: { read: () => true },
  // Native Payload drafts — adds a "Save Draft" / "Publish" pair of
  // buttons, a version history per document (rollback supported), and
  // a `_status` column with values 'draft' | 'published'. Frontend
  // pages must filter on `_status=published` (see app/(frontend)/page.tsx
  // and app/(frontend)/[slug]/page.tsx for the canonical pattern).
  versions: {
    drafts: {
      autosave: false,
      schedulePublish: false,
    },
    maxPerDoc: 50,
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    slugField('title'),
    {
      name: 'isHomepage',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Nur eine Seite kann Startseite sein.',
      },
      hooks: {
        beforeValidate: [
          async ({ value, req, originalDoc }) => {
            if (value !== true) return value
            const others = await req.payload.find({
              collection: 'pages',
              where: { isHomepage: { equals: true } },
              limit: 1,
            })
            const otherId = others.docs[0]?.id
            if (otherId && otherId !== (originalDoc as any)?.id) {
              throw new Error(
                'Eine andere Seite ist bereits als Startseite markiert. Bitte dort erst deaktivieren.',
              )
            }
            return value
          },
        ],
      },
    },
    {
      name: 'isArchive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Markiert diese Seite als Platzhalter für eine Collection-Index-Route (z.B. /work, /blog). Die Seite wird nicht eigenständig gerendert — die dedizierte Next.js-Route übernimmt. Vorhanden damit Editoren sie per Link-Dropdown als Ziel wählen können. Im dynamic [slug]/page.tsx ausfiltern: `if (page.isArchive) return notFound()`.',
      },
    },
    {
      name: 'layout',
      type: 'blocks',
      blocks: allBlocks,
      required: true,
      minRows: 1,
    },
  ],
}
