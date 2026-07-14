import { SignUp } from '@clerk/nextjs'

export const metadata = { title: 'Sign up' }

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <SignUp />
    </main>
  )
}
