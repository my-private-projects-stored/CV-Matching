'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { SkeletonCard } from '@/components/ui';
import { RecruiterApplicationDetailView } from '@/components/recruiter/RecruiterApplicationDetailView';

function RecruiterApplicationDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const applicationId = params?.applicationId as string;
  const jobId = searchParams.get('job_id') || undefined;

  return <RecruiterApplicationDetailView applicationId={applicationId} jobId={jobId} />;
}

export default function RecruiterApplicationDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <RecruiterApplicationDetailContent />
    </Suspense>
  );
}
