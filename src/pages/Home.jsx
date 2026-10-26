import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { ensureSession, supabase } from '../lib/supabase.js'

export default function Home() {
  const { code } = useParams()
  const [home, setHome] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        await ensureSession()
        const { data: homeId, error: joinError } = await supabase.rpc('join_home', { p_code: code })
        if (joinError) throw joinError

        const { data, error } = await supabase.from('homes').select('id, name').eq('id', homeId).single()
        if (error) throw error
        setHome(data)
      } catch {
        setError('Link inválido ou casa não encontrada.')
      }
    }
    load()
  }, [code])

  if (error) {
    return <main className="mx-auto max-w-md p-6 text-red-600">{error}</main>
  }

  if (!home) {
    return <main className="mx-auto max-w-md p-6 text-gray-500">Carregando…</main>
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">{home.name}</h1>
      <p className="mt-2 text-gray-600">Compartilhe este link para editar a lista em dupla.</p>
    </main>
  )
}
