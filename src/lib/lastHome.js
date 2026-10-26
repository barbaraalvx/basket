// Remembers the last home opened on this phone, so "/" can jump straight to it.
const KEY = 'basket:lastHome'

export function getLastHome() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLastHome(code) {
  try {
    localStorage.setItem(KEY, code)
  } catch {
    // Storage unavailable (private mode); the link still works.
  }
}

export function clearLastHome() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Same as above.
  }
}
