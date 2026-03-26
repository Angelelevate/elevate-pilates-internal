import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { api } from '../services/api.js'
import { getFirebaseAuth } from '../config/firebase.js'

const AuthContext = createContext(null)

async function fetchRoleFromToken(user) {
  if (!user) return { role: null, profile: null }
  const tokenResult = await user.getIdTokenResult(true)
  const role = tokenResult.claims.role || null
  try {
    const { data } = await api.post('/api/auth/verify-token')
    return { role: data.role || role, profile: data.profile }
  } catch {
    return { role, profile: null }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getFirebaseAuth()))

  const refreshClaims = useCallback(async (nextUser) => {
    const u = nextUser ?? getFirebaseAuth()?.currentUser
    if (!u) {
      setRole(null)
      setProfile(null)
      return { role: null, profile: null }
    }
    const { role: r, profile: p } = await fetchRoleFromToken(u)
    setRole(r)
    setProfile(p)
    return { role: r, profile: p }
  }, [])

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      return undefined
    }

    const unsub = auth.onAuthStateChanged(async (next) => {
      setUser(next)
      if (next) await refreshClaims(next)
      else {
        setRole(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [refreshClaims])

  const login = useCallback(
    async (email, password) => {
      const auth = getFirebaseAuth()
      if (!auth) throw new Error('Firebase Auth is not configured')
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await refreshClaims(cred.user)
      return cred.user
    },
    [refreshClaims],
  )

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth()
    try {
      if (auth?.currentUser) await firebaseSignOut(auth)
    } catch {
      // Still clear local session (e.g. expired token / bad request during transitional states).
    }
    setUser(null)
    setRole(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      role,
      profile,
      loading,
      login,
      signOut,
      refreshClaims,
    }),
    [user, role, profile, loading, login, signOut, refreshClaims],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
