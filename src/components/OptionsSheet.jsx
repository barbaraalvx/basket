import { useState } from 'react'
import {
  cheapestOptionIds,
  formatMeasure,
  formatMoney,
  formatPricePerBase,
  parseNumber,
  pricePerBase,
  toInput,
} from '../lib/calc.js'
import { UNITS } from '../lib/catalog.js'
import { supabase } from '../lib/supabase.js'
import { Field, inputBase, inputClass, primaryButton, secondaryButton, Sheet } from './ui.jsx'

const smallButton = 'rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95'

export default function OptionsSheet({ item, onClose, onChanged }) {
  const [editing, setEditing] = useState(null)
  const options = item.options ?? []
  const cheapest = cheapestOptionIds(options)
  const perBase = (o) => pricePerBase(o.price, o.measure_value, o.measure_unit)
  const sorted = [...options].sort((a, b) => (perBase(a)?.value ?? Infinity) - (perBase(b)?.value ?? Infinity))

  async function updateItem(patch) {
    const { error } = await supabase.from('items').update(patch).eq('id', item.id)
    if (error) alert('Não foi possível atualizar o item.')
    onChanged()
  }

  // Choosing an option puts the item in the cart with that option's price and size
  function choose(option) {
    if (item.chosen_option_id === option.id) return updateItem({ chosen_option_id: null })
    return updateItem({
      chosen_option_id: option.id,
      status: 'bought',
      qty_bought: item.qty_bought ?? item.qty_wanted,
      unit_price: option.price,
      real_measure_value: option.measure_value,
      real_measure_unit: option.measure_unit,
    })
  }

  async function remove(option) {
    if (!confirm(`Apagar a opção "${option.brand || 'Sem marca'}"?`)) return
    const { error } = await supabase.from('options').delete().eq('id', option.id)
    if (error) alert('Não foi possível apagar a opção.')
    onChanged()
  }

  return (
    <Sheet title={`Comparar: ${item.name}`} onClose={onClose}>
      {sorted.length === 0 ? (
        <p className="mb-4 text-sapphire-700">
          Nenhuma opção ainda. Cadastre marcas ou tamanhos diferentes para comparar o preço por kg, L ou unidade.
        </p>
      ) : (
        <ul className="mb-5 space-y-3">
          {sorted.map((option) => {
            const chosen = item.chosen_option_id === option.id
            const details = [formatMeasure(option.measure_value, option.measure_unit), formatMoney(option.price)]
            return (
              <li
                key={option.id}
                className={`rounded-2xl p-4 ${chosen ? 'bg-lagoon-50 ring-2 ring-lagoon-400' : 'bg-white ring-1 ring-sapphire-100'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{option.brand || 'Sem marca'}</p>
                    <p className="text-sm text-sapphire-600">{details.filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold tabular-nums">{formatPricePerBase(perBase(option))}</p>
                    {cheapest.has(option.id) && (
                      <span className="inline-block rounded-full bg-jonquil-400 px-2 py-0.5 text-xs font-bold text-sapphire-950">
                        Mais barata
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => choose(option)}
                    className={`${smallButton} flex-1 ${chosen ? 'bg-lagoon-500 text-papaya-50' : 'bg-linear-to-r from-sapphire-500 to-lagoon-500 text-papaya-50'}`}
                  >
                    {chosen ? 'Escolhida ✓' : 'Levar esta'}
                  </button>
                  <button onClick={() => setEditing(option)} className={`${smallButton} bg-sapphire-50 text-sapphire-700`}>
                    Editar
                  </button>
                  <button onClick={() => remove(option)} className={`${smallButton} bg-cherry-50 text-cherry-600`}>
                    Apagar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <OptionForm
        key={editing?.id ?? 'new'}
        item={item}
        option={editing}
        onDone={() => {
          setEditing(null)
          onChanged()
        }}
        onCancel={() => setEditing(null)}
      />
    </Sheet>
  )
}

function OptionForm({ item, option, onDone, onCancel }) {
  const [brand, setBrand] = useState(option?.brand ?? '')
  const [measureValue, setMeasureValue] = useState(toInput(option?.measure_value ?? item.measure_value))
  const [measureUnit, setMeasureUnit] = useState(option?.measure_unit ?? item.measure_unit ?? 'un')
  const [price, setPrice] = useState(toInput(option?.price))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    const value = parseNumber(measureValue)
    const priceNumber = parseNumber(price)
    if (priceNumber == null || Number.isNaN(priceNumber) || priceNumber < 0) return setError('Informe o preço.')
    if (Number.isNaN(value) || (value != null && value <= 0)) return setError('Confira a medida.')

    const row = {
      brand: brand.trim() || null,
      measure_value: value,
      measure_unit: value == null ? null : measureUnit,
      price: priceNumber,
    }
    setSaving(true)
    const { error } = option
      ? await supabase.from('options').update(row).eq('id', option.id)
      : await supabase.from('options').insert({ ...row, item_id: item.id })
    // Keep the cart in sync when the chosen option changes
    if (!error && option && item.chosen_option_id === option.id) {
      await supabase
        .from('items')
        .update({ unit_price: row.price, real_measure_value: row.measure_value, real_measure_unit: row.measure_unit })
        .eq('id', item.id)
    }
    setSaving(false)
    if (error) return setError('Não foi possível salvar. Tente de novo.')
    if (!option) {
      setBrand('')
      setPrice('')
    }
    onDone()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-2xl bg-sapphire-50/60 p-4 ring-1 ring-sapphire-100">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sapphire-500">
        {option ? 'Editar opção' : 'Nova opção'}
      </p>
      <Field label="Marca">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opcional" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Medida">
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={measureValue}
              onChange={(e) => setMeasureValue(e.target.value)}
              placeholder="Ex.: 500"
              className={inputClass}
            />
            <select
              value={measureUnit}
              onChange={(e) => setMeasureUnit(e.target.value)}
              className={`${inputBase} w-16 shrink-0 px-1`}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Preço (R$)">
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex.: 8,90"
            className={inputClass}
          />
        </Field>
      </div>
      {error && <p className="text-sm font-medium text-cherry-600">{error}</p>}
      <button disabled={saving} className={primaryButton}>
        {saving ? 'Salvando…' : option ? 'Salvar opção' : 'Adicionar opção'}
      </button>
      {option && (
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
      )}
    </form>
  )
}
