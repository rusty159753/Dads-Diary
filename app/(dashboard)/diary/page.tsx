import { Suspense } from 'react'
import { getDiaryEntries } from './actions'
import { DiaryListClient, DiaryListSkeleton } from './DiaryList'
import DiaryForm from './DiaryForm'

export default async function DiaryPage() {
  const entries = await getDiaryEntries()

  return (
    <main className='container mx-auto py-10'>
      <h1 className='text-3xl font-bold mb-8'>My Diary</h1>

      <DiaryForm />

      <section className='max-w-2xl'>
        <h2 className='text-xl font-semibold mb-4'>Your Entries</h2>
        <Suspense fallback={<DiaryListSkeleton />}>
          <DiaryListClient entries={entries} />
        </Suspense>
      </section>
    </main>
  )
}
