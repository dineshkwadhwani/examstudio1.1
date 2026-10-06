import { redirect } from 'next/navigation'
import Ca1Shell from '@/components/sa/Ca1Shell'
import { getSession } from '@/lib/session'

export default async function Ca1Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || session.type !== 'staff' || session.role !== 'sa') redirect('/sa/login')
  return <Ca1Shell>{children}</Ca1Shell>
}
