import { useCallback, useEffect, useState } from 'react'
import {
  boughtQty,
  estimatedSubtotal,
  formatMeasure,
  formatMoney,
  formatNumber,
  listTotals,
  paidPrice,
  realSubtotal,
  wholesaleHint,
} from '../lib/calc.js'
import { CATEGORIES, categoryOf } from '../lib/catalog.js'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from '../lib/useRealtime.js'
import ItemSheet from './ItemSheet.jsx'
import { dangerButton, secondaryButton, Sheet, Spinner, TextSheet } from './ui.jsx'

export default function ListView({ listId, onBack }) {
  const [list, setList] = useState(undefined) // null once deleted
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('pending')
  const [editing, setEditing] = useState(null) // item, {} for a new one, or null
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const load = useCallback(async () => {
    const [listRes, itemsRes] = await Promise.all([
      supabase.from('lists').select('id, name, status').eq('id', listId).maybeSingle(),
      supabase.from('items').select('*').eq('list_id', listId).order('created_at'),
    ])
    if (!listRes.error) setList(listRes.data)
    if (!itemsRes.error) setItems(itemsRes.data)
  }, [listId])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- initial fetch from Supabase
    load()
  }, [load])

  useRealtime(
    `list:${listId}`,
    [
      { table: 'items', filter: `list_id=eq.${listId}` },
      { table: 'lists', filter: `id=eq.${listId}` },
    ],
    load,
  )

  async function toggle(item) {
    // When checking, assume what was planned until someone edits the real values
    const patch =
      item.status === 'bought'
        ? { status: 'pending' }
        : {
            status: 'bought',
            qty_bought: item.qty_bought ?? item.qty_wanted,
            unit_price: item.unit_price ?? item.price_estimated,
            real_measure_value: item.real_measure_value ?? item.measure_value,
            real_measure_unit: item.real_measure_unit ?? item.measure_unit,
          }
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
    const { error } = await supabase.from('items').update(patch).eq('id', item.id)
    if (error) {
      alert('Não foi possível atualizar o item.')
      load()
    }
  }

  async function updateList(patch) {
    const { error } = await supabase.from('lists').update(patch).eq('id', listId)
    if (error) throw error
    load()
  }

  async function deleteList() {
    if (!confirm(`Apagar a lista "${list.name}" e todos os itens?`)) return
    const { error } = await supabase.from('lists').delete().eq('id', listId)
    if (error) return alert('Não foi possível apagar a lista.')
    onBack()
  }

  if (list === undefined) return <Spinner />

  if (list === null) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-5">
        <p className="text-sapphire-700">Esta lista foi apagada.</p>
        <button onClick={onBack} className={secondaryButton}>
          Voltar às listas
        </button>
      </main>
    )
  }

  const pending = items.filter((i) => i.status !== 'bought')
  const bought = items.filter((i) => i.status === 'bought')
  const visible = tab === 'pending' ? pending : bought
  const groups = CATEGORIES.map((c) => [c, visible.filter((i) => categoryOf(i) === c)]).filter(
    ([, group]) => group.length > 0,
  )

  return (
    <>
      <main className="mx-auto max-w-md p-5 pb-48">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Voltar às listas"
            className="grid size-10 shrink-0 place-items-center rounded-full text-xl text-sapphire-600 transition hover:bg-sapphire-50"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold">{list.name}</h2>
            {list.status === 'done' && (
              <span className="text-xs font-semibold uppercase tracking-wider text-lagoon-600">Finalizada</span>
            )}
          </div>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Opções da lista"
            className="grid size-10 shrink-0 place-items-center rounded-full text-xl text-sapphire-600 transition hover:bg-sapphire-50"
          >
            ⋯
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-sapphire-50 p-1 ring-1 ring-sapphire-100">
          <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
            Pendentes ({pending.length})
          </TabButton>
          <TabButton active={tab === 'bought'} onClick={() => setTab('bought')}>
            No carrinho ({bought.length})
          </TabButton>
        </div>

        {groups.length === 0 ? (
          <p className="mt-8 text-center text-sapphire-600">
            {tab === 'pending'
              ? items.length
                ? 'Tudo no carrinho! 🎉'
                : 'Nenhum item ainda. Toque em “+ Item” para começar.'
              : 'Nada no carrinho ainda.'}
          </p>
        ) : (
          groups.map(([category, group]) => (
            <section key={category} className="mt-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sapphire-500">{category}</h3>
              <ul className="space-y-2">
                {group.map((item) => (
                  <ItemRow key={item.id} item={item} onToggle={() => toggle(item)} onEdit={() => setEditing(item)} />
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30">
        <div className="mx-auto flex max-w-md justify-end px-5">
          <button
            onClick={() => setEditing({})}
            className="pointer-events-auto rounded-full bg-linear-to-r from-sapphire-500 to-lagoon-500 px-6 py-4 text-lg font-semibold text-papaya-50 shadow-xl shadow-lagoon-500/40 transition active:scale-95"
          >
            + Item
          </button>
        </div>
      </div>

      <TotalsBar items={items} />

      {editing && (
        <ItemSheet item={editing} listId={listId} onClose={() => setEditing(null)} onSaved={load} />
      )}

      {menuOpen && (
        <Sheet title={list.name} onClose={() => setMenuOpen(false)}>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setMenuOpen(false)
                setRenaming(true)
              }}
              className={secondaryButton}
            >
              Renomear lista
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                updateList({ status: list.status === 'done' ? 'open' : 'done' }).catch(() =>
                  alert('Não foi possível atualizar a lista.'),
                )
              }}
              className={secondaryButton}
            >
              {list.status === 'done' ? 'Reabrir lista' : 'Finalizar lista'}
            </button>
            <button onClick={deleteList} className={dangerButton}>
              Apagar lista
            </button>
          </div>
        </Sheet>
      )}

      {renaming && (
        <TextSheet
          title="Renomear lista"
          label="Nome"
          initial={list.name}
          onSave={(name) => updateList({ name })}
          onClose={() => setRenaming(false)}
        />
      )}
    </>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-papaya-50 text-sapphire-700 shadow-sm' : 'text-sapphire-500'
      }`}
    >
      {children}
    </button>
  )
}

function ItemRow({ item, onToggle, onEdit }) {
  const bought = item.status === 'bought'
  const qty = bought ? boughtQty(item) : item.qty_wanted
  const measure = bought
    ? formatMeasure(item.real_measure_value ?? item.measure_value, item.real_measure_unit ?? item.measure_unit)
    : formatMeasure(item.measure_value, item.measure_unit)
  const price = bought ? paidPrice(item) : item.price_estimated
  const subtotal = bought ? realSubtotal(item) : estimatedSubtotal(item)
  const hint = wholesaleHint(item)
  const details = [`${formatNumber(qty)}×`, measure, price != null && `${formatMoney(price)} cada`].filter(Boolean)

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-papaya-50 p-3 shadow-sm ring-1 ring-sapphire-100">
      <button
        onClick={onToggle}
        aria-label={bought ? 'Tirar do carrinho' : 'Colocar no carrinho'}
        className={`grid size-9 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
          bought ? 'border-lagoon-500 bg-lagoon-500 text-papaya-50' : 'border-sapphire-200 bg-white'
        }`}
      >
        {bought && (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L19 7" />
          </svg>
        )}
      </button>
      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="text-sm text-sapphire-600">{details.join(' · ')}</p>
          {hint && <p className="text-xs font-semibold text-jonquil-800">{hint}</p>}
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{formatMoney(subtotal)}</span>
      </button>
    </li>
  )
}

function TotalsBar({ items }) {
  const { planned, cart, diff } = listTotals(items)
  const rounded = Math.round(diff * 100) / 100

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sapphire-100 bg-papaya-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sapphire-500">Previsto</p>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(planned)}</p>
        </div>
        <div className="rounded-2xl bg-jonquil-400 px-4 py-2 text-right text-sapphire-950 shadow-lg shadow-jonquil-500/30">
          <p className="text-xs font-semibold uppercase tracking-wider">No carrinho</p>
          <p className="text-2xl font-bold tabular-nums">{formatMoney(cart)}</p>
          {rounded !== 0 && (
            <p className={`text-xs font-semibold ${rounded > 0 ? 'text-cherry-700' : 'text-sapphire-700'}`}>
              {rounded > 0 ? '+' : '−'}
              {formatMoney(Math.abs(rounded))} vs previsto
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
