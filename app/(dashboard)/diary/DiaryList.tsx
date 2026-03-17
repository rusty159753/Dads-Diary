'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteDiaryEntry } from './actions'
import { type Database } from '@/lib/supabase/types'

type DiaryEntry = Database['public']['Tables']['diary_entries']['Row']

interface DiaryListClientProps {
  entries: DiaryEntry[]
}

export function DiaryListClient({ entries }: DiaryListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(id: string) {
    setDeletingId(id)
    const formData = new FormData()
    formData.set('id', id)
    startTransition(async () => {
      await deleteDiaryEntry(formData)
      setDeletingId(null)
      router.refresh()
    })
  }

  if (!entries?.length) {
    return (
      <p className='text-muted-foreground py-8 text-center'>
        No diary entries yet. Create your first one above!
      </p>
    )
  }

  return (
    <div className='space-y-4'>
      {entries.map(entry => (
        <Card key={entry.id} className={deletingId === entry.id ? 'opacity-50' : ''}>
          <CardHeader className='pb-2'>
            <div className='flex items-start justify-between gap-2'>
              <div className='flex-1 min-w-0'>
                <CardTitle className='text-lg leading-tight'>{entry.title}</CardTitle>
                <p className='text-xs text-muted-foreground mt-1'>
                  {new Date(entry.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='destructive'
                    size='icon'
                    disabled={isPending}
                    aria-label='Delete entry'
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{entry.title}&quot;. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(entry.id)}
                      className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <p className='whitespace-pre-wrap text-sm'>{entry.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Loading skeleton for Suspense fallback
export function DiaryListSkeleton() {
  return (
    <div className='space-y-4'>
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className='h-32 w-full rounded-lg' />
      ))}
    </div>
  )
}
