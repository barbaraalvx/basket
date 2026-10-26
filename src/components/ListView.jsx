import { useCallback, useEffect, useState } from 'react'
import {
  boughtQty,
  estimatedSubtotal,
  formatMeasure,
  formatMoney,
  formatNumber,
  listTotals,
  paidPrice,
  priceChange,
  realSubtotal,
  sinceLabel,
  wholesaleHint,
} from '../lib/calc.js'
import { CATEGORIES, categoryOf, normalizeName } from '../lib/catalog.js'
import { getPreference, setPreference } from '../lib/storage.js'
import { supabase } from '../lib/supabase.js'
import { useRealtime } from '../lib/useRealtime.js'
import ItemSheet from './ItemSheet.jsx'
import OptionsSheet from './OptionsSheet.jsx'
import { dangerButton, secondaryButton, Sheet, Spinner, TextSheet } from './ui.jsx'

const HISTORY_FIELDS =
  'name, category, measure_value, measure_unit, real_measure_value, real_measure_unit, qty_wanted, qty_bought, unit_price, wholesale_price, wholesale_min_qty, created_at, lists!inner(home_id, created_at)'

// Size actually bought, falling back to what was planned
const boughtMeasure = (item) =>
  item.real_measure_value != null
    ? { measure_value: item.real_measure_value, measure_unit: item.real_measure_unit }
    : { measure_value: item.measure_value, measure_unit: item.measure_unit }

