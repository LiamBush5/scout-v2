'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MoreHorizontal, Loader2, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TeamMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  profile: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export default function TeamPage() {
  const router = useRouter()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [org, setOrg] = useState<Organization | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)

  useEffect(() => {
    async function fetchTeamData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        setCurrentUserId(user.id)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('current_org_id')
          .eq('id', user.id)
          .single()

        if (!profileData?.current_org_id) {
          setIsLoading(false)
          return
        }

        const { data: orgData } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.current_org_id)
          .single()

        if (orgData) {
          setOrg(orgData)
        }

        // Fetch org members
        const { data: membersData } = await supabase
          .from('org_members')
          .select('id, user_id, role, joined_at')
          .eq('org_id', profileData.current_org_id)

        if (membersData && membersData.length > 0) {
          // Fetch profiles for all members
          const userIds = membersData.map(m => m.user_id)
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .in('id', userIds)

          // Create a map of user_id -> profile
          const profileMap = new Map(
            (profilesData || []).map(p => [p.id, p])
          )

          const formattedMembers = membersData.map((member) => {
            const profile = profileMap.get(member.user_id)

            return {
              id: member.id,
              user_id: member.user_id,
              role: member.role as 'owner' | 'admin' | 'member',
              joined_at: member.joined_at,
              profile: {
                email: profile?.email || '',
                full_name: profile?.full_name || null,
                avatar_url: profile?.avatar_url || null,
              },
            }
          })

          formattedMembers.sort((a, b) => {
            const order = { owner: 0, admin: 1, member: 2 }
            return order[a.role] - order[b.role]
          })

          setMembers(formattedMembers)

          const currentMember = formattedMembers.find(m => m.user_id === user.id)
          if (currentMember) {
            setCurrentUserRole(currentMember.role)
          }
        }
      } catch (error) {
        console.error('Failed to fetch team data:', error)
        toast.error('Failed to load team data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTeamData()
  }, [router])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !org) return

    setIsInviting(true)
    try {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInviteForm(false)
    } catch (error) {
      console.error('Failed to send invite:', error)
      toast.error('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleCopyInviteLink = async () => {
    if (!org) return
    const inviteLink = `${window.location.origin}/invite/${org.slug}`
    await navigator.clipboard.writeText(inviteLink)
    toast.success('Invite link copied')
  }

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('org_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error

      setMembers(members.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      ))
      toast.success('Role updated')
    } catch (error) {
      console.error('Failed to update role:', error)
      toast.error('Failed to update role')
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('org_members')
        .delete()
        .eq('id', memberToRemove.id)

      if (error) throw error

      setMembers(members.filter(m => m.id !== memberToRemove.id))
      toast.success('Member removed')
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('Failed to remove member')
    } finally {
      setMemberToRemove(null)
    }
  }

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin'

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Team</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Team</h1>
        <Card className="p-8 text-center border-border/50">
          <p className="text-muted-foreground text-sm">No organization found.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{org.name}</p>
        </div>
        {canManageMembers && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowInviteForm(!showInviteForm)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Invite
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && canManageMembers && (
        <Card className="p-4 border-border/50">
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9 flex-1"
                autoFocus
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'member')}>
                <SelectTrigger className="w-24 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" className="h-9" disabled={isInviting || !inviteEmail}>
                {isInviting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Send
              </Button>
            </div>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Or copy invite link
            </button>
          </form>
        </Card>
      )}

      {/* Members List */}
      <div className="space-y-1">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId
          const canEdit = canManageMembers && !isCurrentUser && member.role !== 'owner'

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/40 transition-colors group"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-accent text-muted-foreground">
                  {getInitials(member.profile.full_name, member.profile.email)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {member.profile.full_name || member.profile.email.split('@')[0]}
                  </span>
                  {isCurrentUser && (
                    <span className="text-[10px] text-muted-foreground">you</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{member.profile.email}</p>
              </div>

              <span className="text-xs text-muted-foreground capitalize">
                {member.role}
              </span>

              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, member.role === 'admin' ? 'member' : 'admin')}
                    >
                      Make {member.role === 'admin' ? 'member' : 'admin'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setMemberToRemove(member)}
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="w-7" />
              )}
            </div>
          )
        })}
      </div>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.profile.full_name || memberToRemove?.profile.email} will lose access to this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
