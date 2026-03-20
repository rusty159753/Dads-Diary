export default function Dashboard() {
  return (
    <div className="min-h-screen p-12 bg-gradient-to-br from-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold text-slate-100 mb-12 text-center">
          Your Dashboard
        </h1>
        <p className="text-xl text-slate-400 text-center mb-12">
          Kids and journal entries will appear here.
        </p>
        <div className="text-center">
          <a href="/auth" className="text-blue-400 hover:text-blue-300 text-lg underline">
            ← Back to login
          </a>
        </div>
      </div>
    </div>
  )
}
