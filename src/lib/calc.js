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
