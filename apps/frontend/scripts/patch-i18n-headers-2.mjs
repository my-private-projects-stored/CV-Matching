import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('app');

const simple = [
  ['(app)/recruiter/notifications/page.tsx', 'recruiterNotifications'],
  ['(app)/recruiter/candidates/page.tsx', 'recruiterCandidates'],
  ['(app)/recruiter/jobs/page.tsx', 'recruiterJobs'],
  ['(app)/candidate/recommendations/page.tsx', 'candidateRecommendations'],
  ['(app)/candidate/resumes/[id]/history/page.tsx', 'candidateHistory'],
];

function addImport(src) {
  if (src.includes('usePageHeader')) return src;
  const line = "import { usePageHeader } from '@/lib/i18n/use-page-header';\n";
  const idx = src.indexOf('\n', src.indexOf("'use client'"));
  return src.slice(0, idx + 1) + line + src.slice(idx + 1);
}

function addHeaderHook(src, key) {
  if (src.includes('const header = usePageHeader')) return src;
  const fnMatch = src.match(/export default function (\w+)/);
  if (!fnMatch) return src;
  const fn = fnMatch[1];
  const fnStart = src.indexOf(`export default function ${fn}`);
  const brace = src.indexOf('{', fnStart);
  return (
    src.slice(0, brace + 1) + `\n  const header = usePageHeader('${key}');` + src.slice(brace + 1)
  );
}

for (const [rel, key] of simple) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  src = addImport(src);
  src = addHeaderHook(src, key);
  src = src.replace(
    /<PageHeader\n\s+title="[^"]+"\n\s+subtitle="[^"]+"\n/g,
    '<PageHeader\n        title={header.title}\n        subtitle={header.subtitle}\n'
  );
  src = src.replace(
    /<PageHeader\n\s+title="[^"]+"\n\s+subtitle="[^"]+"\n\s+action=/g,
    '<PageHeader\n        title={header.title}\n        subtitle={header.subtitle}\n        action='
  );
  src = src.replace(
    /<PageHeader\n\s+title="[^"]+"\n\s+subtitle="[^"]+"\n\s+action=\{/g,
    '<PageHeader\n        title={header.title}\n        subtitle={header.subtitle}\n        action={'
  );
  fs.writeFileSync(file, src);
  console.log('done', rel);
}

// candidate resumes - title only with action
{
  const rel = '(app)/candidate/resumes/page.tsx';
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  src = addImport(src);
  src = addHeaderHook(src, 'candidateResumes');
  src = src.replace(
    /<PageHeader\n\s+title="My Resumes"\n/g,
    '<PageHeader\n        title={header.title}\n'
  );
  fs.writeFileSync(file, src);
  console.log('done', rel);
}

// cover letter
{
  const rel = '(app)/candidate/resumes/[id]/cover-letter/page.tsx';
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('useTranslations')) {
    src = addImport(src);
    src = src.replace(
      "import { usePageHeader } from '@/lib/i18n/use-page-header';\n",
      "import { usePageHeader } from '@/lib/i18n/use-page-header';\nimport { useTranslations } from '@/lib/i18n/translations';\n"
    );
  }
  src = addHeaderHook(src, 'candidateCoverLetter');
  if (!src.includes('const { t } = useTranslations()')) {
    src = src.replace(
      "const header = usePageHeader('candidateCoverLetter');",
      "const header = usePageHeader('candidateCoverLetter');\n  const { t } = useTranslations();"
    );
  }
  src = src.replace(
    /<PageHeader\n\s+title="Cover Letter & Outreach"\n\s+subtitle=\{resume\?\.title \? `For: \$\{resume\.title\}` : 'AI-powered application documents'\}\n\s+\/>/,
    "<PageHeader\n        title={header.title}\n        subtitle={resume?.title ? t('pages.candidateCoverLetter.subtitleFor', { title: resume.title }) : header.subtitle}\n      />"
  );
  fs.writeFileSync(file, src);
  console.log('done', rel);
}

// recruiter candidates list
{
  const rel = '(app)/recruiter/jobs/[id]/candidates/page.tsx';
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  src = addImport(src);
  src = addHeaderHook(src, 'recruiterCandidatesList');
  src = src.replace(
    /title=\{jobTitle\}\n\s+subtitle="Ranked by hybrid score\."/,
    'title={jobTitle || header.title}\n        subtitle={header.subtitle}'
  );
  fs.writeFileSync(file, src);
  console.log('done', rel);
}

// find candidates
{
  const rel = '(app)/recruiter/jobs/[id]/find-candidates/page.tsx';
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  src = addImport(src);
  src = addHeaderHook(src, 'recruiterFindCandidates');
  if (!src.includes('useTranslations')) {
    src = src.replace(
      "import { usePageHeader } from '@/lib/i18n/use-page-header';\n",
      "import { usePageHeader } from '@/lib/i18n/use-page-header';\nimport { useTranslations } from '@/lib/i18n/translations';\n"
    );
    src = src.replace(
      "const header = usePageHeader('recruiterFindCandidates');",
      "const header = usePageHeader('recruiterFindCandidates');\n  const { t } = useTranslations();"
    );
  }
  src = src.replace(
    /title="Find Matching Candidates"\n\s+subtitle=\{\n\s+jobTitle\n\s+\? `Semantic matches for \$\{jobTitle\}`\n\s+: 'Discover passive matches from your talent pool\.'\n\s+\}/,
    "title={header.title}\n        subtitle={jobTitle ? t('pages.recruiterFindCandidates.subtitleForJob', { title: jobTitle }) : header.subtitle}"
  );
  fs.writeFileSync(file, src);
  console.log('done', rel);
}

// interview
{
  const rel = '(app)/recruiter/jobs/[id]/interview/page.tsx';
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  src = addImport(src);
  src = addHeaderHook(src, 'recruiterInterview');
  src = src.replace(
    /title="Interview Questions"\n\s+subtitle=\{\n\s+result\n\s+\? `Generated for \$\{result\.job_title \|\| 'this job'\}`\n\s+: 'AI-generated bilingual question sets\.'\n\s+\}/,
    "title={header.title}\n            subtitle={result ? `${header.subtitle} — ${result.job_title || 'this job'}` : header.subtitle}"
  );
  fs.writeFileSync(file, src);
  console.log('done', rel);
}
