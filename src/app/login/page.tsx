import { redirect } from 'next/navigation'
import { AuthError, requireUser } from '@/lib/auth-guard'
import LoginPageClient from './LoginPageClient'

export default async function LoginPage() {
  try {
    await requireUser()
    redirect('/auth/post-login')
  } catch (error) {
    if (error instanceof AuthError && error.code === 'DEACTIVATED') {
      return <LoginPageClient />
    }
  }

  return <LoginPageClient />
}
