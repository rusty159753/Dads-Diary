'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createDiaryEntry } from './actions'

const schema = z.object({
  title: z.string().min(1, 'Title required').max(100),
  content: z.string().min(10, 'Entry too short')
})

type FormData = z.infer<typeof schema>

export default function DiaryForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', content: '' }
  })

  async function onSubmit(data: FormData) {
    const formData = new FormData()
    formData.set('title', data.title)
    formData.set('content', data.content)
    startTransition(async () => {
      await createDiaryEntry(formData)
      form.reset()
      router.refresh()
    })
  }

  return (
    <Card className='max-w-2xl mb-8'>
      <CardHeader>
        <CardTitle>New Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          <div>
            <Input
              {...form.register('title')}
              placeholder='Entry title'
              disabled={isPending}
            />
            {form.formState.errors.title && (
              <p className='text-sm text-destructive mt-1'>
                {form.formState.errors.title.message}
              </p>
            )}
          </div>
          <div>
            <Textarea
              {...form.register('content')}
              placeholder="What's on your mind?"
              rows={6}
              disabled={isPending}
            />
            {form.formState.errors.content && (
              <p className='text-sm text-destructive mt-1'>
                {form.formState.errors.content.message}
              </p>
            )}
          </div>
          <Button type='submit' className='w-full' disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Entry'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
