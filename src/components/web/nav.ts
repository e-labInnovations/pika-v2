export const NAV = [
  { href: '/app', label: 'Home', icon: 'home' },
  { href: '/app/transactions', label: 'Transactions', icon: 'list' },
  { href: '/app/reports', label: 'Reports', icon: 'chart' },
  { href: '/app/people', label: 'People', icon: 'people' },
  { href: '/app/sms', label: 'SMS review', icon: 'sms' },
] as const

/** Home matches only itself; the others match their subpages too. */
export const isActive = (href: string, path: string) => (href === '/app' ? path === '/app' : path === href || path.startsWith(`${href}/`))
