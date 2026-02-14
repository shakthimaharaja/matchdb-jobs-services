/**
 * Seed script – creates dummy jobs + candidate profiles in MongoDB
 * Run: npx tsx seed.ts
 */
import mongoose, { Schema } from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB_NAME || "matchdb_jobs";

// Vendor IDs from PostgreSQL seed (dan, eve, frank)
const DAN_ID = "d8c0acdc-07f4-4f4e-9b71-5e0f6d0f1745";
const EVE_ID = "b25adc3b-d440-470f-9390-54794dd95f89";
const FRANK_ID = "379a35d5-c33b-46ec-8c7a-79ec54d4378b";
// Candidate IDs from PostgreSQL seed
const ALICE_ID = "3458c125-290a-4d47-ac8a-c151f7241ec6";
const BOB_ID = "b444f8a3-a43c-44dc-be78-9c400e4c395a";
const CAROL_ID = "3f7616df-ebff-4b2b-b0b9-b9b5d539593f";

const JobModel = mongoose.model(
  "Job",
  new Schema(
    {
      title: String,
      description: String,
      vendorId: String,
      vendorEmail: String,
      recruiterName: String,
      recruiterPhone: String,
      location: String,
      jobType: String,
      salaryMin: Number,
      salaryMax: Number,
      payPerHour: Number,
      skillsRequired: [String],
      experienceRequired: Number,
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: "jobs" },
  ),
);

const ProfileModel = mongoose.model(
  "CandidateProfile",
  new Schema(
    {
      candidateId: String,
      name: String,
      email: String,
      phone: String,
      currentCompany: String,
      currentRole: String,
      preferredJobType: String,
      expectedHourlyRate: Number,
      experienceYears: Number,
      skills: [String],
      location: String,
      bio: String,
    },
    { timestamps: true, collection: "candidateprofiles" },
  ),
);

const AppModel = mongoose.model(
  "Application",
  new Schema(
    {
      jobId: String,
      jobTitle: String,
      candidateId: String,
      candidateEmail: String,
      coverLetter: String,
      status: { type: String, default: "pending" },
    },
    { timestamps: true, collection: "applications" },
  ),
);

