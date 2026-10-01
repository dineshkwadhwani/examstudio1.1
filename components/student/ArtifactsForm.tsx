'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Artifact = {
  synopsis_pdf_path: string | null;
  design_document_pdf_path: string | null;
  input_definition: string | null;
  output_definition: string | null;
  github_repo_url: string | null;
  project_url: string | null;
  execution_trace: string | null;
  demo_video_url: string | null;
  status: 'draft' | 'submitted' | 'locked' | null;
};

type Member = { prn: string; name: string; github_username: string };
type FieldName = Exclude<keyof Artifact, 'status'>;

const fields: Array<{ name: FieldName; label: string; help?: string; multiline?: boolean; required?: boolean; pdf?: boolean; video?: boolean }> = [
  { name: 'synopsis_pdf_path', label: 'Project synopsis (PDF)', help: 'PDF only, maximum 10 MB', required: true, pdf: true },
  { name: 'design_document_pdf_path', label: 'Design document (PDF)', help: 'PDF only, maximum 10 MB', required: true, pdf: true },
  { name: 'input_definition', label: 'Input definition', multiline: true, required: true },
  { name: 'output_definition', label: 'Output definition', multiline: true, required: true },
  { name: 'github_repo_url', label: 'GitHub repository URL', required: true },
  { name: 'project_url', label: 'Project URL', required: true },
  { name: 'execution_trace', label: 'Execution trace', multiline: true, required: true },
  { name: 'demo_video_url', label: 'Demo video URL', help: 'Required', required: true },
];

function initialValues(artifacts: Artifact | null) {
  return Object.fromEntries(
    fields.map(({ name }) => [name, artifacts?.[name] ?? '']),
  ) as Record<FieldName, string>;
}

export default function ArtifactsForm({
  initialArtifacts,
  initialMembers,
}: {
  initialArtifacts: Artifact | null;
  initialMembers: Member[];
}) {
  const [values, setValues] = useState(() => initialValues(initialArtifacts));
  const [members, setMembers] = useState(initialMembers);
  const [status, setStatus] = useState<Artifact['status']>(initialArtifacts?.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resultsPublished, setResultsPublished] = useState(false);
  const [uploading, setUploading] = useState<FieldName | null>(null);

  const locked = status === 'locked';
  const canSubmit = useMemo(
    () => !locked && fields.every(({ name, required }) => !required || values[name].trim()),
    [locked, values],
  );

  useEffect(() => {
    fetch('/api/me/ca3-results')
      .then((response) => {
        if (response.ok) setResultsPublished(true);
      })
      .catch(() => undefined);
  }, []);

  function updateValue(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function updateMember(prn: string, github_username: string) {
    setMembers((current) => current.map((member) => (
      member.prn === prn ? { ...member, github_username } : member
    )));
  }

  async function uploadPdf(name: 'synopsis_pdf_path' | 'design_document_pdf_path', file: File | undefined) {
    if (!file) return;
    setUploading(name);
    setError('');
    const form = new FormData();
    form.append('field', name === 'synopsis_pdf_path' ? 'synopsis' : 'design_document');
    form.append('file', file);
    const response = await fetch('/api/me/artifacts/upload', { method: 'POST', body: form });
    const payload = await response.json().catch(() => ({}));
    setUploading(null);
    if (!response.ok) {
      setError(payload.message ?? 'Could not upload the PDF.');
      return;
    }
    updateValue(name, payload.path);
    setMessage('PDF uploaded. Save the draft to keep the artifact submission updated.');
  }

  async function save(submit = false) {
    setBusy(true);
    setError('');
    setMessage('');

    if (submit && !canSubmit) {
      setError('Complete all required artifact fields before submitting.');
      setBusy(false);
      return;
    }

    if (submit && members.some((member) => !member.github_username.trim())) {
      setError('Add a GitHub username for every team member before submitting.');
      setBusy(false);
      return;
    }

    const endpoint = submit ? '/api/me/artifacts/submit' : '/api/me/artifacts';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, members }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? 'Unable to save project artifacts.');
      return;
    }

    if (submit) setStatus('submitted');
    setMessage(submit ? 'Project submitted successfully.' : 'Draft saved.');
  }

  async function submit() {
    if (!window.confirm('Submit this project? You will not be able to edit the artifact fields afterward.')) return;
    await save(true);
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Project submission</h2>
          <p className="mt-1 text-sm text-slate-600">
            Status: <span className="font-medium capitalize">{status}</span>
          </p>
        </div>
        {resultsPublished ? (
          <Link href="/project/results" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            View Results
          </Link>
        ) : (
          <button type="button" disabled className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500">
            View Results
          </button>
        )}
      </div>

      {locked && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This project has been submitted. You may update the artifact details until final scores are saved.
        </div>
      )}
      {message && <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 space-y-5">
        {fields.map(({ name, label, help, multiline, required, pdf }) => (
          <label key={name} className="block">
            <span className="text-sm font-medium text-slate-800">
              {label} {required && <span className="text-red-600">*</span>}
            </span>
            {help && <span className="ml-2 text-xs text-slate-500">({help})</span>}
            {pdf ? (
              <>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => uploadPdf(name as 'synopsis_pdf_path' | 'design_document_pdf_path', event.target.files?.[0])}
                  disabled={locked || busy || uploading !== null}
                  className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm disabled:bg-slate-100"
                />
                {values[name] && <p className="mt-2 text-xs text-emerald-700">{uploading === name ? 'Uploading…' : 'PDF uploaded and ready to save.'}</p>}
              </>
            ) : multiline ? (
              <textarea
                value={values[name]}
                onChange={(event) => updateValue(name, event.target.value)}
                disabled={locked || busy}
                rows={4}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 disabled:bg-slate-100"
              />
            ) : (
              <input
                type={name.endsWith('_url') ? 'url' : 'text'}
                value={values[name]}
                onChange={(event) => updateValue(name, event.target.value)}
                disabled={locked || busy}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 disabled:bg-slate-100"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">GitHub usernames</h3>
        <p className="mt-1 text-sm text-slate-600">Provide each member’s GitHub username for contribution analysis.</p>
        <div className="mt-4 space-y-3">
          {members.map((member) => (
            <label key={member.prn} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-56 text-sm text-slate-700">{member.name} ({member.prn})</span>
              <input
                value={member.github_username}
                onChange={(event) => updateMember(member.prn, event.target.value)}
                disabled={locked || busy}
                placeholder="GitHub username"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 disabled:bg-slate-100"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={() => save(false)} disabled={locked || busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Saving…' : status === 'submitted' ? 'Save Changes' : 'Save Draft'}
        </button>
        <button type="button" onClick={submit} disabled={locked || busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
          {status === 'submitted' ? 'Update Submission' : 'Submit Project'}
        </button>
      </div>
    </section>
  );
}
