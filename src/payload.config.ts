import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { collections, Users } from './collections'
import { globals } from './globals'
import { plugins } from './plugins'
import { onInit } from './seed/init'
import { migrations } from './migrations'
import { endpoints } from './endpoints'
import { graphQLQueries, graphQLMutations } from './graphql'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * `next build` sets NODE_ENV=production and then initialises Payload while it
 * collects page data — which is enough to fire `prodMigrations` and migrate
 * whatever database the *build machine* happens to point at. A build must
 * never write to a database, so the flag is off for the duration.
 *
 * Next sets NEXT_PHASE itself; PAYLOAD_DISABLE_PROD_MIGRATIONS is the manual
 * escape hatch (CI sets it too, belt and braces, since static-generation
 * workers are separate processes).
 */
const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.PAYLOAD_DISABLE_PROD_MIGRATIONS === 'true'

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3333',
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: '— Pika',
      icons: [
        { rel: 'icon', type: 'image/svg+xml', url: '/icons/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', url: '/icons/favicon.ico' },
        { rel: 'apple-touch-icon', url: '/icons/apple-touch-icon.png' },
      ],
    },
    autoLogin:
      process.env.NODE_ENV === 'development'
        ? { email: 'ashad@elabins.com', password: 'password', prefillOnly: true }
        : false,
    autoRefresh: true,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: '@/components/admin/Logo#default',
        Icon: '@/components/admin/Icon#default',
      },
      afterLogin: ['@/components/admin/GoogleSignInButton#default'],
      providers: [
        '@/components/admin/LucideSpriteProvider#default',
        '@/components/admin/TooltipProvider#default',
      ],
      views: {
        migrate: {
          Component: '@/components/admin/MigrationPage#default',
          path: '/migrate',
        },
      },
    },
    dashboard: {
      defaultLayout: ((_args: unknown) => [
        { widgetSlug: 'dashboard-summary', width: 'full' },
        { widgetSlug: 'weekly-expenses', width: 'large' },
        { widgetSlug: 'monthly-calendar', width: 'large' },
        { widgetSlug: 'monthly-categories', width: 'large' },
        { widgetSlug: 'monthly-tags', width: 'large' },
        { widgetSlug: 'monthly-people', width: 'full' },
        { widgetSlug: 'collections', width: 'full' },
        { widgetSlug: 'reseed', width: 'small' },
      ]) as any,
      widgets: [
        {
          slug: 'dashboard-summary',
          Component: '@/components/admin/DashboardWidget#default',
          minWidth: 'large',
          maxWidth: 'full',
        },
        {
          slug: 'weekly-expenses',
          Component: '@/components/admin/WeeklyExpensesWidget#default',
          minWidth: 'medium',
          maxWidth: 'x-large',
        },
        {
          slug: 'monthly-calendar',
          Component: '@/components/admin/MonthlyCalendarWidget#default',
          minWidth: 'medium',
          maxWidth: 'x-large',
        },
        {
          slug: 'monthly-categories',
          Component: '@/components/admin/MonthlyCategoryWidget#default',
          minWidth: 'medium',
          maxWidth: 'large',
        },
        {
          slug: 'monthly-tags',
          Component: '@/components/admin/MonthlyTagWidget#default',
          minWidth: 'medium',
          maxWidth: 'large',
        },
        {
          slug: 'monthly-people',
          Component: '@/components/admin/MonthlyPeopleWidget#default',
          minWidth: 'medium',
          maxWidth: 'full',
        },
        {
          slug: 'reseed',
          Component: '@/components/admin/ReseedWidget#default',
          minWidth: 'small',
          maxWidth: 'medium',
        },
      ],
    },
  },
  collections: collections,
  globals,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    idType: 'uuid',
    // Never auto-sync schema in production: changes must arrive via committed
    // migration files (`payload migrate:create` locally), because push can
    // silently drop a column when a field is renamed. Left on everywhere else,
    // which is the adapter's own default — dev and the integration tests rely
    // on it to keep their database in step with the collections.
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
    // Production migrations run themselves. The `payload migrate` CLI cannot
    // work on a deployed build — Next's standalone output traces only what the
    // server *imports*, so `payload/bin.js`, `tsx`, and the raw
    // `src/migrations/*.ts` files are all absent from the artifact. Importing
    // the array here instead puts the migrations in the module graph, so they
    // compile into the server bundle and never have to be read off disk.
    //
    // Fires at the end of the adapter's `connect()`, gated on
    // NODE_ENV=production — i.e. on the first request that touches Payload
    // after a deploy, not at process boot. scripts/deploy.sh sends that
    // request itself so a failed migration fails the deploy.
    //
    // Withheld during `next build`: see isBuildPhase above.
    prodMigrations: isBuildPhase ? undefined : migrations,
  }),
  sharp,
  onInit: onInit,
  endpoints,
  graphQL: {
    queries: graphQLQueries,
    mutations: graphQLMutations,
  },
  plugins,
})
