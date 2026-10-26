import { useEffect } from 'react'

export const inputBase =
  'min-w-0 rounded-xl border border-sapphire-100 bg-white px-3 py-2.5 text-base text-sapphire-950 outline-none transition focus:border-lagoon-500 focus:ring-2 focus:ring-lagoon-500/30'

export const inputClass = `w-full ${inputBase}`

export const primaryButton =
  'rounded-2xl bg-linear-to-r from-sapphire-500 to-lagoon-500 px-5 py-3 font-semibold text-papaya-50 shadow-lg shadow-lagoon-500/30 transition active:scale-[0.98] disabled:opacity-60'

export const secondaryButton =
  'rounded-2xl bg-sapphire-50 px-5 py-3 font-semibold text-sapphire-700 ring-1 ring-sapphire-100 transition active:scale-[0.98]'

export const dangerButton =
  'rounded-2xl bg-cherry-50 px-5 py-3 font-semibold text-cherry-600 ring-1 ring-cherry-100 transition active:scale-[0.98]'

export function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm font-medium text-sapphire-700">{label}</span>
      {children}
    </label>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center p-10">
      <div className="size-10 animate-spin rounded-full border-4 border-lagoon-200 border-t-sapphire-500" />
    </div>
  )
}

// Bottom sheet: slides over the page, closes on backdrop tap or Escape
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-sapphire-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-papaya-50 p-5 pb-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-full text-sapphire-500 transition hover:bg-sapphire-50"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Small sheet with one text field, used for renaming
export function TextSheet({ title, label, initial, onSave, onClose }) {
  async function submit(e) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('value').trim()
    if (!value) return
    try {
      await onSave(value)
      onClose()
    } catch {
      alert('Não foi possível salvar. Tente de novo.')
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={label}>
          <input name="value" defaultValue={initial} autoFocus className={inputClass} />
        </Field>
        <button className={primaryButton}>Salvar</button>
      </form>
    </Sheet>
  )
}
