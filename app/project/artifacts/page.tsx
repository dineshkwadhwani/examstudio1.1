import Link from 'next/link';
import { redirect } from 'next/navigation';
import ArtifactsForm from '@/components/student/ArtifactsForm';
import { PageHeader } from '@/components/student/PageHeader';
import { getSession } from '@/lib/session';
import { getApprovedStudentTeam } from '@/lib/artifacts';

export default async function ProjectArtifactsPage() {
  const session = await getSession();
  if (!session || session.type !== 'student') redirect('/login');

  const team = await getApprovedStudentTeam(session.id);
  if (!team) redirect('/dashboard');

  return (
    <>
      <PageHeader title="Project Artifacts" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/project" className="text-sm text-blue-700 hover:underline">
          ← Back to project
        </Link>
        <div className="mt-6">
          <h1 className="text-2xl font-semibold text-slate-900">Submit Project</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add the project materials for your approved team. You can save a draft and
            return later. Final evaluation locks these fields permanently.
          </p>
        </div>
        <ArtifactsForm
          initialArtifacts={team.artifacts}
          initialMembers={team.members.map((member) => ({
            prn: member.roster_prn,
            name: member.name,
            github_username: member.github_username ?? '',
          }))}
        />
      </main>
    </>
  );
}
