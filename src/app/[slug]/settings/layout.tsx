import { Plug } from 'lucide-react'
import { NavGroup, NavLink, SidebarLayout } from '@/components/sidebar-layout'

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <SidebarLayout
      title="Settings"
      sidebar={
        <NavGroup label="Workspace">
          <NavLink href={`/${slug}/settings/integrations`} icon={<Plug className="size-4" />}>
            Integrations
          </NavLink>
        </NavGroup>
      }
    >
      {children}
    </SidebarLayout>
  )
}
