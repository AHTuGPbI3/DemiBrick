import Link from 'next/link'

const MODES = [
  {
    icon: '🧱',
    title: 'Mosaic Mode',
    desc: 'Turn any photo into a flat LEGO® pixel mosaic. Background removal, Bambu Lab color matching, greedy brick optimizer, PDF instructions, STL files.',
    badge: 'Fast · CPU only',
    href: '/create?mode=mosaic',
  },
  {
    icon: '🏗️',
    title: '3D Brick Model',
    desc: 'TripoSR reconstructs a 3D mesh from your photo. We voxelize it, map colors to your filament palette, and generate a printable brick-by-brick model.',
    badge: 'TripoSR · HuggingFace GPU',
    href: '/create?mode=3d',
  },
]

const FEATURES = [
  { icon: '🎨', title: 'Bambu Lab Colors',     desc: '55 PLA Basic + Matte colors matched via CIELAB perceptual distance — order exactly what you need' },
  { icon: '🏗️', title: '3D Brick Sculpture',   desc: 'Full 3D voxelization + faBrickation stability optimizer produces a build-ready brick model' },
  { icon: '📐', title: 'LDraw Export',          desc: 'Download .ldr files to open in BrickLink Studio, LEGO Digital Designer, or LDraw.org renderers' },
  { icon: '📏', title: 'Calibration Strip',     desc: 'Printable test strip with 5 stud height variants — find the perfect fit for your printer' },
  { icon: '📋', title: 'Parts List (BOM)',       desc: 'Exact quantities per brick type and color, ready to print and order' },
  { icon: '🔮', title: '3D Preview',            desc: 'Interactive Three.js viewer — Normal / Explode / Build animation / X-Ray modes' },
  { icon: '🧱', title: 'Brick Optimizer',       desc: 'Greedy layout reduces brick count up to 6× vs all 1×1 plates' },
  { icon: '🖨️', title: 'STL for 3D Printing',  desc: 'Parametric LEGO-compatible plates and bricks — print each part type once, swap filament' },
]

const STEPS_MOSAIC = [
  { n: '01', title: 'Upload Photo',    desc: 'Drop any JPEG or PNG — portrait, landscape, anything.' },
  { n: '02', title: 'Pick Filament',   desc: 'Choose PLA Basic, PLA Matte, or select individual Bambu Lab colors.' },
  { n: '03', title: 'Get Your Mosaic', desc: 'Color-mapped, optimized, BOM-ready in under 30 seconds.' },
]

const STEPS_3D = [
  { n: '01', title: 'Upload Photo',     desc: 'Drop any photo of an object — works best with clean backgrounds.' },
  { n: '02', title: 'TripoSR Runs',     desc: 'HuggingFace GPU reconstructs a 3D mesh in 30–90 seconds.' },
  { n: '03', title: 'Voxelize & Build', desc: 'We voxelize the mesh, map colors, optimize bricks, and export LDraw + STL.' },
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
          Turn any photo into a buildable LEGO® model — flat mosaic or full 3D brick sculpture.
          Optimized for Bambu Lab filament, ready to print.
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

      {/* Modes */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-[#1A1A2E] text-center mb-3">Two modes, one tool</h2>
          <p className="text-center text-gray-400 mb-12 text-sm">Same Bambu Lab palette. Different dimensions.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {MODES.map(({ icon, title, desc, badge, href }) => (
              <Link key={title} href={href}
                className="bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-[#FFD700] hover:shadow-lg transition-all group">
                <div className="text-4xl mb-3">{icon}</div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-black text-[#1A1A2E] text-xl">{title}</h3>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{badge}</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{desc}</p>
                <span className="text-sm font-bold text-[#FFD700] group-hover:underline">Try it →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — Mosaic */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 justify-center mb-3">
            <span className="text-2xl">🧱</span>
            <h2 className="text-3xl font-black text-[#1A1A2E]">Mosaic in 3 steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mt-10">
            {STEPS_MOSAIC.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFD700] text-[#1A1A2E] text-xl font-black mb-4 shadow">{n}</div>
                <h3 className="text-xl font-black text-[#1A1A2E] mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — 3D */}
      <section className="py-20 px-4 bg-[#1A1A2E]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 justify-center mb-3">
            <span className="text-2xl">🏗️</span>
            <h2 className="text-3xl font-black text-white">3D Model in 3 steps</h2>
          </div>
          <p className="text-center text-gray-400 mb-10 text-sm">Powered by TripoSR — state-of-the-art single-image 3D reconstruction</p>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS_3D.map(({ n, title, desc }) => (
              <div key={n} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFD700] text-[#1A1A2E] text-xl font-black mb-4 shadow">{n}</div>
                <h3 className="text-xl font-black text-white mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-[#1A1A2E] text-center mb-3">Features</h2>
          <p className="text-center text-gray-400 mb-12 text-sm">
            Bambu Lab PLA Basic (30) + PLA Matte (25) · LDraw · STL · PDF · Calibration strip
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FFD700] hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-black text-[#1A1A2E] mb-1 text-sm">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gray-50 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-[#1A1A2E] mb-4">
          Ready to build?
        </h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Mosaic in 30 seconds. Full 3D model in under 2 minutes.
        </p>
        <Link
          href="/create"
          className="inline-block bg-[#FFD700] text-[#1A1A2E] px-10 py-4 rounded-xl text-lg font-black hover:bg-yellow-400 transition-all hover:scale-105"
        >
          Start Building →
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-xs text-gray-400 border-t border-gray-100">
        <p className="font-bold italic text-[#1A1A2E] mb-2 text-sm">
          δημιουργός κτίζει κόσμον ἐκ πλίνθων
        </p>
        <p className="mb-1">
          DemiBrick — LEGO® is a trademark of the LEGO Group. Not affiliated with the LEGO Group.
        </p>
        <p>
          Bambu Lab™ filament names used for reference only. Not affiliated with Bambu Lab.
          TripoSR by Stability AI, used via HuggingFace Spaces.
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <a href="https://github.com/AHTuGPbI3/DemiBrick" target="_blank" rel="noopener noreferrer"
            className="hover:text-[#1A1A2E] transition-colors">GitHub ↗</a>
          <span className="text-gray-200">|</span>
          <a href="https://huggingface.co/stabilityai/TripoSR" target="_blank" rel="noopener noreferrer"
            className="hover:text-[#1A1A2E] transition-colors">TripoSR ↗</a>
        </div>
      </footer>
    </div>
  )
}
