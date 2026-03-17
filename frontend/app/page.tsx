import Link from 'next/link'

const FEATURES = [
  { icon: '🎨', title: 'Real LEGO® Colors',      desc: '33 official colors matched via CIELAB perceptual distance' },
  { icon: '📋', title: 'Parts List (BOM)',         desc: 'Exact quantities per piece type, ready to order' },
  { icon: '📄', title: 'Build Instructions',       desc: 'PDF in LEGO® style — cover, BOM, step-by-step tips' },
  { icon: '🔮', title: '3D Preview',               desc: 'Interactive Three.js view — rotate, zoom, explore' },
  { icon: '🧱', title: 'Brick Optimizer',          desc: 'Greedy layout reduces brick count up to 3× vs all 1×1' },
  { icon: '🖨️', title: 'STL for 3D Printing',    desc: 'Parametric LEGO-compatible plates ready to print' },
]

const STEPS = [
  { n: '01', title: 'Upload',       desc: 'Drop any JPEG or PNG photo — portrait, landscape, anything.' },
  { n: '02', title: 'DemiBrick it', desc: 'Background removed, color-mapped to LEGO® palette, bricks optimized.' },
  { n: '03', title: 'Build',        desc: 'Download PDF instructions, BOM, and optional STL files.' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[85vh] px-4 text-center">
        <div className="inline-block bg-[#FFD700] text-[#1A1A2E] text-xs font-black px-4 py-1.5 rounded-full mb-6 uppercase tracking-widest shadow-sm">
          Free · No signup · Open source
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-[#1A1A2E] leading-[1.05] mb-6 max-w-3xl">
          The master builder{' '}
          <span className="text-[#FFD700]">deconstructs</span>{' '}
          reality into bricks
        </h1>

        <p className="text-xl text-gray-500 mb-10 max-w-xl">
          Turn any photo into a buildable LEGO® model — complete with color
          palette, parts list, 3D preview, and step-by-step instructions.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-[#FFD700] text-[#1A1A2E] px-8 py-4 rounded-xl text-lg font-black hover:bg-yellow-400 transition-all hover:scale-105 shadow-lg"
          >
            Start Building →
          </Link>
          <a
            href="https://github.com/AHTuGPbI3/DemiBrick"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#1A1A2E] text-white px-8 py-4 rounded-xl text-lg font-black hover:bg-[#2a2a4e] transition-all"
          >
            ☆ GitHub
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-[#1A1A2E] text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFD700] text-[#1A1A2E] text-xl font-black mb-4 shadow">
                  {n}
                </div>
                <h3 className="text-xl font-black text-[#1A1A2E] mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-[#1A1A2E] text-center mb-3">Features</h2>
          <p className="text-center text-gray-400 mb-12 text-sm">Everything runs on CPU — no GPU, no cloud fees</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FFD700] hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-black text-[#1A1A2E] mb-1">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-[#1A1A2E] text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
          Ready to build?
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Upload a photo and get your mosaic in under 30 seconds.
        </p>
        <Link
          href="/create"
          className="inline-block bg-[#FFD700] text-[#1A1A2E] px-10 py-4 rounded-xl text-lg font-black hover:bg-yellow-400 transition-all hover:scale-105"
        >
          Start Building →
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-xs text-gray-300 bg-gray-50">
        <p className="font-bold italic text-[#1A1A2E] mb-1">
          δημιουργός κτίζει κόσμον ἐκ πλίνθων
        </p>
        <p>DemiBrick — LEGO® is a trademark of the LEGO Group. Not affiliated with the LEGO Group.</p>
      </footer>
    </div>
  )
}
