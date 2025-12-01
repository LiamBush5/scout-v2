'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Stepper } from '@/components/ui/stepper'
import { useOnboardingStore } from '@/lib/stores/onboarding'
import { roleStepSchema, type RoleStepData } from '@/lib/validations/onboarding'
import { ArrowRight, Zap } from 'lucide-react'

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'connect', title: 'Connect' },
  { id: 'setup', title: 'Setup' },
]

export default function WelcomePage() {
  const router = useRouter()
  const { formData, setFormData, nextStep } = useOnboardingStore()

  const form = useForm<RoleStepData>({
    resolver: zodResolver(roleStepSchema),
    defaultValues: {
      role: formData.role,
      companySize: formData.companySize,
    },
  })

  const onSubmit = (data: RoleStepData) => {
    setFormData(data)
    nextStep()
    router.push('/onboarding/connect')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Stepper steps={steps} currentStep={0} className="mb-12" />

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mb-4">
          <Zap className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Scout</h1>
        <p className="text-muted-foreground text-lg">
          From alert to diagnosis in 60 seconds, not 60 minutes.
        </p>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What best describes your role?</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="engineer">Software Engineer</SelectItem>
                      <SelectItem value="devops">DevOps / SRE</SelectItem>
                      <SelectItem value="product">Product Manager</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companySize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company size</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-1000">201-1000 employees</SelectItem>
                      <SelectItem value="1000+">1000+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" size="lg">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      </Card>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Press <kbd className="px-2 py-1 text-xs rounded bg-muted border">⌘K</kbd> anytime to open the command palette
      </p>
    </div>
  )
}
