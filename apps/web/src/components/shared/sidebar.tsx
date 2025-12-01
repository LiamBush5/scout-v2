'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks'
import { ROUTES, EXTERNAL_URLS } from '@/lib/constants'
import {
  LayoutDashboard,
  Settings,
  Plug,
  BarChart3,
  CreditCard,
  FileText,
  Mail,
  ExternalLink,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'

/**
 * Navigation item configuration
 */
interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  external?: boolean
}

/** Primary navigation items */
const MAIN_NAV: NavItem[] = [
  { name: 'Overview', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Settings', href: ROUTES.SETTINGS, icon: Settings },
  { name: 'Integrations', href: ROUTES.INTEGRATIONS, icon: Plug },
]

/** Account and billing navigation */
const ACCOUNT_NAV: NavItem[] = [
  { name: 'Usage', href: '/dashboard/usage', icon: BarChart3 },
  { name: 'Spending', href: '/dashboard/spending', icon: CreditCard },
  { name: 'Billing & Invoices', href: '/dashboard/billing', icon: FileText },
]

/** Support and external links */
const SUPPORT_NAV: NavItem[] = [
  { name: 'Docs', href: EXTERNAL_URLS.DOCS, icon: FileText, external: true },
  { name: 'Contact Us', href: EXTERNAL_URLS.SUPPORT, icon: Mail, external: true },
]

/**
 * Navigation link component
 */
function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname()

  const isActive =
    pathname === item.href ||
    (item.href !== ROUTES.DASHBOARD && pathname.startsWith(item.href))

  const className = cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
    isActive
      ? 'bg-accent text-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  )

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <item.icon className="h-4 w-4" />
        {item.name}
      </a>
    )
  }

  return (
    <Link href={item.href} className={className}>
      <item.icon className="h-4 w-4" />
      {item.name}
    </Link>
  )
}

/**
 * Navigation section with optional divider
 */
function NavSection({
  items,
  withDivider = false,
}: {
  items: NavItem[]
  withDivider?: boolean
}) {
  return (
    <div className={cn(withDivider && 'pt-5 mt-5 border-t border-border/40', 'space-y-0.5')}>
      {items.map((item) => (
        <NavLink key={item.name} item={item} />
      ))}
    </div>
  )
}

/**
 * Sidebar navigation component
 *
 * Displays user info and navigation menu.
 * Automatically highlights active route.
 */
export function Sidebar() {
  const { user } = useUser()

  return (
    <aside className="w-52 flex-shrink-0">
      {/* User Info */}
      <div className="py-3 mb-4">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-foreground">
            {user?.fullName || 'User'}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
        </div>
        <p className="text-xs text-muted-foreground truncate">
          Pro Plan · {user?.email || ''}
        </p>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5">
        <NavSection items={MAIN_NAV} />
        <NavSection items={ACCOUNT_NAV} withDivider />
        <NavSection items={SUPPORT_NAV} withDivider />
      </nav>
    </aside>
  )
}
