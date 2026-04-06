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
import { endpoints } from './endpoints'
import { graphQLQueries, graphQLMutations } from './graphql'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
