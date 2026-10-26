export const CATEGORIES = [
  'Hortifruti',
  'Carnes',
  'Laticínios',
  'Padaria',
  'Mercearia',
  'Bebidas',
  'Limpeza',
  'Higiene',
  'Congelados',
  'Outros',
]

export const UNITS = ['g', 'kg', 'ml', 'L', 'un']

export function categoryOf(item) {
  return CATEGORIES.includes(item.category) ? item.category : 'Outros'
}

// Key for matching items across lists: "Leite Integral " -> "leite integral"
export function normalizeName(name) {
  return name.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}
