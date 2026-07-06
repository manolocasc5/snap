import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../types'

interface AuthState {
  token: string | null
  user: User | null
}

interface AuthContextValue extends AuthState {
  saveAuth: (token: string, user: User) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('token')
    const userJson = localStorage.getItem('user')
    return {
      token,
      user: userJson ? JSON.parse(userJson) as User : null,
    }
  })

  function saveAuth(token: string, user: User) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setState({ token, user })
  }

  function clearAuth() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setState({ token: null, user: null })
  }

  return (
    <AuthContext.Provider value={{ ...state, saveAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
