import { useCallback, useEffect, useState } from 'react'
import { formatMoney, listTotals } from '../lib/calc.js'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from '../lib/useRealtime.js'
import { primaryButton, Spinner } from './ui.jsx'

const ITEM_FIELDS = 'status, qty_wanted, qty_bought, price_estimated, unit_price, wholesale_price, wholesale_min_qty'

export default function ListsOverview({ homeId, onOpen }) {
  const [lists, setLists] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('lists')
      .select(`id, name, status, created_at, items(${ITEM_FIELDS})`)
      .eq('home_id', homeId)
      .order('created_at', { ascending: false })
    if (!error) setLists(data)
  }, [homeId])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- initial fetch from Supabase
    load()
  }, [load])

  useRealtime(`lists:${homeId}`, [{ table: 'lists', filter: `home_id=eq.${homeId}` }, { table: 'items' }], load)

  async function createList() {
    setCreating(true)
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const { data, error } = await supabase
      .from('lists')
      .insert({ home_id: homeId, name: `Mercado ${date}` })
      .select('id')
      .single()
    setCreating(false)
    if (error) return alert('Não foi possível criar a lista.')
    onOpen(data.id)
  }

  if (!lists) return <Spinner />

  const open = lists.filter((l) => l.status === 'open')
  const done = lists.filter((l) => l.status === 'done')

  return (
    <main className="mx-auto max-w-md space-y-8 p-5">
      <button onClick={createList} disabled={creating} className={`${primaryButton} w-full`}>
        {creating ? 'Criando…' : '+ Nova lista'}
      </button>

      <ListSection title="Abertas" lists={open} empty="Nenhuma lista aberta." onOpen={onOpen} />
      {done.length > 0 && <ListSection title="Finalizadas" lists={done} onOpen={onOpen} />}
    </main>
  )
}

function ListSection({ title, lists, empty, onOpen }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sapphire-500">{title}</h2>
      {lists.length === 0 ? (
        <p className="text-sapphire-600">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ListCard({ list, onOpen }) {
  const total = list.items.length
  const inCart = list.items.filter((i) => i.status === 'bought').length
  const { planned, cart } = listTotals(list.items)
  const progress = total ? (inCart / total) * 100 : 0
  const date = new Date(list.created_at).toLocaleDateString('pt-BR')

  return (
    <button
      onClick={() => onOpen(list.id)}
      className="w-full rounded-2xl border border-sapphire-100 bg-papaya-50 p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-lg font-semibold">{list.name}</h3>
        <span className="shrink-0 text-xs text-sapphire-500">{date}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sapphire-100">
        <div
          className="h-full rounded-full bg-linear-to-r from-lagoon-500 to-jonquil-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-sapphire-700">
        {inCart} de {total} no carrinho ·{' '}
        {list.status === 'done' ? `Total ${formatMoney(cart)}` : `Previsto ${formatMoney(planned)}`}
      </p>
    </button>
  )
}
