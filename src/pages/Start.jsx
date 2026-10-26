import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { getLastHome } from '../lib/lastHome.js'
import { ensureSession, supabase } from '../lib/supabase.js'

export default function Start() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const lastHome = getLastHome()
  if (lastHome) return <Navigate to={`/c/${lastHome}`} replace />

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
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 overflow-hidden p-6">
      <div className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-lagoon-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full bg-jonquil-300/40 blur-3xl" />

      <div className="relative">
        <img src="/favicon.svg" alt="" className="size-14 rounded-2xl shadow-lg shadow-sapphire-500/30" />
        <h1 className="mt-6 text-5xl font-bold tracking-tight">
          basket<span className="text-jonquil-500">.</span>
        </h1>
        <p className="mt-3 text-lg text-sapphire-700">
          Lista de compras com cálculo automático do total durante a ida ao supermercado.
        </p>
      </div>

      <div className="relative flex flex-col gap-3">
        <button
          onClick={createHome}
          disabled={creating}
          className="rounded-2xl bg-linear-to-r from-sapphire-500 to-lagoon-500 px-5 py-4 text-lg font-semibold text-papaya-50 shadow-lg shadow-lagoon-500/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {creating ? 'Criando…' : 'Criar casa'}
        </button>
        <p className="text-center text-sm text-sapphire-600">
          Já tem uma casa? Abra o link que recebeu.
        </p>
        {error && <p className="text-center text-cherry-600">{error}</p>}
      </div>
    </main>
  )
}
