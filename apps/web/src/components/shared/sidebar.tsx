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
  ExternalLink,
  MessageSquare,
  Clock,
  Search,
  BookOpen,
  HelpCircle,
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

/**
 * Primary navigation - daily use items
 * These are the core features users interact with most
 */
const PRIMARY_NAV: NavItem[] = [
  { name: 'Overview', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: 'Investigations', href: ROUTES.INVESTIGATIONS, icon: Search },
  { name: 'Chat', href: '/dashboard/chat', icon: MessageSquare },
]

/**
 * Configure navigation - setup and automation
 * Items related to configuring how the system works
 */
const CONFIGURE_NAV: NavItem[] = [
  { name: 'Runbooks', href: '/dashboard/runbooks', icon: BookOpen },
  { name: 'Monitoring', href: '/dashboard/monitoring', icon: Clock },
  { name: 'Integrations', href: ROUTES.INTEGRATIONS, icon: Plug },
]

/**
 * Account navigation - billing and usage
 */
const ACCOUNT_NAV: NavItem[] = [
  { name: 'Usage', href: '/dashboard/usage', icon: BarChart3 },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
]

/**
 * Support navigation - settings, docs, help
 * Less frequently accessed items at the bottom
 */
const SUPPORT_NAV: NavItem[] = [
  { name: 'Settings', href: ROUTES.SETTINGS, icon: Settings },
  { name: 'Docs', href: EXTERNAL_URLS.DOCS, icon: FileText, external: true },
  { name: 'Help', href: EXTERNAL_URLS.SUPPORT, icon: HelpCircle, external: true },
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
 * Navigation section with optional label and divider
 */
function NavSection({
  items,
  label,
  withDivider = false,
}: {
  items: NavItem[]
  label?: string
  withDivider?: boolean
}) {
  return (
    <div className={cn(withDivider && 'pt-4 mt-4 border-t border-border/40')}>
      {label && (
        <span className="px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2 block">
          {label}
        </span>
      )}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.name} item={item} />
        ))}
      </div>
    </div>
  )
}

/**
 * Sidebar navigation component
 *
 * Displays user info and navigation menu.
 * Automatically highlights active route.
 *
 * Organization (top to bottom):
 * 1. Primary - Daily use (Overview, Investigations, Chat)
 * 2. Configure - Setup & automation (Runbooks, Monitoring, Integrations)
 * 3. Account - Billing & usage
 * 4. Support - Settings, docs, help (least frequent)
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
      <nav>
        {/* Primary: Core features users access daily */}
        <NavSection items={PRIMARY_NAV} />

        {/* Configure: Setup and automation */}
        <NavSection items={CONFIGURE_NAV} label="Configure" withDivider />

        {/* Account: Billing and usage tracking */}
        <NavSection items={ACCOUNT_NAV} label="Account" withDivider />

        {/* Support: Settings and help resources */}
        <NavSection items={SUPPORT_NAV} withDivider />
      </nav>
    </aside>
  )
}
