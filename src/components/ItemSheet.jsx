import { useState } from 'react'
import { formatMoney, parseNumber, toInput } from '../lib/calc.js'
import { CATEGORIES, normalizeName, UNITS } from '../lib/catalog.js'
import { supabase } from '../lib/supabase.js'
import { dangerButton, Field, inputBase, inputClass, primaryButton, secondaryButton, Sheet } from './ui.jsx'

const NUMBER_FIELDS = [
  'qty_wanted',
  'measure_value',
  'price_estimated',
  'unit_price',
  'wholesale_price',
  'wholesale_min_qty',
  'qty_bought',
  'real_measure_value',
]

// history: Map of normalized name -> last bought item from other lists (see ListView)
export default function ItemSheet({ item, listId, history, onClose, onSaved, onCompare }) {
  const isNew = !item.id
  const bought = item.status === 'bought'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(() => ({
    name: item.name ?? '',
    category: item.category ?? 'Outros',
    measure_unit: item.measure_unit ?? 'un',
    real_measure_unit: item.real_measure_unit ?? item.measure_unit ?? 'un',
    ...Object.fromEntries(NUMBER_FIELDS.map((key) => [key, toInput(item[key])])),
    qty_wanted: toInput(item.qty_wanted ?? 1),
  }))

  const bind = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })
  const numberInput = (key, placeholder) => (
    <input inputMode="decimal" placeholder={placeholder} className={inputClass} {...bind(key)} />
  )
  const last = history.get(normalizeName(form.name))

  // Picking a name used before fills in the blanks with what was bought last time
  function changeName(e) {
    const name = e.target.value
    const previous = isNew && history.get(normalizeName(name))
    setForm((f) => {
      if (!previous) return { ...f, name }
      return {
        ...f,
        name,
        category: previous.category ?? f.category,
        measure_value: f.measure_value || toInput(previous.measure_value),
        measure_unit: f.measure_value ? f.measure_unit : (previous.measure_unit ?? f.measure_unit),
        price_estimated: f.price_estimated || toInput(previous.price),
      }
    })
  }

  const unitSelect = (key) => (
    <select className={`${inputBase} w-20 shrink-0 px-2`} {...bind(key)}>
      {UNITS.map((u) => (
        <option key={u}>{u}</option>
      ))}
    </select>
  )

  function validate() {
    const name = form.name.trim()
    if (!name) return 'Informe o nome do item.'

    const n = {}
    for (const key of NUMBER_FIELDS) {
      n[key] = parseNumber(form[key])
      if (Number.isNaN(n[key]) || n[key] < 0) return 'Confira os números: use só algarismos e vírgula.'
    }
    if (!n.qty_wanted) return 'A quantidade precisa ser maior que zero.'
    if (n.measure_value === 0 || n.real_measure_value === 0 || n.qty_bought === 0 || n.wholesale_min_qty === 0) {
      return 'Medidas e quantidades precisam ser maiores que zero.'
    }
    if ((n.wholesale_price == null) !== (n.wholesale_min_qty == null)) {
      return 'Para o atacado, preencha o preço e a quantidade mínima.'
    }

    const row = {
      name,
      category: form.category,
      qty_wanted: n.qty_wanted,
      measure_value: n.measure_value,
      measure_unit: n.measure_value == null ? null : form.measure_unit,
      price_estimated: n.price_estimated,
      unit_price: n.unit_price,
      wholesale_price: n.wholesale_price,
      wholesale_min_qty: n.wholesale_min_qty,
    }
    if (bought) {
      row.qty_bought = n.qty_bought
      row.real_measure_value = n.real_measure_value
      row.real_measure_unit = n.real_measure_value == null ? null : form.real_measure_unit
    }
    return row
  }

  async function save(e) {
    e.preventDefault()
    const row = validate()
    if (typeof row === 'string') return setError(row)

    setSaving(true)
    const { error } = isNew
      ? await supabase.from('items').insert({ ...row, list_id: listId })
      : await supabase.from('items').update(row).eq('id', item.id)
    setSaving(false)
    if (error) return setError('Não foi possível salvar. Tente de novo.')
    onSaved()
    onClose()
  }

  async function remove() {
    if (!confirm(`Apagar "${item.name}"?`)) return
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) return setError('Não foi possível apagar. Tente de novo.')
    onSaved()
    onClose()
  }

  return (
    <Sheet title={isNew ? 'Novo item' : 'Editar item'} onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Nome">
          <input
            autoFocus={isNew}
            placeholder="Ex.: Leite integral"
            list="history-names"
            className={inputClass}
            value={form.name}
            onChange={changeName}
          />
          <datalist id="history-names">
            {[...history.values()].map((h) => (
              <option key={h.name} value={h.name} />
            ))}
          </datalist>
          {last?.price != null && (
            <span className="text-sm text-lagoon-700">
              Último preço pago: {formatMoney(last.price)} em {last.date}
            </span>
          )}
        </Field>

        <Field label="Categoria">
          <select className={inputClass} {...bind('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-[1fr_1.6fr] gap-3">
          <Field label="Quantidade">{numberInput('qty_wanted', '1')}</Field>
          <Field label="Medida">
            <div className="flex gap-2">
              {numberInput('measure_value', 'Ex.: 2')}
              {unitSelect('measure_unit')}
            </div>
          </Field>
        </div>

        <Field label="Preço previsto (R$ por unidade)">{numberInput('price_estimated', 'Opcional')}</Field>

        <fieldset className="flex flex-col gap-4 rounded-2xl bg-sapphire-50/60 p-4 ring-1 ring-sapphire-100">
          <legend className="px-1 text-xs font-semibold uppercase tracking-[0.2em] text-sapphire-500">
            No mercado
          </legend>

          <Field label="Preço na prateleira (R$ por unidade)">{numberInput('unit_price', 'Opcional')}</Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Atacado (R$ cada)">{numberInput('wholesale_price', 'Opcional')}</Field>
            <Field label="A partir de (un.)">{numberInput('wholesale_min_qty', 'Ex.: 3')}</Field>
          </div>

          {bought && (
            <div className="grid grid-cols-[1fr_1.6fr] gap-3">
              <Field label="Qtd. comprada">{numberInput('qty_bought', '1')}</Field>
              <Field label="Medida real">
                <div className="flex gap-2">
                  {numberInput('real_measure_value', 'Ex.: 2')}
                  {unitSelect('real_measure_unit')}
                </div>
              </Field>
            </div>
          )}
        </fieldset>

        {error && <p className="text-sm font-medium text-cherry-600">{error}</p>}

        <button disabled={saving} className={primaryButton}>
          {saving ? 'Salvando…' : isNew ? 'Adicionar' : 'Salvar'}
        </button>
        {!isNew && (
          <button type="button" onClick={onCompare} className={secondaryButton}>
            Comparar opções{item.options?.length ? ` (${item.options.length})` : ''}
          </button>
        )}
        {!isNew && (
          <button type="button" onClick={remove} className={dangerButton}>
            Apagar item
          </button>
        )}
      </form>
    </Sheet>
  )
}
