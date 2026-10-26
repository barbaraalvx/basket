// Formatting, parsing and totals. All money math happens in the browser.

export function formatMoney(value) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatNumber(value) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function formatMeasure(value, unit) {
  if (value == null || !unit) return ''
  return `${formatNumber(value)} ${unit}`
}

// "4,50" or "4.50" -> 4.5; "" -> null; garbage -> NaN
export function parseNumber(text) {
  const clean = String(text).trim().replace(',', '.')
  if (clean === '') return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : NaN
}

export function toInput(value) {
  return value == null ? '' : String(value).replace('.', ',')
}

export function boughtQty(item) {
  return item.qty_bought ?? item.qty_wanted
}

// Wholesale price kicks in once the bought quantity reaches the minimum
export function paidPrice(item) {
  const { wholesale_price: wholesale, wholesale_min_qty: min } = item
  if (wholesale != null && min != null && boughtQty(item) >= min) return wholesale
  return item.unit_price
}

export function estimatedSubtotal(item) {
  return item.price_estimated == null ? null : item.qty_wanted * item.price_estimated
}

export function realSubtotal(item) {
  const price = paidPrice(item)
  return price == null ? null : boughtQty(item) * price
}

// g/kg compare per kg, ml/L per L, un per unit
const BASE_UNITS = { g: ['kg', 0.001], kg: ['kg', 1], ml: ['L', 0.001], L: ['L', 1], un: ['un', 1] }

export function pricePerBase(price, measureValue, measureUnit) {
  if (price == null || !measureValue || !BASE_UNITS[measureUnit]) return null
  const [base, factor] = BASE_UNITS[measureUnit]
  return { base, value: price / (measureValue * factor) }
}

export function formatPricePerBase(perBase) {
  return perBase ? `${formatMoney(perBase.value)}/${perBase.base}` : '—'
}

// Ids of the cheapest option per base unit, only where there is something to compare
export function cheapestOptionIds(options) {
  const best = {}
  const counts = {}
  for (const option of options) {
    const perBase = pricePerBase(option.price, option.measure_value, option.measure_unit)
    if (!perBase) continue
    counts[perBase.base] = (counts[perBase.base] ?? 0) + 1
    if (!best[perBase.base] || perBase.value < best[perBase.base].value) {
      best[perBase.base] = { id: option.id, value: perBase.value }
    }
  }
  return new Set(Object.keys(best).filter((base) => counts[base] > 1).map((base) => best[base].id))
}

// Compares a price with the previous purchase. Same size compares pack prices;
// different sizes compare per kg/L/un. Returns null when there's nothing to say.
export function priceChange(current, previous) {
  if (current.price == null || previous?.price == null) return null
  const before = pricePerBase(previous.price, previous.measure_value, previous.measure_unit)
  const now = pricePerBase(current.price, current.measure_value, current.measure_unit)
  const sameSize = previous.measure_value === current.measure_value && previous.measure_unit === current.measure_unit

  let from = previous.price
  let to = current.price
  let suffix = ''
  if (before && now && !sameSize) {
    if (before.base !== now.base) return null
    from = before.value
    to = now.value
    suffix = `/${now.base}`
  }
  if (Math.abs(to - from) < 0.005 || from === 0) return null
  return { from, to, suffix, percent: ((to - from) / from) * 100 }
}

// "setembro" when the months differ, "12/10" within the same month
export function sinceLabel(previousDate, currentDate) {
  const before = new Date(previousDate)
  const now = new Date(currentDate)
  if (before.getMonth() === now.getMonth() && before.getFullYear() === now.getFullYear()) {
    return before.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  const options = before.getFullYear() === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' }
  return before.toLocaleDateString('pt-BR', options)
}

export function wholesaleHint(item) {
  const { wholesale_price: wholesale, wholesale_min_qty: min } = item
  if (wholesale == null || min == null) return null
  if (boughtQty(item) >= min) return `Preço de atacado: ${formatMoney(wholesale)} cada`
  return `Leve ${formatNumber(min)} para pagar ${formatMoney(wholesale)} cada`
}

// planned: whole list at estimated prices
// cart: what is in the cart at real prices
// diff: real minus estimated, only for cart items that have both
export function listTotals(items) {
  let planned = 0
  let cart = 0
  let diff = 0
  for (const item of items) {
    const estimated = estimatedSubtotal(item)
    planned += estimated ?? 0
    if (item.status !== 'bought') continue
    const real = realSubtotal(item)
    cart += real ?? 0
    if (estimated != null && real != null) diff += real - estimated
  }
  return { planned, cart, diff }
}
