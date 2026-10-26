import { useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

// Calls onChange (debounced) whenever a watched table changes, and when the
// phone comes back to the app, since the socket may drop while it sleeps.
// `tables` is [{ table, filter? }]; the channel is rebuilt only when `name` changes.
export function useRealtime(name, tables, onChange) {
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })

  useEffect(() => {
    let timer
    const trigger = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), 150)
    }

    const channel = supabase.channel(name)
    for (const { table, filter } of tables) {
      const base = { schema: 'public', table }
      const filtered = filter ? { ...base, filter } : base
      channel.on('postgres_changes', { ...filtered, event: 'INSERT' }, trigger)
      channel.on('postgres_changes', { ...filtered, event: 'UPDATE' }, trigger)
      // Delete events can't be filtered; they only carry the id.
      channel.on('postgres_changes', { ...base, event: 'DELETE' }, trigger)
    }
    channel.subscribe()

    const onVisible = () => document.visibilityState === 'visible' && trigger()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tables` is derived from `name`
  }, [name])
}
