'use client';

import { useParams } from 'next/navigation';
import { RecruiterApplicationDetailView } from '@/components/recruiter/RecruiterApplicationDetailView';

export default function RecruiterCandidateDetailPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const applicationId = params?.applicationId as string;

  return <RecruiterApplicationDetailView applicationId={applicationId} jobId={jobId} />;
}
