import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StudyOS',
  description: 'All-in-one student learning app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
