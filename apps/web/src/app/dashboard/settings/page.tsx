'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { User, Building2, Calendar, Shield, Loader2 } from 'lucide-react'
import { ROUTES } from '@/lib/constants'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  current_org_id: string | null
}

interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    async function fetchUserData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileData) {
          setProfile({
            id: user.id,
            email: user.email || '',
            full_name: profileData.full_name,
            avatar_url: profileData.avatar_url,
            created_at: user.created_at,
            current_org_id: profileData.current_org_id,
          })
          setFullName(profileData.full_name || '')

          // Fetch org if exists
          if (profileData.current_org_id) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', profileData.current_org_id)
              .single()

            if (orgData) {
              setOrg(orgData)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [router])

  const handleUpdateProfile = async () => {
    if (!profile) return

    setIsSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profile.id)

      if (error) throw error

      setProfile({ ...profile, full_name: fullName })
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(ROUTES.HOME)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-muted/30 rounded-lg" />
          <div className="h-32 bg-muted/30 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {/* Profile Section */}
      <Card className="p-5 border-border/50">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border/40">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium text-sm">Profile</h2>
        </div>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fullName" className="text-xs text-muted-foreground">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="h-9"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
            <Input
              id="email"
              value={profile?.email || ''}
              disabled
              className="h-9 bg-muted/30"
            />
            <p className="text-[11px] text-muted-foreground">
              Email cannot be changed. Contact support if needed.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Member since {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}</span>
          </div>

          <Button onClick={handleUpdateProfile} disabled={isSaving} size="sm" className="h-8 text-xs">
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save Changes
          </Button>
        </div>
      </Card>

      {/* Organization Section */}
      <Card className="p-5 border-border/50">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border/40">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium text-sm">Organization</h2>
        </div>

        {org ? (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Organization Name</Label>
              <Input value={org.name} disabled className="h-9 bg-muted/30" />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Organization Slug</Label>
              <Input value={org.slug} disabled className="h-9 bg-muted/30 font-mono text-xs" />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>Created {formatDate(org.created_at)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No organization associated with this account.</p>
        )}
      </Card>

      {/* Security Section */}
      <Card className="p-5 border-border/50">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border/40">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium text-sm">Security</h2>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Password</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Change your password to keep your account secure.
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.info('Password reset email sent')}>
              Change
            </Button>
          </div>

          <div className="border-t border-border/40 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-destructive">Sign Out</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign out of your account on this device.
                </p>
              </div>
              <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
