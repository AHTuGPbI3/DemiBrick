import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'DemiBrick — LEGO Mosaic Generator',
  description: 'Turn any photo into a buildable LEGO® model. Free, no signup, runs on CPU.',
  openGraph: {
    title: 'DemiBrick — LEGO Mosaic Generator',
    description: 'Turn any photo into a buildable LEGO® model.',
    type: 'website',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='75' rx='8' fill='%23FFD700'/><circle cx='25' cy='15' r='12' fill='%231A1A2E'/><circle cx='50' cy='15' r='12' fill='%231A1A2E'/><circle cx='75' cy='15' r='12' fill='%231A1A2E'/></svg>",
  },
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
      </body>
    </html>
  )
}
