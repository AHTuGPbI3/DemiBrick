export default function GalleryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-black text-[#1A1A2E] mb-4">
        Gallery
      </h1>
      <p className="text-gray-400">Community builds coming soon.</p>

      {/* Placeholder grid */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center"
          >
            <span className="text-3xl opacity-30">🧱</span>
          </div>
        ))}
      </div>
    </div>
  )
}
