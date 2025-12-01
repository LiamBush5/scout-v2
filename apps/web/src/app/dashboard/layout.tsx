import { Header } from '@/components/shared/header'
import { Sidebar } from '@/components/shared/sidebar'
import { CommandMenu } from '@/components/shared/command-menu'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Lightweight top header */}
      <Header />

      {/* Centered container with sidebar and content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-12">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      <CommandMenu />
      <Toaster />
    </div>
  )
}
