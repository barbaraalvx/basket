// Per-phone preferences kept in localStorage

export function getPreference(key, fallback) {
  try {
    return localStorage.getItem(`basket:${key}`) ?? fallback
  } catch {
    return fallback
  }
}

export function setPreference(key, value) {
  try {
    localStorage.setItem(`basket:${key}`, value)
  } catch {
    // Storage unavailable (private mode); the default is used next time.
  }
}

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
