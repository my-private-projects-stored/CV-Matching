'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorBanner, PageHeader, SkeletonCard, StatusBadge } from '@/components/ui';
import { useTranslations } from '@/lib/i18n/translations';
import {
  fetchCandidateProfileById,
  type CandidateProfileResponse,
} from '@/lib/api/candidate-profile';
import {
  fetchCandidateApplicationHistory,
  type CandidateHistoryItem,
} from '@/lib/api/applications';
import {
  fetchMasterResume,
  fetchResume,
  downloadResumePdf,
  downloadOriginalResumeFile,
  type ResumeListItem,
} from '@/lib/api';
import {
  Download,
  FileDown,
  Briefcase,
  GraduationCap,
  FolderGit,
  Award,
  BookOpen,
  Mail,
  Phone,
  MapPin,
  Globe,
  Linkedin,
  Github,
  Calendar,
  FileText,
} from 'lucide-react';

export default function RecruiterCandidateProfilePage() {
  const { t } = useTranslations();
  const params = useParams();
  const candidateId = params?.id as string;
  const [profile, setProfile] = useState<CandidateProfileResponse['data'] | null>(null);
  const [applications, setApplications] = useState<CandidateHistoryItem[]>([]);
  const [masterResume, setMasterResume] = useState<ResumeListItem | null>(null);
  const [resumeDetails, setResumeDetails] = useState<any | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [profilePayload, historyPayload] = await Promise.all([
          fetchCandidateProfileById(candidateId),
          fetchCandidateApplicationHistory({ candidateId, limit: 20 }),
        ]);

        if (!active) return;
        setProfile(profilePayload.data);
        setApplications(historyPayload.data.applications);

        // Fetch Master Resume and full details
        try {
          const master = await fetchMasterResume(candidateId);
          if (active && master) {
            setMasterResume(master);
            const details = await fetchResume(master.resume_id);
            if (active) {
              setResumeDetails(details);
            }
          }
        } catch (masterError) {
          console.error('Failed to load master resume details:', masterError);
        }

        setError(null);
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : t('errors.loadProfile'));
        setProfile(null);
        setApplications([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [candidateId, t]);

  const handleDownloadPdf = async () => {
    if (!masterResume) return;
    setDownloadingPdf(true);
    try {
      const blob = await downloadResumePdf(masterResume.resume_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = masterResume.filename || `${profile?.full_name || 'candidate'}_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(t('errors.downloadFailed') || 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!masterResume) return;
    setDownloadingOriginal(true);
    try {
      const blob = await downloadOriginalResumeFile(masterResume.resume_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = masterResume.filename || 'resume';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(t('errors.downloadFailed') || 'Failed to download original resume');
    } finally {
      setDownloadingOriginal(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile?.full_name || t('recruiter.candidates.unnamedCandidate')}
        subtitle={profile?.email || t('recruiter.candidateDetail.candidate')}
      />
      {loading ? <SkeletonCard /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {!loading && profile ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-[var(--border)] bg-white p-5 h-fit">
            <p className="text-sm font-semibold">{profile.profile.headline || profile.full_name}</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">{profile.profile.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.profile.skills.slice(0, 12).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-[var(--blue-50)] px-2 py-1 text-xs text-[var(--blue-700)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <h2 className="text-sm font-semibold">{t('routes.applications')}</h2>
              <div className="mt-4 space-y-3">
                {applications.map((application) => (
                  <Link
                    key={application.application_id}
                    href={`/recruiter/jobs/${application.job.id}/candidates/${application.application_id}`}
                    className="grid gap-3 rounded-xl border border-[var(--border)] p-4 text-sm hover:bg-slate-50 md:grid-cols-[1fr_120px_100px] md:items-center"
                  >
                    <span>
                      <span className="block font-semibold">{application.job.title}</span>
                      <span className="text-xs text-[var(--text-3)]">{application.resume.title}</span>
                    </span>
                    <span className="font-semibold text-[var(--text-1)]">
                      {Math.round(application.scores.hybrid_score * 100)}%
                    </span>
                    <StatusBadge status={application.status} className="w-fit justify-self-end" />
                  </Link>
                ))}
                {!applications.length ? (
                  <p className="text-sm text-[var(--text-3)]">
                    {t('emptyStates.noApplicationsFound.description')}
                  </p>
                ) : null}
              </div>
            </section>

            {resumeDetails?.processed_resume ? (
              <section className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2 text-[var(--text-1)]">
                      <FileText className="size-5 text-[var(--blue-700)]" />
                      {masterResume?.title || t('resumes.masterResume') || 'Master CV'}
                    </h2>
                    {masterResume?.updated_at && (
                      <p className="text-xs text-[var(--text-3)] mt-0.5">
                        {t('common.lastUpdated') || 'Last updated'}:{' '}
                        {new Date(masterResume.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-700)] hover:bg-[var(--blue-800)] px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
                    >
                      <Download className="size-3.5" />
                      {downloadingPdf ? 'Downloading PDF...' : 'Download PDF'}
                    </button>
                    <button
                      onClick={handleDownloadOriginal}
                      disabled={downloadingOriginal}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--blue-700)] px-3 py-2 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--blue-700)] transition disabled:opacity-50"
                    >
                      <FileDown className="size-3.5" />
                      {downloadingOriginal ? 'Downloading...' : 'Download Original'}
                    </button>
                  </div>
                </div>

                {/* Personal Info Summary */}
                {resumeDetails.processed_resume.personalInfo && (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs text-[var(--text-2)] bg-[var(--blue-50)] bg-opacity-20 rounded-xl p-4 border border-[var(--blue-50)] border-opacity-30">
                    {resumeDetails.processed_resume.personalInfo.email && (
                      <span className="flex items-center gap-2">
                        <Mail className="size-3.5 text-[var(--blue-700)]" />
                        {resumeDetails.processed_resume.personalInfo.email}
                      </span>
                    )}
                    {resumeDetails.processed_resume.personalInfo.phone && (
                      <span className="flex items-center gap-2">
                        <Phone className="size-3.5 text-[var(--blue-700)]" />
                        {resumeDetails.processed_resume.personalInfo.phone}
                      </span>
                    )}
                    {resumeDetails.processed_resume.personalInfo.location && (
                      <span className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-[var(--blue-700)]" />
                        {resumeDetails.processed_resume.personalInfo.location}
                      </span>
                    )}
                    {resumeDetails.processed_resume.personalInfo.website && (
                      <a
                        href={resumeDetails.processed_resume.personalInfo.website}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:text-[var(--blue-700)] transition"
                      >
                        <Globe className="size-3.5 text-[var(--blue-700)]" />
                        Website
                      </a>
                    )}
                    {resumeDetails.processed_resume.personalInfo.linkedin && (
                      <a
                        href={resumeDetails.processed_resume.personalInfo.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:text-[var(--blue-700)] transition"
                      >
                        <Linkedin className="size-3.5 text-[var(--blue-700)]" />
                        LinkedIn
                      </a>
                    )}
                    {resumeDetails.processed_resume.personalInfo.github && (
                      <a
                        href={resumeDetails.processed_resume.personalInfo.github}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:text-[var(--blue-700)] transition"
                      >
                        <Github className="size-3.5 text-[var(--blue-700)]" />
                        GitHub
                      </a>
                    )}
                  </div>
                )}

                {/* Summary */}
                {resumeDetails.processed_resume.summary && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[var(--text-1)] uppercase tracking-wider">
                      {t('resumes.summary') || 'Summary'}
                    </h3>
                    <p className="text-sm text-[var(--text-2)] leading-relaxed">
                      {resumeDetails.processed_resume.summary}
                    </p>
                  </div>
                )}

                {/* Work Experience */}
                {resumeDetails.processed_resume.workExperience &&
                  resumeDetails.processed_resume.workExperience.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-[var(--text-1)] border-b border-[var(--border)] pb-1.5 flex items-center gap-2 uppercase tracking-wider">
                        <Briefcase className="size-4 text-[var(--blue-700)]" />
                        {t('resumes.workExperience') || 'Work Experience'}
                      </h3>
                      <div className="space-y-4">
                        {resumeDetails.processed_resume.workExperience.map((exp: any, index: number) => (
                          <div key={exp.id || index} className="space-y-1 text-sm">
                            <div className="flex flex-wrap justify-between items-start gap-1 font-semibold text-[var(--text-1)]">
                              <span>{exp.title}</span>
                              <span className="text-xs text-[var(--text-3)] font-normal flex items-center gap-1">
                                <Calendar className="size-3" />
                                {exp.years}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--blue-700)] font-medium">
                              {exp.company} {exp.location ? `· ${exp.location}` : ''}
                            </div>
                            {exp.description && Array.isArray(exp.description) && (
                              <ul className="list-disc pl-5 text-xs text-[var(--text-2)] space-y-1 mt-1.5">
                                {exp.description.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Education */}
                {resumeDetails.processed_resume.education &&
                  resumeDetails.processed_resume.education.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-[var(--text-1)] border-b border-[var(--border)] pb-1.5 flex items-center gap-2 uppercase tracking-wider">
                        <GraduationCap className="size-4 text-[var(--blue-700)]" />
                        {t('resumes.education') || 'Education'}
                      </h3>
                      <div className="space-y-3">
                        {resumeDetails.processed_resume.education.map((edu: any, index: number) => (
                          <div key={edu.id || index} className="space-y-1 text-sm">
                            <div className="flex flex-wrap justify-between items-start gap-1 font-semibold text-[var(--text-1)]">
                              <span>{edu.degree}</span>
                              <span className="text-xs text-[var(--text-3)] font-normal flex items-center gap-1">
                                <Calendar className="size-3" />
                                {edu.years}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--text-2)]">
                              {edu.institution}
                            </div>
                            {edu.description && (
                              <p className="text-xs text-[var(--text-3)] mt-1">{edu.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Personal Projects */}
                {resumeDetails.processed_resume.personalProjects &&
                  resumeDetails.processed_resume.personalProjects.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-[var(--text-1)] border-b border-[var(--border)] pb-1.5 flex items-center gap-2 uppercase tracking-wider">
                        <FolderGit className="size-4 text-[var(--blue-700)]" />
                        {t('resumes.projects') || 'Personal Projects'}
                      </h3>
                      <div className="space-y-4">
                        {resumeDetails.processed_resume.personalProjects.map((project: any, index: number) => (
                          <div key={project.id || index} className="space-y-1 text-sm">
                            <div className="flex flex-wrap justify-between items-start gap-1 font-semibold text-[var(--text-1)]">
                              <span>{project.name}</span>
                              <span className="text-xs text-[var(--text-3)] font-normal flex items-center gap-1">
                                <Calendar className="size-3" />
                                {project.years}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--blue-700)] font-medium">
                              {project.role}
                            </div>
                            {project.description && Array.isArray(project.description) && (
                              <ul className="list-disc pl-5 text-xs text-[var(--text-2)] space-y-1 mt-1.5">
                                {project.description.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Additional Information */}
                {resumeDetails.processed_resume.additional && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-[var(--text-1)] border-b border-[var(--border)] pb-1.5 flex items-center gap-2 uppercase tracking-wider">
                      <Award className="size-4 text-[var(--blue-700)]" />
                      {t('resumes.additionalInfo') || 'Additional Information'}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 text-xs">
                      {/* Technical Skills */}
                      {resumeDetails.processed_resume.additional.technicalSkills &&
                        resumeDetails.processed_resume.additional.technicalSkills.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="font-semibold text-[var(--text-2)] flex items-center gap-1.5">
                              <BookOpen className="size-3.5 text-[var(--blue-700)]" />
                              {t('resumes.skills') || 'Technical Skills'}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {resumeDetails.processed_resume.additional.technicalSkills.map((skill: string) => (
                                <span key={skill} className="rounded-md bg-slate-100 text-slate-800 px-2 py-0.5 font-medium">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Languages */}
                      {resumeDetails.processed_resume.additional.languages &&
                        resumeDetails.processed_resume.additional.languages.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="font-semibold text-[var(--text-2)] flex items-center gap-1.5">
                              <Globe className="size-3.5 text-[var(--blue-700)]" />
                              {t('resumes.languages') || 'Languages'}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {resumeDetails.processed_resume.additional.languages.map((lang: string) => (
                                <span key={lang} className="rounded-md bg-slate-100 text-slate-800 px-2 py-0.5 font-medium">
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Certifications */}
                      {resumeDetails.processed_resume.additional.certificationsTraining &&
                        resumeDetails.processed_resume.additional.certificationsTraining.length > 0 && (
                          <div className="space-y-1.5 md:col-span-2">
                            <span className="font-semibold text-[var(--text-2)] flex items-center gap-1.5">
                              <Award className="size-3.5 text-[var(--blue-700)]" />
                              {t('resumes.certifications') || 'Certifications & Training'}
                            </span>
                            <ul className="list-disc pl-5 space-y-1 text-[var(--text-2)]">
                              {resumeDetails.processed_resume.additional.certificationsTraining.map((cert: string) => (
                                <li key={cert}>{cert}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {/* Awards */}
                      {resumeDetails.processed_resume.additional.awards &&
                        resumeDetails.processed_resume.additional.awards.length > 0 && (
                          <div className="space-y-1.5 md:col-span-2">
                            <span className="font-semibold text-[var(--text-2)] flex items-center gap-1.5">
                              <Award className="size-3.5 text-[var(--blue-700)]" />
                              {t('resumes.awards') || 'Awards & Honors'}
                            </span>
                            <ul className="list-disc pl-5 space-y-1 text-[var(--text-2)]">
                              {resumeDetails.processed_resume.additional.awards.map((award: string) => (
                                <li key={award}>{award}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
