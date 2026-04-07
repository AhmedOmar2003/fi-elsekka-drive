export type StoredGroupParticipant = {
  participantKey: string
  displayName: string
}

const GROUP_ORDER_SESSION_KEY = "fi-elsekka-group-order-participants"

function readStore(): Record<string, StoredGroupParticipant> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GROUP_ORDER_SESSION_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(value: Record<string, StoredGroupParticipant>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GROUP_ORDER_SESSION_KEY, JSON.stringify(value))
}

export function getStoredGroupParticipant(code: string): StoredGroupParticipant | null {
  const normalizedCode = String(code || "").trim().toUpperCase()
  if (!normalizedCode) return null
  const store = readStore()
  return store[normalizedCode] || null
}

export function saveStoredGroupParticipant(code: string, participant: StoredGroupParticipant) {
  const normalizedCode = String(code || "").trim().toUpperCase()
  if (!normalizedCode) return
  const store = readStore()
  store[normalizedCode] = participant
  writeStore(store)
}

export function clearStoredGroupParticipant(code: string) {
  const normalizedCode = String(code || "").trim().toUpperCase()
  const store = readStore()
  delete store[normalizedCode]
  writeStore(store)
}