async function main() {
  await mongoose.connect(`${MONGO_URI}/${MONGO_DB}`);
  console.log("MongoDB connected");

  await JobModel.deleteMany({});
  await ProfileModel.deleteMany({});
  await AppModel.deleteMany({});

  const jobs = await JobModel.insertMany([
    {
      title: "Senior React Developer",
      description:
        "Build scalable React applications for our SaaS platform using TypeScript, Redux, and Webpack 5 Module Federation.",
      vendorId: DAN_ID,
      vendorEmail: "dan@techcorp.com",
      recruiterName: "Dan Brown",
      recruiterPhone: "+1-555-0101",
      location: "Austin, TX",
      jobType: "full_time",
      salaryMin: 110000,
      salaryMax: 140000,
      payPerHour: 65,
      skillsRequired: ["React", "TypeScript", "Redux", "Webpack", "Node.js"],
      experienceRequired: 4,
      isActive: true,
    },
    {
      title: "Python Backend Engineer",
      description:
        "Design and implement REST APIs using Django and PostgreSQL. Docker and AWS experience is a plus.",
      vendorId: DAN_ID,
      vendorEmail: "dan@techcorp.com",
      recruiterName: "Dan Brown",
      recruiterPhone: "+1-555-0101",
      location: "Remote",
      jobType: "remote",
      salaryMin: 100000,
      salaryMax: 130000,
      payPerHour: 55,
      skillsRequired: ["Python", "Django", "PostgreSQL", "REST API", "Docker"],
      experienceRequired: 3,
      isActive: true,
    },
    {
      title: "Full Stack Engineer (Node + React)",
      description:
        "Own features end-to-end with Node.js, Express, React, and MongoDB on our next-gen hiring platform.",
      vendorId: EVE_ID,
      vendorEmail: "eve@startup.io",
      recruiterName: "Eve Wilson",
      recruiterPhone: "+1-555-0202",
      location: "San Francisco, CA",
      jobType: "full_time",
      salaryMin: 120000,
      salaryMax: 160000,
      payPerHour: 75,
      skillsRequired: ["Node.js", "Express", "React", "MongoDB", "TypeScript"],
      experienceRequired: 3,
      isActive: true,
    },
    {
      title: "DevOps / Cloud Engineer",
      description:
        "Manage AWS infrastructure, CI/CD pipelines, and container orchestration with Kubernetes.",
      vendorId: EVE_ID,
      vendorEmail: "eve@startup.io",
      recruiterName: "Eve Wilson",
      recruiterPhone: "+1-555-0202",
      location: "New York, NY",
      jobType: "contract",
      salaryMin: null,
      salaryMax: null,
      payPerHour: 90,
      skillsRequired: ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD"],
      experienceRequired: 5,
      isActive: true,
    },
    {
      title: "React Native Mobile Developer",
      description:
        "Build cross-platform mobile apps using React Native and TypeScript for iOS and Android.",
      vendorId: FRANK_ID,
      vendorEmail: "frank@agency.com",
      recruiterName: "Frank Miller",
      recruiterPhone: "+1-555-0303",
      location: "Chicago, IL",
      jobType: "part_time",
      salaryMin: 60000,
      salaryMax: 80000,
      payPerHour: 45,
      skillsRequired: ["React Native", "TypeScript", "iOS", "Android", "Redux"],
      experienceRequired: 2,
      isActive: true,
    },
    {
      title: "Data Engineer (Python + Spark)",
      description:
        "Build data pipelines and ETL workflows using Python, Apache Spark, and Airflow on AWS.",
      vendorId: FRANK_ID,
      vendorEmail: "frank@agency.com",
      recruiterName: "Frank Miller",
      recruiterPhone: "+1-555-0303",
      location: "Remote",
      jobType: "remote",
      salaryMin: 105000,
      salaryMax: 135000,
      payPerHour: 60,
      skillsRequired: ["Python", "Spark", "Airflow", "AWS", "SQL"],
      experienceRequired: 4,
      isActive: true,
    },
  ]);
  console.log(`Created ${jobs.length} jobs`);

  const profiles = await ProfileModel.insertMany([
    {
      candidateId: ALICE_ID,
      name: "Alice Johnson",
      email: "alice@example.com",
      phone: "+1-555-1001",
      currentCompany: "StartupX",
      currentRole: "Frontend Engineer",
      preferredJobType: "full_time",
      expectedHourlyRate: 60,
      experienceYears: 5,
      skills: ["React", "TypeScript", "Redux", "Node.js", "CSS"],
      location: "Austin, TX",
      bio: "Passionate frontend engineer with 5 years building React SPA and MFE architectures.",
    },
    {
      candidateId: BOB_ID,
      name: "Bob Smith",
      email: "bob@example.com",
      phone: "+1-555-1002",
      currentCompany: "FreelanceOps",
      currentRole: "Python Developer",
      preferredJobType: "remote",
      expectedHourlyRate: 50,
      experienceYears: 3,
      skills: ["Python", "Django", "REST API", "PostgreSQL", "Docker"],
      location: "Remote",
      bio: "Backend developer specializing in Python microservices and REST API design.",
    },
    {
      candidateId: CAROL_ID,
      name: "Carol Davis",
      email: "carol@example.com",
      phone: "+1-555-1003",
      currentCompany: "DevAgency",
      currentRole: "Full Stack Developer",
      preferredJobType: "contract",
      expectedHourlyRate: 70,
      experienceYears: 6,
      skills: ["Node.js", "React", "MongoDB", "TypeScript", "AWS", "Express"],
      location: "San Francisco, CA",
      bio: "Full stack developer with strong Node.js and React background. Open to contract work.",
    },
  ]);
  console.log(`Created ${profiles.length} candidate profiles`);

  const appDocs = await AppModel.insertMany([
    {
      jobId: (jobs[0] as any)._id.toString(),
      jobTitle: "Senior React Developer",
      candidateId: ALICE_ID,
      candidateEmail: "alice@example.com",
      coverLetter:
        "I am a great fit — I have built MFE architectures similar to your stack.",
      status: "shortlisted",
    },
    {
      jobId: (jobs[1] as any)._id.toString(),
      jobTitle: "Python Backend Engineer",
      candidateId: BOB_ID,
      candidateEmail: "bob@example.com",
      coverLetter:
        "3 years of Django experience and ready to contribute to your backend team.",
      status: "reviewing",
    },
    {
      jobId: (jobs[2] as any)._id.toString(),
      jobTitle: "Full Stack Engineer (Node + React)",
      candidateId: CAROL_ID,
      candidateEmail: "carol@example.com",
      coverLetter:
        "Building hiring platforms is my passion. Can hit the ground running.",
      status: "pending",
    },
    {
      jobId: (jobs[0] as any)._id.toString(),
      jobTitle: "Senior React Developer",
      candidateId: CAROL_ID,
      candidateEmail: "carol@example.com",
      coverLetter: "TypeScript and Redux are my strongest skills.",
      status: "pending",
    },
  ]);
  console.log(`Created ${appDocs.length} applications`);

  await mongoose.disconnect();
  console.log("\nMongoDB seed complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
