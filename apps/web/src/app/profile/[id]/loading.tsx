export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-40" />
      <div className="max-w-lg mx-auto pt-14 pb-24">
        <div className="bg-white px-4 py-6 flex flex-col items-center gap-4 border-b border-gray-100">
          <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="w-full h-6 bg-gray-100 rounded-full animate-pulse" />
          <div className="flex gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-5 w-8 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-0.5 mt-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
