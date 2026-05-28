'use client'

import { PropsWithChildren, createContext, useContext } from 'react'

const SlackConfigContext = createContext<boolean>(false)

export function useSlackEnabled() {
  return useContext(SlackConfigContext)
}

export function SlackConfigProvider({
  enabled,
  children,
}: PropsWithChildren<{ enabled: boolean }>) {
  return (
    <SlackConfigContext.Provider value={enabled}>
      {children}
    </SlackConfigContext.Provider>
  )
}
