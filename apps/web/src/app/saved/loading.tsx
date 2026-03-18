export default function SavedLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-40" />
      <div className="max-w-lg mx-auto pt-14 pb-24">
        <div className="flex border-b border-gray-100 bg-white">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-11 flex items-center justify-center">
              <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
