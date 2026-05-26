'use client';

import { useParams } from 'next/navigation';
import { ResumeBuilder } from '@/components/builder/resume-builder';

export default function ResumeBuilderPage() {
  const params = useParams();
  const resumeId = params?.id as string;

  return <ResumeBuilder resumeId={resumeId} />;
}
