import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import ListsOverview from '../components/ListsOverview.jsx'
import ListView from '../components/ListView.jsx'
import { Spinner, TextSheet } from '../components/ui.jsx'
import { clearLastHome, setLastHome } from '../lib/lastHome.js'
import { ensureSession, supabase } from '../lib/supabase.js'

export default function Home() {
  const { code } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [home, setHome] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const listId = searchParams.get('lista')

  useEffect(() => {
    async function load() {
      try {
        await ensureSession()
        const { data: homeId, error: joinError } = await supabase.rpc('join_home', { p_code: code })
        if (joinError) throw joinError

        const { data, error } = await supabase.from('homes').select('id, name').eq('id', homeId).single()
        if (error) throw error
        setHome(data)
        setLastHome(code)
      } catch {
        clearLastHome()
        setError('Link inválido ou casa não encontrada.')
      }
    }
    load()
  }, [code])

  async function share() {
    const url = `${window.location.origin}/c/${code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'basket', text: 'Nossa lista de compras', url })
      } catch {
        // User closed the share sheet.
      }
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function rename(name) {
    const { error } = await supabase.from('homes').update({ name }).eq('id', home.id)
    if (error) throw error
    setHome((h) => ({ ...h, name }))
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <p className="text-lg text-cherry-600">{error}</p>
        <Link to="/" className="font-semibold text-lagoon-600 underline underline-offset-4">
          Voltar ao início
        </Link>
      </main>
    )
  }

  if (!home) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="bg-linear-to-br from-sapphire-600 via-sapphire-500 to-lagoon-500 text-papaya-50 shadow-lg shadow-sapphire-500/20">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 p-5">
          <button onClick={() => setRenaming(true)} className="min-w-0 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-lagoon-100">basket</p>
            <h1 className="truncate text-2xl font-bold">{home.name}</h1>
          </button>
          <button
            onClick={share}
            className="shrink-0 rounded-xl bg-papaya-50/15 px-4 py-2 text-sm font-semibold ring-1 ring-papaya-50/30 backdrop-blur transition active:scale-95"
          >
            {copied ? 'Link copiado!' : 'Compartilhar'}
          </button>
        </div>
      </header>

      {listId ? (
        <ListView key={listId} listId={listId} onBack={() => setSearchParams({})} />
      ) : (
        <ListsOverview homeId={home.id} onOpen={(id) => setSearchParams({ lista: id })} />
      )}

      {renaming && (
        <TextSheet
          title="Renomear casa"
          label="Nome"
          initial={home.name}
          onSave={rename}
          onClose={() => setRenaming(false)}
        />
      )}
    </div>
  )
}
