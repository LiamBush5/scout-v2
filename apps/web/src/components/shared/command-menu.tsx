'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Settings,
  Plug,
  FileText,
  Search,
  LogOut,
} from 'lucide-react'
import { useUser } from '@/hooks'
import { ROUTES } from '@/lib/constants'

/**
 * Command menu item configuration
 */
interface CommandMenuItem {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
}

/**
 * Global command menu (Cmd+K)
 *
 * Provides quick navigation and actions via keyboard shortcut.
 * Follows Cursor/Linear-style command palette pattern.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { signOut } = useUser()

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigate = useCallback(
    (path: string) => {
      setOpen(false)
      router.push(path)
    },
    [router]
  )

  const handleSignOut = useCallback(async () => {
    setOpen(false)
    await signOut()
    router.push(ROUTES.HOME)
  }, [signOut, router])

  // Navigation items
  const navigationItems: CommandMenuItem[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => navigate(ROUTES.DASHBOARD),
      keywords: ['home', 'overview'],
    },
    {
      id: 'investigations',
      label: 'View Investigations',
      icon: <Search className="h-4 w-4" />,
      action: () => navigate(ROUTES.INVESTIGATIONS),
      keywords: ['alerts', 'incidents'],
    },
    {
      id: 'settings',
      label: 'Open Settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => navigate(ROUTES.SETTINGS),
      keywords: ['preferences', 'profile'],
    },
    {
      id: 'integrations',
      label: 'Manage Integrations',
      icon: <Plug className="h-4 w-4" />,
      action: () => navigate(ROUTES.INTEGRATIONS),
      keywords: ['github', 'slack', 'datadog', 'connect'],
    },
  ]

  // Action items
  const actionItems: CommandMenuItem[] = [
    {
      id: 'docs',
      label: 'Open Documentation',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        setOpen(false)
        window.open('https://docs.example.com', '_blank')
      },
      keywords: ['help', 'guide'],
    },
    {
      id: 'signout',
      label: 'Sign Out',
      icon: <LogOut className="h-4 w-4" />,
      action: handleSignOut,
      keywords: ['logout', 'exit'],
    },
  ]

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords?.join(' ') || ''}`}
              onSelect={item.action}
            >
              {item.icon}
              <span className="ml-2">{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords?.join(' ') || ''}`}
              onSelect={item.action}
            >
              {item.icon}
              <span className="ml-2">{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
