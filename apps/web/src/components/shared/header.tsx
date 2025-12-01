'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut, Shield } from 'lucide-react'
import { useUser } from '@/hooks'
import { ROUTES } from '@/lib/constants'

/**
 * Lightweight header component
 *
 * Minimal design with logo, navigation link, and user menu.
 * Matches Cursor-style aesthetic.
 */
export function Header() {
  const router = useRouter()
  const { user, signOut } = useUser()

  const handleSignOut = async () => {
    await signOut()
    router.push(ROUTES.HOME)
  }

  return (
    <header className="h-14 border-b border-border/40">
      <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={ROUTES.DASHBOARD}
          className="flex items-center hover:opacity-70 transition-opacity"
          aria-label="Go to dashboard"
        >
          <Shield className="h-5 w-5 text-primary" />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-5">
          <Link
            href={ROUTES.INVESTIGATIONS}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Agents
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-7 w-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="User menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-muted text-muted-foreground text-[11px] font-medium">
                    {user?.initials || 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={ROUTES.SETTINGS}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
