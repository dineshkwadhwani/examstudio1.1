export function GithubContributionGuidance() {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="section-title">
          Supplementary GitHub guidance: how to maximise the Individual Contributions score
        </h2>
        <p className="mt-2 leading-7 text-gray-700">
          This section adds practical guidance to the rubric above; it does not replace or remove any preceding requirement. A score of 5/5 is not guaranteed by a fixed number of commits. The system compares each member with the strongest measurable contribution in the same team, and the evaluator reviews the evidence.
        </p>
      </div>

      <div>
        <h3 className="subsection-title">To put yourself in the strongest position for the full 5 marks</h3>
        <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-gray-700">
          <li><strong>Register the exact GitHub username.</strong> Use the account that actually authored your commits, and check spelling, hyphens, underscores, and capitalisation. Submit the repository URL, including the relevant branch when your work is on a feature branch.</li>
          <li><strong>Make meaningful incremental commits.</strong> Commit working units such as an agent, tool, API route, test, bug fix, documentation section, or deployment improvement. Use clear messages that explain what changed. Do not wait and upload all work in one bulk commit.</li>
          <li><strong>Work across multiple days.</strong> The score rewards activity spread across the build window, not only a last-minute series of commits.</li>
          <li><strong>Make substantive project contributions.</strong> The analysis considers additions, deletions, and authoring. Write and improve real project code, tests, configuration, and documentation rather than creating repetitive or meaningless changes.</li>
          <li><strong>Use pull requests properly.</strong> Open pull requests for feature work, respond to review feedback, and review or comment constructively on teammates&apos; pull requests. Merged and unmerged pull requests are part of the evidence when visible in the repository.</li>
          <li><strong>Own meaningful files.</strong> Contribute substantially to files that remain primarily associated with your work. Avoid having every member make tiny changes to the same files, because file ownership cannot then be clearly attributed.</li>
          <li><strong>Keep Git identity consistent.</strong> Configure Git so the commit author name/email is associated with your GitHub account where possible. Verify that your commits appear under your GitHub profile before submission.</li>
        </ul>
      </div>

      <p className="leading-7 text-gray-700"><strong>Current scorecard emphasis:</strong> commits 25%, active days 10%, changes 10%, pull requests 10%, reviews/comments 10%, files primarily owned 25%, and authoring 10%. The values are normalised within your team. A member who leads the team across the measured categories is best positioned to receive the full 5/5.</p>
      <p className="leading-7 text-gray-700"><strong>Important:</strong> do not manufacture commits, split trivial changes, copy another member&apos;s work, or commit under someone else&apos;s identity. The evaluator can review the repository history and override the automated suggestion when the activity does not represent meaningful individual work.</p>
      <p className="leading-7 text-gray-700">The Individual Contributions score is also used to allocate the team&apos;s awarded 21 marks from Multi-Agent Design, Design, and Documentation. The highest contribution receives the full awarded amount; other members receive a proportional share based on their contribution score. Live Demo, Project Presentation, and Code Review remain shared team marks.</p>
    </section>
  )
}
