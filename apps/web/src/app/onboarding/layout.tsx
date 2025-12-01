import { Stepper } from '@/components/ui/stepper'

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'connect', title: 'Connect' },
  { id: 'setup', title: 'Setup' },
]

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">Scout</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
