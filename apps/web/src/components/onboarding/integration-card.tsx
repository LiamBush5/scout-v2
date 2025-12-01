'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, Settings2, Trash2 } from 'lucide-react'

/**
 * Connection status states
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Integration card props
 */
export interface IntegrationCardProps {
  /** Display name of the integration */
  name: string
  /** Optional icon component */
  icon?: React.ReactNode
  /** URL to logo image */
  logo?: string
  /** Description text */
  description: string
  /** Current connection status */
  status: ConnectionStatus
  /** Connected account name/identifier */
  connectedAccount?: string
  /** Handler for connect action */
  onConnect: () => void
  /** Handler for manage/settings action */
  onManage?: () => void
  /** Handler for disconnect action */
  onDisconnect?: () => void
  /** Error message to display */
  errorMessage?: string
  /** Whether manage panel is currently expanded */
  isManaging?: boolean
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
    default:
      return null
  }
}

/**
 * Integration card component
 *
 * Displays an integration with its status and connection controls.
 * Supports logos, icons, and various connection states.
 * When connected, shows "Manage" and "Disconnect" as separate actions.
 */
export function IntegrationCard({
  name,
  icon,
  logo,
  description,
  status,
  connectedAccount,
  onConnect,
  onManage,
  onDisconnect,
  errorMessage,
  isManaging,
}: IntegrationCardProps) {
  const displayText = status === 'connected' && connectedAccount ? connectedAccount : description

  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-card hover:bg-accent/30 transition-colors">
      {/* Logo/Icon */}
      <div className="h-9 w-9 flex items-center justify-center flex-shrink-0 rounded-lg bg-muted/50">
        {logo ? (
          <Image
            src={logo}
            alt={`${name} logo`}
            width={20}
            height={20}
            className="object-contain opacity-80 grayscale"
            unoptimized
          />
        ) : (
          <div className="text-muted-foreground">{icon}</div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm text-foreground">{name}</h3>
          <StatusIndicator status={status} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{displayText}</p>
        {status === 'error' && errorMessage && (
          <p className="text-xs text-destructive mt-1">{errorMessage}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {status === 'disconnected' && (
          <Button onClick={onConnect} size="sm" variant="outline" className="h-8 px-3 text-xs">
            Connect
            <ExternalLink className="h-3 w-3 ml-1.5" />
          </Button>
        )}

        {status === 'connecting' && (
          <Button disabled size="sm" variant="outline" className="h-8 px-3 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Connecting
          </Button>
        )}

        {status === 'connected' && (
          <>
            {onManage && (
              <Button
                variant={isManaging ? 'secondary' : 'outline'}
                onClick={onManage}
                size="sm"
                className="h-8 px-3 text-xs"
              >
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Manage
              </Button>
            )}
            {onDisconnect && (
              <Button
                variant="ghost"
                onClick={onDisconnect}
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}

        {status === 'error' && (
          <Button variant="outline" onClick={onConnect} size="sm" className="h-8 px-3 text-xs">
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
