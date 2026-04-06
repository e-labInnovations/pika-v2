import type { AdminViewServerProps } from 'payload'
import type { User } from '@/payload-types'
import { MigrationPageClient } from './MigrationPageClient'

export default async function MigrationPage({ initPageResult }: AdminViewServerProps) {
  const user = initPageResult?.req?.user as User | null
  if (!user || user.role !== 'admin') {
    return (
      <div style={{ padding: '2rem', color: 'var(--theme-error-500)' }}>
        Access denied. Only admins can access the migration tool.
      </div>
    )
  }

  return <MigrationPageClient userId={String(user.id)} userName={user.name || user.email || ''} />
}
