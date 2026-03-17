'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createDiaryEntry } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  title: z.string().min(1, 'Title required').max(100),
  content: z.string().min(10, 'Entry too short')
})

type FormData = z.infer<typeof schema>

export default function DiaryPage() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', content: '' }
  })

  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">My Diary</h1>
      
      <Card className="max-w-2xl mb-8">
        <CardHeader>
          <CardTitle>New Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDiaryEntry} className="space-y-4">
            <Input {...form.register('title')} placeholder="Entry title" />
            {form.formState.errors.title && <p>{form.formState.errors.title.message}</p>}
            <Textarea {...form.register('content')} placeholder="What's on your mind?" rows={6} />
            {form.formState.errors.content && <p>{form.formState.errors.content.message}</p>}
            <Button type="submit" className="w-full">Save Entry</Button>
          </form>
        </CardContent>
      </Card>

      {/* Entries list - server fetch in separate component or suspense */}
      <div>Entries will show here after server component integration</div>
    </main>
  )
}
