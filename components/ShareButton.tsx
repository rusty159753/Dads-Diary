'use client'

import { useState } from 'react'
import { createShareToken } from '@/lib/actions/share'

interface ShareButtonProps {
  entryId: string
}

export default function ShareButton({ entryId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleShare() {
    setLoading(true)
    try {
      const token = await createShareToken(entryId)
      const url = `${window.location.origin}/share/${token}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Share failed:', err)
      alert('Failed to generate share link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading
