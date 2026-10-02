import { OrganizationUser } from '@/lib/users'
import { PropsWithChildren, createContext, useContext } from 'react'

const UsersContext = createContext<OrganizationUser[] | null>(null)

export function useOrganizationUsers() {
  const users = useContext(UsersContext)

  if (!users) throw new Error('Missing context')

  return users
}

/** One member by Clerk user id, or undefined when the id names nobody here. */
export function useMember(userId: string | null | undefined): OrganizationUser | undefined {
  const users = useOrganizationUsers()
  return userId ? users.find((u) => u.userId === userId) : undefined
}

export function OrganizationUsersProvider({
  organizationUsers,
  children,
}: PropsWithChildren<{ organizationUsers: OrganizationUser[] }>) {
  return (
    <UsersContext.Provider value={organizationUsers}>
      {children}
    </UsersContext.Provider>
  )
}
