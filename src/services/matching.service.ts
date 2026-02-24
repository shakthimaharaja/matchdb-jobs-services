import { IJob } from "../models/Job.model";
import { ICandidateProfile } from "../models/CandidateProfile.model";

// Skills match: Jaccard-style overlap (case-insensitive)
function calcSkillsScore(
  candidateSkills: string[],
  jobSkills: string[],
): number {
  if (!jobSkills.length) return 100;
  if (!candidateSkills.length) return 0;

  const cSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
  const jSet = new Set(jobSkills.map((s) => s.toLowerCase().trim()));

  let matches = 0;
  jSet.forEach((s) => {
    if (cSet.has(s)) matches++;
  });

  return Math.round((matches / jSet.size) * 100);
}

// Job type match: 100 if exact match, else 0
function calcTypeScore(candidateType: string, jobType: string): number {
  return candidateType?.toLowerCase() === jobType?.toLowerCase() ? 100 : 0;
}

// Experience match: capped at 100
function calcExpScore(candidateYears: number, requiredYears: number): number {
  if (!requiredYears) return 100;
  return Math.min(Math.round((candidateYears / requiredYears) * 100), 100);
}

export interface MatchedJob extends IJob {
  matchPercentage: number;
  matchBreakdown: { skills: number; type: number; experience: number };
}

export interface MatchedCandidate extends ICandidateProfile {
  matchPercentage: number;
  matchedJobId: string;
  matchedJobTitle: string;
  matchBreakdown: { skills: number; type: number; experience: number };
}

// Visibility filter: does the candidate's visibilityConfig include this job's type/subType?
function isVisibleForJob(candidate: ICandidateProfile, job: IJob): boolean {
  const vis: Record<string, string[]> =
    (candidate as any).visibilityConfig || {};
  if (!Object.keys(vis).length) return true; // no config = visible everywhere (backward compat)
  const jobType = (job as any).jobType || "";
  if (!jobType) return true;
  if (!(jobType in vis)) return false; // candidate not visible for this job type
  const jobSubType = (job as any).jobSubType || "";
  if (
    jobSubType &&
    vis[jobType].length > 0 &&
    !vis[jobType].includes(jobSubType)
  )
    return false;
  return true;
}

export function matchCandidateToJobs(
  candidate: ICandidateProfile,
  jobs: IJob[],
): MatchedJob[] {
  return jobs
    .filter((job) => isVisibleForJob(candidate, job))
    .map((job) => {
      const skills = calcSkillsScore(candidate.skills, job.skillsRequired);
      const type = calcTypeScore(candidate.preferredJobType, job.jobType);
      const exp = calcExpScore(
        candidate.experienceYears,
        job.experienceRequired,
      );
      const pct = Math.round(skills * 0.6 + type * 0.15 + exp * 0.25);
      const obj = typeof job.toObject === "function" ? job.toObject() : job;

      return {
        ...obj,
        id: (job._id || (job as any).id)?.toString(),
        matchPercentage: pct,
        matchBreakdown: { skills, type, experience: exp },
      } as unknown as MatchedJob;
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

export function matchJobsToCandidates(
  jobs: IJob[],
  candidates: ICandidateProfile[],
): MatchedCandidate[] {
  const results: MatchedCandidate[] = [];

  for (const candidate of candidates) {
    let bestPct = 0;
    let bestJobId = "";
    let bestJobTitle = "";
    let bestBreakdown = { skills: 0, type: 0, experience: 0 };

    for (const job of jobs) {
      // Skip jobs the candidate is not visible for
      if (!isVisibleForJob(candidate, job)) continue;

      const skills = calcSkillsScore(candidate.skills, job.skillsRequired);
      const type = calcTypeScore(candidate.preferredJobType, job.jobType);
      const exp = calcExpScore(
        candidate.experienceYears,
        job.experienceRequired,
      );
      const pct = Math.round(skills * 0.6 + type * 0.15 + exp * 0.25);

      if (pct > bestPct) {
        bestPct = pct;
        bestJobId = (job._id || (job as any).id)?.toString();
        bestJobTitle = job.title;
        bestBreakdown = { skills, type, experience: exp };
      }
    }

    if (bestPct > 0) {
      const obj =
        typeof candidate.toObject === "function"
          ? candidate.toObject()
          : candidate;
      results.push({
        ...obj,
        id: (candidate._id || (candidate as any).id)?.toString(),
        matchPercentage: bestPct,
        matchedJobId: bestJobId,
        matchedJobTitle: bestJobTitle,
        matchBreakdown: bestBreakdown,
      } as unknown as MatchedCandidate);
    }
  }

  return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
}
