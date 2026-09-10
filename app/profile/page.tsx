import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/student/PageHeader'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session || session.type !== 'student') redirect('/login')
  const { data: student, error } = await db.from('ca1_students')
    .select('name, prn, email, phone, registered_at').eq('id', session.id).single()

  return <>
    <PageHeader title="My profile" />
    <main className="mx-auto max-w-4xl px-4 py-6">
      {error || !student ? <p role="alert" className="card text-red-700">Could not load your profile. Refresh to try again.</p> :
        <dl className="card grid gap-5 sm:grid-cols-2">
          {Object.entries({ Name: student.name, PRN: student.prn, Email: student.email, Phone: student.phone }).map(([label, value]) =>
            <div key={label}><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium text-gray-900">{value || 'Not provided'}</dd></div>
          )}
        </dl>}
    </main>
  </>
}
