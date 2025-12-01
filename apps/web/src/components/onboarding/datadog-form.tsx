'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { datadogCredentialsSchema, type DatadogCredentials } from '@/lib/validations/onboarding'
import { Loader2, ExternalLink, Eye, EyeOff, X } from 'lucide-react'

interface DatadogFormProps {
  onSubmit: (data: DatadogCredentials) => Promise<void>
  onCancel: () => void
}

export function DatadogForm({ onSubmit, onCancel }: DatadogFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showAppKey, setShowAppKey] = useState(false)

  const form = useForm<DatadogCredentials>({
    resolver: zodResolver(datadogCredentialsSchema),
    defaultValues: {
      apiKey: '',
      appKey: '',
      site: 'datadoghq.com',
    },
  })

  const handleSubmit = async (data: DatadogCredentials) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Connect Datadog</h3>
            <div className="flex items-center gap-2">
              <a
                href="https://app.datadoghq.com/organization-settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Get API keys
                <ExternalLink className="h-3 w-3" />
              </a>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter your Datadog API credentials. We recommend creating a dedicated
            Application Key with read-only access for security.
          </p>
        </div>

        <FormField
          control={form.control}
          name="site"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Datadog Site</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your Datadog site" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="datadoghq.com">US1 (datadoghq.com)</SelectItem>
                  <SelectItem value="datadoghq.eu">EU (datadoghq.eu)</SelectItem>
                  <SelectItem value="us3.datadoghq.com">US3 (us3.datadoghq.com)</SelectItem>
                  <SelectItem value="us5.datadoghq.com">US5 (us5.datadoghq.com)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Select the Datadog site where your organization is hosted
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Enter your Datadog API key"
                    className="pr-10 font-mono text-sm"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Found in Organization Settings → API Keys
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="appKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Application Key</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showAppKey ? 'text' : 'password'}
                    placeholder="Enter your Datadog Application key"
                    className="pr-10 font-mono text-sm"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowAppKey(!showAppKey)}
                  >
                    {showAppKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                Found in Organization Settings → Application Keys
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Connect Datadog
          </Button>
        </div>
      </form>
    </Form>
  )
}
