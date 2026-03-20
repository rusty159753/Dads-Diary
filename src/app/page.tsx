export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-indigo-900/20 to-slate-900">
      <div className="text-center">
        <h1 className="text-6xl font-black bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-500 bg-clip-text text-transparent drop-shadow-2xl mb-8 animate-pulse">
          Dad's Diary
        </h1>
        <div className="bg-slate-800/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-700 max-w-2xl mx-auto">
          <p className="text-2xl text-slate-200 mb-4 font-medium">
            ✅ Tailwind working!
          </p>
        </div>
      </div>
    </main>
  );
}
