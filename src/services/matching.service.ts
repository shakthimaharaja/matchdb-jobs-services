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

export function matchCandidateToJobs(
  candidate: ICandidateProfile,
  jobs: IJob[],
): MatchedJob[] {
  return jobs
    .map((job) => {
      const skills = calcSkillsScore(candidate.skills, job.skillsRequired);
      const type = calcTypeScore(candidate.preferredJobType, job.jobType);
      const exp = calcExpScore(
        candidate.experienceYears,
        job.experienceRequired,
      );
      const pct = Math.round(skills * 0.6 + type * 0.15 + exp * 0.25);

      return {
        ...job.toObject(),
        id: job._id.toString(),
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
      const skills = calcSkillsScore(candidate.skills, job.skillsRequired);
      const type = calcTypeScore(candidate.preferredJobType, job.jobType);
      const exp = calcExpScore(
        candidate.experienceYears,
        job.experienceRequired,
      );
      const pct = Math.round(skills * 0.6 + type * 0.15 + exp * 0.25);

      if (pct > bestPct) {
        bestPct = pct;
        bestJobId = job._id.toString();
        bestJobTitle = job.title;
        bestBreakdown = { skills, type, experience: exp };
      }
    }

    if (bestPct > 0) {
      results.push({
        ...candidate.toObject(),
        id: candidate._id.toString(),
        matchPercentage: bestPct,
        matchedJobId: bestJobId,
        matchedJobTitle: bestJobTitle,
        matchBreakdown: bestBreakdown,
      } as unknown as MatchedCandidate);
    }
  }

  return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
}
