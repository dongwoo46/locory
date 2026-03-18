export default function PlaceLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-40" />
      <div className="max-w-lg mx-auto pt-14 pb-24">
        <div className="h-52 bg-gray-200 animate-pulse" />
        <div className="bg-white px-4 py-4 border-b border-gray-100 flex flex-col gap-2">
          <div className="h-4 w-16 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-0.5 mt-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
