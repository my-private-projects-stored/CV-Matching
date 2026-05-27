import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('app');

const patches = [
  ['(app)/candidate/dashboard/page.tsx', 'candidateDashboard'],
  ['(app)/candidate/applications/page.tsx', 'candidateApplications'],
  ['(app)/candidate/applications/[id]/page.tsx', 'candidateApplicationDetail'],
  ['(app)/candidate/optimize/page.tsx', 'candidateOptimize'],
  ['(app)/candidate/profile/page.tsx', 'candidateProfile'],
  ['(app)/candidate/settings/page.tsx', 'candidateSettings'],
  ['(app)/recruiter/dashboard/page.tsx', 'recruiterDashboard'],
  ['(app)/recruiter/jobs/new/page.tsx', 'recruiterJobsNew'],
  ['(app)/recruiter/jobs/[id]/edit/page.tsx', 'recruiterJobsEdit'],
  ['(app)/recruiter/company/page.tsx', 'recruiterCompany'],
  ['(app)/recruiter/settings/page.tsx', 'recruiterSettings'],
  ['(app)/admin/users/page.tsx', 'adminUsers'],
  ['(app)/admin/vectors/page.tsx', 'adminVectors'],
];

for (const [rel, key] of patches) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.log('MISSING', rel);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('usePageHeader')) {
    console.log('SKIP', rel);
    continue;
  }
  if (!src.includes('usePageHeader')) {
    const importLine = "import { usePageHeader } from '@/lib/i18n/use-page-header';\n";
    const firstImportEnd = src.indexOf('\n', src.indexOf("'use client'"));
    if (src.startsWith("'use client'")) {
      src = src.slice(0, firstImportEnd + 1) + importLine + src.slice(firstImportEnd + 1);
    } else {
      src = importLine + src;
    }
  }
  const fnMatch = src.match(/export default function (\w+)/);
  if (!fnMatch) {
    console.log('NO FN', rel);
    continue;
  }
  const fn = fnMatch[1];
  const fnStart = src.indexOf(`export default function ${fn}`);
  const brace = src.indexOf('{', fnStart);
  src =
    src.slice(0, brace + 1) + `\n  const header = usePageHeader('${key}');` + src.slice(brace + 1);
  src = src.replace(
    /<PageHeader title="[^"]+" subtitle="[^"]+" \/>/g,
    '<PageHeader title={header.title} subtitle={header.subtitle} />'
  );
  fs.writeFileSync(file, src);
  console.log('PATCHED', rel);
}
