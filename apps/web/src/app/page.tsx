import { redirect } from 'next/navigation'

export default function HomePage() {
  // Middleware handles auth-based redirects
  // This is a fallback that redirects to dashboard
  redirect('/dashboard')
}
