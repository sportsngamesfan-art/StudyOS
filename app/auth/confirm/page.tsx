import { Suspense } from 'react'
import ConfirmEmailClient from './confirm-client'

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
          }}
        >
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </main>
      }
    >
      <ConfirmEmailClient />
    </Suspense>
  )
}
