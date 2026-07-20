import { SignUp } from '@clerk/nextjs'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Sign up', ...NO_INDEX }

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <SignUp />
    </main>
  )
}
