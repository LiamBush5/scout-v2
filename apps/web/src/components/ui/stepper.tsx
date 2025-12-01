import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Step {
  id: string
  title: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav className={cn('flex items-center justify-center', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-200',
                index < currentStep &&
                  'border-primary bg-primary text-primary-foreground',
                index === currentStep &&
                  'border-primary text-primary',
                index > currentStep &&
                  'border-muted text-muted-foreground'
              )}
            >
              {index < currentStep ? (
                <Check className="h-5 w-5" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={cn(
                'mt-2 text-xs font-medium transition-colors',
                index <= currentStep
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                'mx-4 h-0.5 w-16 transition-colors duration-200',
                index < currentStep ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </nav>
  )
}
