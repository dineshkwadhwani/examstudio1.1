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
  presentation_date: string | null;
  status: 'draft' | 'submitted' | 'presented' | 'locked' | null;
};

type PresentationDateOption = {
  date: '2026-10-22' | '2026-10-23';
  booked_slots: number;
  available_slots: number;
};

const PRESENTATION_DATE_CAPACITY = 25;

type Member = { prn: string; name: string; github_username: string };
type FieldName = Exclude<keyof Artifact, 'status'>;
type SubmissionCheck = { field: string; label: string; valid: boolean };

const fields: Array<{ name: FieldName; label: string; description: string; help?: string; multiline?: boolean; required?: boolean; pdf?: boolean; video?: boolean }> = [
  { name: 'synopsis_pdf_path', label: 'Project synopsis (PDF)', description: 'Summarise the problem, your solution, target user, and project scope.', help: 'PDF only, maximum 10 MB', required: true, pdf: true },
  { name: 'design_document_pdf_path', label: 'Design document (PDF)', description: 'Show the architecture, agent roles, communication pattern, and technology choices.', help: 'PDF only, maximum 10 MB', required: true, pdf: true },
  { name: 'input_definition', label: 'Input definition', description: 'Explain what your system accepts, including its format/schema and one real example.', multiline: true, required: true },
  { name: 'output_definition', label: 'Output definition', description: 'Explain what your system produces, including its format/schema and one real example.', multiline: true, required: true },
  { name: 'github_repo_url', label: 'GitHub repository URL', description: 'Paste the repository evaluators will review; ensure it is public or shared with the evaluator.', required: true },
  { name: 'project_url', label: 'Project URL', description: 'Paste the live deployment URL that evaluators can open and test during the demo.', required: true },
  { name: 'execution_trace', label: 'Execution trace', description: 'Provide a real captured run showing messages and handoffs between your agents.', multiline: true, required: true },
  { name: 'demo_video_url', label: 'Demo video URL', description: 'Share a 2–3 minute walkthrough of the working system as backup evidence for the live demo.', help: 'Required', required: true },
];

function initialValues(artifacts: Artifact | null) {
  return Object.fromEntries(
    fields.map(({ name }) => [name, artifacts?.[name] ?? '']),
  ) as Record<FieldName, string>;
}

export default function ArtifactsForm({
  initialArtifacts,
  initialMembers,
  initialPresentationDate,
  presentationDateOptions,
}: {
  initialArtifacts: Artifact | null;
  initialMembers: Member[];
  initialPresentationDate: string | null;
  presentationDateOptions: PresentationDateOption[];
}) {
  const [values, setValues] = useState(() => initialValues(initialArtifacts));
  const [members, setMembers] = useState(initialMembers);
  const [status, setStatus] = useState<Artifact['status']>(initialArtifacts?.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resultsPublished, setResultsPublished] = useState(false);
  const [uploading, setUploading] = useState<FieldName | null>(null);
  const [presentationDate, setPresentationDate] = useState(initialPresentationDate ?? '');
  const [savedPresentationDate, setSavedPresentationDate] = useState(initialPresentationDate ?? '');
  const [dateOptions, setDateOptions] = useState(presentationDateOptions);
  const [dateBusy, setDateBusy] = useState(false);
  const [submissionChecks, setSubmissionChecks] = useState<SubmissionCheck[] | null>(null);

  const locked = status === 'locked' || status === 'presented';
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
      setError(payload.message ?? payload.error ?? 'Unable to save project artifacts.');
      return;
    }

    if (submit) {
      setStatus('submitted');
      setSubmissionChecks(payload.checks ?? []);
      setMessage(payload.message ?? 'All required artifacts were validated and submitted successfully.');
    } else {
      setSubmissionChecks(null);
      setMessage('Draft saved.');
    }
  }

  async function submit() {
    if (!window.confirm('Submit this project? You will not be able to edit the artifact fields afterward.')) return;
    await save(true);
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
  }

  async function savePresentationDate() {
    if (!presentationDate) {
      setError('Select a presentation date first.');
      return;
    }
    setDateBusy(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/me/artifacts/presentation-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation_date: presentationDate }),
    });
    const payload = await response.json().catch(() => ({}));
    setDateBusy(false);
    if (!response.ok) {
      setError(payload.message ?? 'Could not save the presentation date.');
      return;
    }
    setDateOptions((current) => current.map((option) => {
      if (option.date === savedPresentationDate && savedPresentationDate !== presentationDate) {
        return { ...option, booked_slots: Math.max(0, option.booked_slots - 1), available_slots: Math.min(PRESENTATION_DATE_CAPACITY, option.available_slots + 1) };
      }
      if (option.date === presentationDate && savedPresentationDate !== presentationDate) {
        return { ...option, booked_slots: option.booked_slots + 1, available_slots: Math.max(0, option.available_slots - 1) };
      }
      return option;
    }));
    setSavedPresentationDate(presentationDate);
    setMessage('Presentation date saved.');
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
      {submissionChecks && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-semibold text-emerald-900">Submission verification</h3><ul className="mt-3 grid gap-2 text-sm text-emerald-800 sm:grid-cols-2">{submissionChecks.map((check) => <li key={check.field}>{check.valid ? '✓' : '✕'} {check.label}</li>)}</ul><p className="mt-3 text-sm font-medium text-emerald-900">Submission status: submitted successfully</p></div>}

      <div className="mt-6 space-y-5">
        {fields.map(({ name, label, description, help, multiline, required, pdf }) => (
          <label key={name} className="block">
            <span className="text-sm font-medium text-slate-800">
              {label} {required && <span className="text-red-600">*</span>}
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{description}{help && <> <span className="text-slate-400">({help})</span></>}</span>
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

      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">Presentation date</h3>
        <p className="mt-1 text-sm text-slate-600">
          Select a date for your team presentation. Each date has a maximum of 25 team slots.
        </p>
        <div className="mt-4 space-y-3">
          {dateOptions.map((option) => {
            const full = option.available_slots === 0 && presentationDate !== option.date;
            return (
              <label key={option.date} className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${full ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 text-slate-800'}`}>
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="presentation_date"
                    value={option.date}
                    checked={presentationDate === option.date}
                    onChange={() => setPresentationDate(option.date)}
                    disabled={dateBusy || full}
                  />
                  <span className="text-sm font-medium">{formatDate(option.date)}</span>
                </span>
                <span className="text-xs font-medium">
                  {full ? 'No slots available' : `${option.available_slots} slot${option.available_slots === 1 ? '' : 's'} available`}
                </span>
              </label>
            );
          })}
        </div>
        <button type="button" onClick={savePresentationDate} disabled={dateBusy || !presentationDate} className="mt-4 rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
          {dateBusy ? 'Saving…' : 'Save Presentation Date'}
        </button>
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
