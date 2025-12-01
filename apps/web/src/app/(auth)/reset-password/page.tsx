'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Activity, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        // Check if we have the necessary hash/token in the URL
        // Supabase password reset includes hash in URL fragment
        const hash = window.location.hash
        if (!hash && !searchParams.get('code')) {
            toast.error('Invalid reset link. Please request a new password reset.')
            router.push('/forgot-password')
        }
    }, [router, searchParams])

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({
                password: password,
            })

            if (error) {
                toast.error(error.message)
                return
            }

            setSuccess(true)
            toast.success('Password updated successfully!')

            // Redirect to login after 2 seconds
            setTimeout(() => {
                router.push('/login')
            }, 2000)
        } catch {
            toast.error('Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-green-500/10 text-green-500 mb-4">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold">Password updated</h1>
                    <p className="text-muted-foreground mt-1">
                        Your password has been successfully updated
                    </p>
                </div>

                <Card className="p-6">
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                        Redirecting to login...
                    </p>
                    <Button
                        className="w-full"
                        onClick={() => router.push('/login')}
                    >
                        Go to Login
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
                    <Activity className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold">Reset your password</h1>
                <p className="text-muted-foreground mt-1">
                    Enter your new password below
                </p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">New Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={8}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Must be at least 8 characters
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            minLength={8}
                            required
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                    </Button>
                </form>
            </Card>

            <p className="text-center text-sm text-muted-foreground mt-6">
                <Link href="/login" className="text-primary hover:underline inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Back to login
                </Link>
            </p>
        </div>
    )
}

function LoadingFallback() {
    return (
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold">Loading...</h1>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Suspense fallback={<LoadingFallback />}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    )
}
