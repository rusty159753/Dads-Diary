import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getDiaryEntries } from './actions'
import { Skeleton } from '@/components/ui/skeleton' // Assume exists

export default async function DiaryList() {
  const entries = await getDiaryEntries()

  if (!entries?.length) {
    return <p className='text-muted-foreground py-8 text-center'>No diary entries yet. Create your first one above!</p>
  }

  return (
    <div className='space-y-4'>
      {entries.map(entry => (
        <Card key={entry.id}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg leading-tight'>{entry.title}</CardTitle>
            <p className='text-xs text-muted-foreground'>
              {new Date(entry.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', month: 'short', day: 'numeric' 
              })}
            </p>
          </CardHeader>
          <CardContent>
            <p className='whitespace-pre-wrap text-sm'>{entry.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
