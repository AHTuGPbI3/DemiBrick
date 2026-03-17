import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      {/* Hero */}
      <div className="max-w-3xl mx-auto">
        <div className="inline-block bg-[#FFD700] text-[#1A1A2E] text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-widest">
          Free · No account needed
        </div>

        <h1 className="text-5xl md:text-6xl font-black text-[#1A1A2E] leading-tight mb-6">
          The master builder{' '}
          <span className="text-[#FFD700]">deconstructs</span>
          <br />
          reality into bricks
        </h1>

        <p className="text-xl text-gray-500 mb-10 max-w-xl mx-auto">
          Turn any photo into a buildable LEGO model — complete with color palette,
          parts list, and step-by-step instructions.
        </p>

        <Link
          href="/create"
          className="inline-block bg-[#FFD700] text-[#1A1A2E] px-8 py-4 rounded-xl text-lg font-black hover:bg-yellow-400 transition-all hover:scale-105 shadow-lg"
        >
          Start Building →
        </Link>
      </div>

      {/* Features row */}
      <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl w-full">
        {[
          { icon: '🎨', label: 'Real LEGO Colors', desc: '35+ official colors' },
          { icon: '📋', label: 'Parts List', desc: 'BOM with counts' },
          { icon: '📄', label: 'Instructions', desc: 'Step-by-step PDF' },
          { icon: '🧱', label: '3D Preview', desc: 'Rotate & explore' },
        ].map(({ icon, label, desc }) => (
          <div
            key={label}
            className="bg-gray-50 rounded-xl p-4 text-left border border-gray-100"
          >
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-bold text-sm text-[#1A1A2E]">{label}</div>
            <div className="text-xs text-gray-400 mt-1">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
