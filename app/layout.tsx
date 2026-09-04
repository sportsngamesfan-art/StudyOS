import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider, NO_FLASH_SCRIPT } from '@/components/theme-provider'

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
      <head>
        {/*
          Inter is loaded at runtime via <link>, not through next/font/google.
          next/font downloads the font files during `next build`, so a blip
          reaching fonts.gstatic.com failed the whole deployment. Loading it
          here keeps the build offline-safe; globals.css carries a system-font
          fallback so text renders correctly even if this request fails.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
