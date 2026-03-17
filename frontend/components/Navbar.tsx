import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-2xl font-black tracking-tight text-[#1A1A2E]">
          Demi<span className="text-[#FFD700]">Brick</span>
        </span>
      </Link>

      <div className="flex items-center gap-6 text-sm font-medium">
        <Link
          href="/create"
          className="text-[#1A1A2E] hover:text-[#FFD700] transition-colors"
        >
          Create
        </Link>
        <Link
          href="/gallery"
          className="text-[#1A1A2E] hover:text-[#FFD700] transition-colors"
        >
          Gallery
        </Link>
        <Link
          href="/create"
          className="bg-[#FFD700] text-[#1A1A2E] px-4 py-2 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
        >
          Start Building
        </Link>
      </div>
    </nav>
  )
}
