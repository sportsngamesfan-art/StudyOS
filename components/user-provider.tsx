'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

const UserContext = createContext<User | null>(null)

/**
 * Provided by the dashboard layout once its auth gate has resolved, so pages
 * can read the signed-in user synchronously instead of each calling
 * `supabase.auth.getUser()` in every loader and handler.
 */
export function UserProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser(): User {
  const user = useContext(UserContext)
  if (!user) {
    throw new Error('useUser must be used inside the dashboard layout, after auth has resolved')
  }
  return user
}
