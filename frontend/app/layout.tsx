import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'DemiBrick — LEGO Mosaic Generator',
  description: 'Turn any photo into a buildable LEGO model',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-[#1A1A2E]">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="py-4 text-center text-sm text-gray-400">
          © 2026 DemiBrick. LEGO® is a trademark of the LEGO Group, not affiliated with DemiBrick.
        </footer>
      </body>
    </html>
  )
}
