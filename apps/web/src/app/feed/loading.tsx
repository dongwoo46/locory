export default function FeedLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-40" />
      <div className="max-w-lg mx-auto pt-14 pb-24">
        <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100">
          <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-8 w-16 bg-gray-100 rounded-full animate-pulse ml-auto" />
        </div>
        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
