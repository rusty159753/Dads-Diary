import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface Props {
  params
