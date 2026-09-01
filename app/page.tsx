import Link from 'next/link'

export default function Home() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{
        background:
          'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
      }}
    >
      <div className="text-center text-white px-4">
        <h1 className="text-5xl font-bold mb-4">StudyOS</h1>
        <p className="text-xl mb-8 text-white/90">All-in-one student learning app</p>
        <Link
          href="/auth"
          className="inline-block bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-white/90 transition-theme"
        >
          Get Started
        </Link>
      </div>
    </main>
  )
}
