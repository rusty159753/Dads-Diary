export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-900 to-slate-950">
      <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
        Dad&apos;s Diary
      </h1>
      <p className="text-xl text-slate-400 max-w-md mb-8">
        Simple journaling for fathers. Memories that last.
      </p>
      <a href="/auth" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-5 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300">
        Start Writing
      </a>
    </div>
  )
}
