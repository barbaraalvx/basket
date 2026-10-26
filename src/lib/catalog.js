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
