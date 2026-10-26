import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ensureSession, supabase } from '../lib/supabase.js'

export default function Start() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  async function createHome() {
    setCreating(true)
    setError(null)
    try {
      await ensureSession()
      const { data: code, error } = await supabase.rpc('create_home')
      if (error) throw error
      navigate(`/c/${code}`)
    } catch {
      setError('Não foi possível criar a casa. Tente de novo.')
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">basket</h1>
        <p className="mt-2 text-gray-600">
          Lista de compras com cálculo automático do total durante a ida ao supermercado.
        </p>
      </div>

      <button
        onClick={createHome}
        disabled={creating}
        className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {creating ? 'Criando…' : 'Criar casa'}
      </button>

      {error && <p className="text-red-600">{error}</p>}
    </main>
  )
}
