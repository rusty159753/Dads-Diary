'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type Database } from '@/lib/supabase/types' // Assume exists or create

type DiaryEntry = Database['public']['Tables']['diary_entries']['Row']

export async function getDiaryEntries() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as DiaryEntry[]
}

export async function createDiaryEntry(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  
  const { error } = await supabase
    .from('diary_entries')
    .insert({ title, content, user_id: user.id })
  if (error) throw error
  
  revalidatePath('/dashboard/diary')
}
