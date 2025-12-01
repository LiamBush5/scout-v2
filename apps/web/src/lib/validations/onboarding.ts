import { z } from 'zod'

export const roleStepSchema = z.object({
  role: z.enum(['engineer', 'devops', 'product', 'other'], {
    message: 'Please select your role',
  }),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+'], {
    message: 'Please select company size',
  }),
})

export const integrationsStepSchema = z.object({
  integrations: z.object({
    github: z.boolean(),
    slack: z.boolean(),
    datadog: z.boolean(),
  }).refine(
    (data) => data.github || data.slack || data.datadog,
    { message: 'Connect at least one integration to continue' }
  ),
})

export const setupStepSchema = z.object({
  selectedRepos: z.array(z.string()).min(1, 'Select at least one repository'),
})

export const datadogCredentialsSchema = z.object({
  apiKey: z.string().min(32, 'API key must be at least 32 characters'),
  appKey: z.string().min(32, 'Application key must be at least 32 characters'),
  site: z.enum(['datadoghq.com', 'datadoghq.eu', 'us3.datadoghq.com', 'us5.datadoghq.com']),
})

export type RoleStepData = z.infer<typeof roleStepSchema>
export type IntegrationsStepData = z.infer<typeof integrationsStepSchema>
export type SetupStepData = z.infer<typeof setupStepSchema>
export type DatadogCredentials = z.infer<typeof datadogCredentialsSchema>
