'use server'

import { createClient } from '@/lib/supabase/server'

export async function createShareToken(entryId: string): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_share_token', {
    entry_id: entryId,
  })

  if (error) throw new Error(error.message)

  return data as string
}
