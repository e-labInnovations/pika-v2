import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { collections, Users } from './collections'
import { plugins } from './plugins'
import { onInit } from './seed/init'
import { endpoints } from './endpoints'
import { graphQLQueries } from './graphql'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    autoLogin:
      process.env.NODE_ENV === 'development'
        ? { email: 'ashad@elabins.com', password: 'password', prefillOnly: true }
        : false,
    autoRefresh: true,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      providers: [
        '@/components/admin/LucideSpriteProvider#default',
        '@/components/admin/TooltipProvider#default',
      ],
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
      ],
    },
  },
  collections: collections,
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
  },
  plugins,
})