export default function ListView({ homeId, listId, onBack, onOpen }) {
  const [list, setList] = useState(undefined) // null once deleted
  const [items, setItems] = useState([])
  const [history, setHistory] = useState(new Map())
  const [tab, setTab] = useState('pending')
  const [category, setCategory] = useState(null)
  const [grouped, setGrouped] = useState(() => getPreference('grouped', 'yes') === 'yes')
  const [editing, setEditing] = useState(null) // item, {} for a new one, or null
  const [comparingId, setComparingId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const load = useCallback(async () => {
    const [listRes, itemsRes] = await Promise.all([
      supabase.from('lists').select('id, name, status, created_at').eq('id', listId).maybeSingle(),
      supabase
        .from('items')
        .select('*, options!options_item_id_fkey(*)')
        .eq('list_id', listId)
        .order('created_at')
        .order('created_at', { referencedTable: 'options' }),
    ])
    if (!listRes.error) setList(listRes.data)
    if (!itemsRes.error) setItems(itemsRes.data)
  }, [listId])

  // Last bought version of each product in the home's lists created before this one
  const loadHistory = useCallback(async () => {
    const { data: current } = await supabase.from('lists').select('created_at').eq('id', listId).maybeSingle()
    if (!current) return
    const { data, error } = await supabase
      .from('items')
      .select(HISTORY_FIELDS)
      .eq('lists.home_id', homeId)
      .lt('lists.created_at', current.created_at)
      .eq('status', 'bought')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) return
    const map = new Map()
    for (const item of data) {
      const key = normalizeName(item.name)
      if (map.has(key)) continue
      map.set(key, {
        name: item.name.trim(),
        category: item.category,
        ...boughtMeasure(item),
        price: paidPrice(item),
        listDate: item.lists.created_at,
        date: new Date(item.lists.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      })
    }
    setHistory(map)
  }, [homeId, listId])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- initial fetch from Supabase
    load()
    loadHistory()
  }, [load, loadHistory])

  useRealtime(
    `list:${listId}`,
    [
      { table: 'items', filter: `list_id=eq.${listId}` },
      { table: 'lists', filter: `id=eq.${listId}` },
      { table: 'options' },
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

  // New list with the same items, priced at what was paid most recently
  async function copyList() {
    setMenuOpen(false)
    const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const { data: newList, error } = await supabase
      .from('lists')
      .insert({ home_id: homeId, name: `Mercado ${date}` })
      .select('id')
      .single()
    if (error) return alert('Não foi possível criar a lista.')

    // Bought items carry over what was actually bought; the rest use history
    const rows = items.map((i) => {
      const last = i.status === 'bought' ? { ...boughtMeasure(i), price: paidPrice(i) } : history.get(normalizeName(i.name))
      const useLast = last?.price != null
      return {
        list_id: newList.id,
        name: i.name,
        category: i.category,
        measure_value: useLast ? last.measure_value : i.measure_value,
        measure_unit: useLast ? last.measure_unit : i.measure_unit,
        qty_wanted: i.qty_wanted,
        price_estimated: useLast ? last.price : i.price_estimated,
        wholesale_price: i.wholesale_price,
        wholesale_min_qty: i.wholesale_min_qty,
      }
    })
    if (rows.length) {
      const { error: itemsError } = await supabase.from('items').insert(rows)
      if (itemsError) alert('A lista foi criada, mas nem todos os itens foram copiados.')
    }
    onOpen(newList.id)
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
  const present = CATEGORIES.filter((c) => visible.some((i) => categoryOf(i) === c))
  const activeCategory = present.includes(category) ? category : null
  // Grouped: one section per category (optionally filtered). Flat: one untitled section.
  const groups = grouped
    ? present
        .filter((c) => !activeCategory || c === activeCategory)
        .map((c) => [c, visible.filter((i) => categoryOf(i) === c)])
    : visible.length
      ? [[null, visible]]
      : []
  const comparing = items.find((i) => i.id === comparingId)

  function toggleGrouped() {
    setGrouped(!grouped)
    setPreference('grouped', grouped ? 'no' : 'yes')
  }

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

        {visible.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button onClick={toggleGrouped} className="text-sm font-semibold text-lagoon-700">
              {grouped ? '☰ Ver tudo junto' : '▦ Separar por categoria'}
            </button>
          </div>
        )}

        {grouped && present.length > 1 && (
          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            <CategoryChip active={!activeCategory} onClick={() => setCategory(null)}>
              Todas
            </CategoryChip>
            {present.map((c) => (
              <CategoryChip key={c} active={activeCategory === c} onClick={() => setCategory(c)}>
                {c}
              </CategoryChip>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          <p className="mt-8 text-center text-sapphire-600">
            {tab === 'pending'
              ? items.length
                ? 'Tudo no carrinho! 🎉'
                : 'Nenhum item ainda. Toque em “+ Item” para começar.'
              : 'Nada no carrinho ainda.'}
          </p>
        ) : (
          groups.map(([group, groupItems]) => (
            <section key={group ?? 'all'} className={group ? 'mt-6' : 'mt-4'}>
              {group && (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sapphire-500">{group}</h3>
              )}
              <ul className="space-y-2">
                {groupItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    previous={history.get(normalizeName(item.name))}
                    listDate={list.created_at}
                    onToggle={() => toggle(item)}
                    onEdit={() => setEditing(item)}
                    onCompare={() => setComparingId(item.id)}
                  />
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
        <ItemSheet
          item={editing}
          listId={listId}
          history={history}
          onClose={() => setEditing(null)}
          onSaved={load}
          onCompare={() => {
            setComparingId(editing.id)
            setEditing(null)
          }}
        />
      )}

      {comparing && <OptionsSheet item={comparing} onClose={() => setComparingId(null)} onChanged={load} />}

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
            <button onClick={copyList} className={secondaryButton}>
              Usar como base para nova lista
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

function CategoryChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? 'bg-sapphire-500 text-papaya-50 shadow-md shadow-sapphire-500/30'
          : 'bg-papaya-50 text-sapphire-600 ring-1 ring-sapphire-100'
      }`}
    >
      {children}
    </button>
  )
}

function PriceChange({ item, previous, listDate }) {
  const bought = item.status === 'bought'
  // In the cart: what was paid. Pending: the shelf price, if someone wrote it down.
  const current = bought
    ? {
        price: paidPrice(item),
        measure_value: item.real_measure_value ?? item.measure_value,
        measure_unit: item.real_measure_unit ?? item.measure_unit,
      }
    : { price: item.unit_price, measure_value: item.measure_value, measure_unit: item.measure_unit }
  const change = priceChange(current, previous)
  if (!change) return null

  const up = change.to > change.from
  const percent = Math.abs(change.percent).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return (
    <p className={`text-xs font-semibold ${up ? 'text-cherry-600' : 'text-lagoon-700'}`}>
      {up ? '↑ Subiu' : '↓ Caiu'} {percent}% desde {sinceLabel(previous.listDate, listDate)} (
      {formatMoney(change.from)}
      {change.suffix} → {formatMoney(change.to)}
      {change.suffix})
    </p>
  )
}

function ItemRow({ item, previous, listDate, onToggle, onEdit, onCompare }) {
  const bought = item.status === 'bought'
  const qty = bought ? boughtQty(item) : item.qty_wanted
  const measure = bought
    ? formatMeasure(item.real_measure_value ?? item.measure_value, item.real_measure_unit ?? item.measure_unit)
    : formatMeasure(item.measure_value, item.measure_unit)
  const price = bought ? paidPrice(item) : item.price_estimated
  const subtotal = bought ? realSubtotal(item) : estimatedSubtotal(item)
  const hint = wholesaleHint(item)
  const details = [`${formatNumber(qty)}×`, measure, price != null && `${formatMoney(price)} cada`].filter(Boolean)
  const options = item.options ?? []
  const chosen = options.find((o) => o.id === item.chosen_option_id)

  return (
    <li className="rounded-2xl bg-papaya-50 p-3 shadow-sm ring-1 ring-sapphire-100">
      <div className="flex items-center gap-3">
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
            <PriceChange item={item} previous={previous} listDate={listDate} />
          </div>
          <span className="shrink-0 font-semibold tabular-nums">{formatMoney(subtotal)}</span>
        </button>
      </div>
      {options.length > 0 && (
        <button
          onClick={onCompare}
          className="mt-2 ml-12 rounded-full bg-lagoon-50 px-3 py-1 text-xs font-semibold text-lagoon-700 ring-1 ring-lagoon-200"
        >
          {options.length} {options.length === 1 ? 'opção' : 'opções'}
          {chosen && ` · escolhida: ${chosen.brand || 'sem marca'}`}
        </button>
      )}
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
