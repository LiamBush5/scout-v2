'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Activity, Loader2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const supabase = createClient()
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) {
                toast.error(error.message)
                return
            }

            setEmailSent(true)
            toast.success('Password reset email sent! Check your inbox.')
        } catch {
            toast.error('Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    if (emailSent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
                            <Activity className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-bold">Check your email</h1>
                        <p className="text-muted-foreground mt-1">
                            We&apos;ve sent a password reset link to {email}
                        </p>
                    </div>

                    <Card className="p-6">
                        <p className="text-sm text-muted-foreground mb-4">
                            Click the link in the email to reset your password. If you don&apos;t see it, check your spam folder.
                        </p>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setEmailSent(false)
                                setEmail('')
                            }}
                        >
                            Send another email
                        </Button>
                    </Card>

                    <p className="text-center text-sm text-muted-foreground mt-6">
                        <Link href="/login" className="text-primary hover:underline inline-flex items-center gap-1">
                            <ArrowLeft className="h-3 w-3" />
                            Back to login
                        </Link>
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-4">
                        <Activity className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold">Reset your password</h1>
                    <p className="text-muted-foreground mt-1">
                        Enter your email address and we&apos;ll send you a link to reset your password
                    </p>
                </div>

                <Card className="p-6">
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send reset link
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Remember your password?{' '}
                    <Link href="/login" className="text-primary hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}

