import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-gradient">
      <div className="text-center text-white px-4">
        <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight">
          StudyOS
        </h1>
        <p className="text-lg md:text-xl mb-8 text-white/80">
          All-in-one student learning app
        </p>
        <Link
          href="/auth"
          className="inline-block bg-white text-ink px-8 py-3 rounded-xl font-semibold hover:bg-white/90 transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  )
}
