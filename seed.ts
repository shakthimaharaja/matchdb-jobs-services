/**
 * Seed script – creates dummy jobs + candidate profiles + applications in MongoDB
 * Run: npx tsx seed.ts
 */
import mongoose, { Schema } from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB_NAME || "matchdb_jobs";

// ── Vendor IDs (from shell-services seed) ──
const DAN_ID = "d8c0acdc-07f4-4f4e-9b71-5e0f6d0f1745";
const EVE_ID = "b25adc3b-d440-470f-9390-54794dd95f89";
const FRANK_ID = "379a35d5-c33b-46ec-8c7a-79ec54d4378b";
const NINA_ID = "a1b2c3d4-2222-4bbb-b222-000000000001";
const OSCAR_ID = "a1b2c3d4-2222-4bbb-b222-000000000002";
const PAULA_ID = "a1b2c3d4-2222-4bbb-b222-000000000003";
const QUINN_ID = "a1b2c3d4-2222-4bbb-b222-000000000004";

// ── Candidate IDs (from shell-services seed) ──
const ALICE_ID = "3458c125-290a-4d47-ac8a-c151f7241ec6";
const BOB_ID = "b444f8a3-a43c-44dc-be78-9c400e4c395a";
const CAROL_ID = "3f7616df-ebff-4b2b-b0b9-b9b5d539593f";
const GRACE_ID = "a1b2c3d4-1111-4aaa-b111-000000000001";
const HANK_ID = "a1b2c3d4-1111-4aaa-b111-000000000002";
const IRENE_ID = "a1b2c3d4-1111-4aaa-b111-000000000003";
const JACK_ID = "a1b2c3d4-1111-4aaa-b111-000000000004";
const KAREN_ID = "a1b2c3d4-1111-4aaa-b111-000000000005";
const LEO_ID = "a1b2c3d4-1111-4aaa-b111-000000000006";
const MIA_ID = "a1b2c3d4-1111-4aaa-b111-000000000007";

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
      jobSubType: { type: String, default: "" },
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
      username: { type: String, default: "" },
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
      resumeSummary: { type: String, default: "" },
      resumeExperience: { type: String, default: "" },
      resumeEducation: { type: String, default: "" },
      resumeAchievements: { type: String, default: "" },
      profileLocked: { type: Boolean, default: false },
      visibilityConfig: { type: Schema.Types.Mixed, default: {} },
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

  // ═══════════════════════════════════════════
  // JOBS (20)
  // ═══════════════════════════════════════════
  const jobs = await JobModel.insertMany([
    // ── Dan Brown @ TechCorp (3 jobs) ──
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
      jobSubType: "w2",
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
      jobSubType: "",
      salaryMin: 100000,
      salaryMax: 130000,
      payPerHour: 55,
      skillsRequired: ["Python", "Django", "PostgreSQL", "REST API", "Docker"],
      experienceRequired: 3,
      isActive: true,
    },
    {
      title: "QA Automation Engineer",
      description:
        "Write and maintain automated test suites in Cypress and Playwright. Experience with CI/CD and GitHub Actions required.",
      vendorId: DAN_ID,
      vendorEmail: "dan@techcorp.com",
      recruiterName: "Dan Brown",
      recruiterPhone: "+1-555-0101",
      location: "Austin, TX",
      jobType: "full_time",
      jobSubType: "c2h",
      salaryMin: 90000,
      salaryMax: 115000,
      payPerHour: 50,
      skillsRequired: [
        "Cypress",
        "Playwright",
        "JavaScript",
        "CI/CD",
        "GitHub Actions",
      ],
      experienceRequired: 2,
      isActive: true,
    },

    // ── Eve Wilson @ Startup.io (3 jobs) ──
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
      jobSubType: "w2",
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
      jobSubType: "c2c",
      salaryMin: null,
      salaryMax: null,
      payPerHour: 90,
      skillsRequired: ["AWS", "Kubernetes", "Docker", "Terraform", "CI/CD"],
      experienceRequired: 5,
      isActive: true,
    },
    {
      title: "Machine Learning Engineer",
      description:
        "Develop recommendation algorithms and NLP models for talent matching. PyTorch and MLflow experience preferred.",
      vendorId: EVE_ID,
      vendorEmail: "eve@startup.io",
      recruiterName: "Eve Wilson",
      recruiterPhone: "+1-555-0202",
      location: "San Francisco, CA",
      jobType: "full_time",
      jobSubType: "w2",
      salaryMin: 140000,
      salaryMax: 180000,
      payPerHour: 95,
      skillsRequired: ["Python", "PyTorch", "NLP", "MLflow", "SQL"],
      experienceRequired: 4,
      isActive: true,
    },

    // ── Frank Miller @ Agency (3 jobs) ──
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
      jobSubType: "",
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
      jobSubType: "",
      salaryMin: 105000,
      salaryMax: 135000,
      payPerHour: 60,
      skillsRequired: ["Python", "Spark", "Airflow", "AWS", "SQL"],
      experienceRequired: 4,
      isActive: true,
    },
    {
      title: "UI/UX Designer (Figma + React)",
      description:
        "Create pixel-perfect designs in Figma and implement them as React components with Tailwind CSS.",
      vendorId: FRANK_ID,
      vendorEmail: "frank@agency.com",
      recruiterName: "Frank Miller",
      recruiterPhone: "+1-555-0303",
      location: "Chicago, IL",
      jobType: "contract",
      jobSubType: "c2h",
      salaryMin: null,
      salaryMax: null,
      payPerHour: 55,
      skillsRequired: ["Figma", "React", "Tailwind CSS", "CSS", "Adobe XD"],
      experienceRequired: 3,
      isActive: true,
    },

    // ── Nina Chen @ Recruit.co (3 jobs) ──
    {
      title: "Java Spring Boot Developer",
      description:
        "Build enterprise microservices using Java 17, Spring Boot 3, and Apache Kafka for event-driven architecture.",
      vendorId: NINA_ID,
      vendorEmail: "nina@recruit.co",
      recruiterName: "Nina Chen",
      recruiterPhone: "+1-555-0404",
      location: "Dallas, TX",
      jobType: "full_time",
      jobSubType: "c2h",
      salaryMin: 115000,
      salaryMax: 145000,
      payPerHour: 70,
      skillsRequired: [
        "Java",
        "Spring Boot",
        "Kafka",
        "Microservices",
        "PostgreSQL",
      ],
      experienceRequired: 5,
      isActive: true,
    },
    {
      title: "Angular Frontend Developer",
      description:
        "Develop enterprise dashboards using Angular 16, RxJS, and NgRx state management.",
      vendorId: NINA_ID,
      vendorEmail: "nina@recruit.co",
      recruiterName: "Nina Chen",
      recruiterPhone: "+1-555-0404",
      location: "Remote",
      jobType: "remote",
      jobSubType: "",
      salaryMin: 95000,
      salaryMax: 125000,
      payPerHour: 58,
      skillsRequired: ["Angular", "TypeScript", "RxJS", "NgRx", "SCSS"],
      experienceRequired: 3,
      isActive: true,
    },
    {
      title: "Golang Backend Developer",
      description:
        "Design high-performance REST and gRPC services in Go. Strong concurrency and systems programming background.",
      vendorId: NINA_ID,
      vendorEmail: "nina@recruit.co",
      recruiterName: "Nina Chen",
      recruiterPhone: "+1-555-0404",
      location: "Seattle, WA",
      jobType: "full_time",
      jobSubType: "w2",
      salaryMin: 130000,
      salaryMax: 165000,
      payPerHour: 80,
      skillsRequired: ["Go", "gRPC", "PostgreSQL", "Docker", "Redis"],
      experienceRequired: 4,
      isActive: true,
    },

    // ── Oscar Nguyen @ HiringLab (3 jobs) ──
    {
      title: "Site Reliability Engineer (SRE)",
      description:
        "Ensure 99.99% uptime for our global platform. Expertise in Prometheus, Grafana, and incident response required.",
      vendorId: OSCAR_ID,
      vendorEmail: "oscar@hiringlab.com",
      recruiterName: "Oscar Nguyen",
      recruiterPhone: "+1-555-0505",
      location: "Denver, CO",
      jobType: "full_time",
      jobSubType: "w2",
      salaryMin: 125000,
      salaryMax: 155000,
      payPerHour: 78,
      skillsRequired: [
        "Linux",
        "Prometheus",
        "Grafana",
        "Kubernetes",
        "Terraform",
      ],
      experienceRequired: 5,
      isActive: true,
    },
    {
      title: "iOS Developer (Swift)",
      description:
        "Build native iOS applications using Swift, SwiftUI, and Combine. App Store deployment experience required.",
      vendorId: OSCAR_ID,
      vendorEmail: "oscar@hiringlab.com",
      recruiterName: "Oscar Nguyen",
      recruiterPhone: "+1-555-0505",
      location: "Los Angeles, CA",
      jobType: "contract",
      jobSubType: "w2",
      salaryMin: null,
      salaryMax: null,
      payPerHour: 70,
      skillsRequired: ["Swift", "SwiftUI", "Combine", "Core Data", "Xcode"],
      experienceRequired: 3,
      isActive: true,
    },
    {
      title: "Cybersecurity Analyst",
      description:
        "Conduct penetration testing, vulnerability assessments, and security audits. CISSP or CEH certification preferred.",
      vendorId: OSCAR_ID,
      vendorEmail: "oscar@hiringlab.com",
      recruiterName: "Oscar Nguyen",
      recruiterPhone: "+1-555-0505",
      location: "Washington, DC",
      jobType: "full_time",
      jobSubType: "c2h",
      salaryMin: 110000,
      salaryMax: 140000,
      payPerHour: 72,
      skillsRequired: [
        "Penetration Testing",
        "SIEM",
        "Python",
        "Network Security",
        "OWASP",
      ],
      experienceRequired: 4,
      isActive: true,
    },

    // ── Paula Kim @ TalentEdge (2 jobs) ──
    {
      title: "Salesforce Developer",
      description:
        "Customize Salesforce CRM using Apex, Lightning Web Components, and SOQL. Integration experience with REST APIs.",
      vendorId: PAULA_ID,
      vendorEmail: "paula@talentedge.io",
      recruiterName: "Paula Kim",
      recruiterPhone: "+1-555-0606",
      location: "Atlanta, GA",
      jobType: "contract",
      jobSubType: "c2c",
      salaryMin: null,
      salaryMax: null,
      payPerHour: 85,
      skillsRequired: ["Salesforce", "Apex", "LWC", "SOQL", "REST API"],
      experienceRequired: 3,
      isActive: true,
    },
    {
      title: "Technical Project Manager",
      description:
        "Lead cross-functional agile teams building SaaS products. PMP or CSM certification and engineering background required.",
      vendorId: PAULA_ID,
      vendorEmail: "paula@talentedge.io",
      recruiterName: "Paula Kim",
      recruiterPhone: "+1-555-0606",
      location: "Remote",
      jobType: "remote",
      jobSubType: "",
      salaryMin: 120000,
      salaryMax: 150000,
      payPerHour: 75,
      skillsRequired: [
        "Agile",
        "Scrum",
        "JIRA",
        "Confluence",
        "Risk Management",
      ],
      experienceRequired: 6,
      isActive: true,
    },

    // ── Quinn Adams @ StaffPlus (2 jobs) ──
    {
      title: "WordPress / PHP Developer",
      description:
        "Build custom WordPress themes and plugins using PHP, ACF, and WooCommerce for e-commerce clients.",
      vendorId: QUINN_ID,
      vendorEmail: "quinn@staffplus.com",
      recruiterName: "Quinn Adams",
      recruiterPhone: "+1-555-0707",
      location: "Miami, FL",
      jobType: "part_time",
      jobSubType: "",
      salaryMin: 55000,
      salaryMax: 75000,
      payPerHour: 40,
      skillsRequired: [
        "PHP",
        "WordPress",
        "MySQL",
        "WooCommerce",
        "JavaScript",
      ],
      experienceRequired: 2,
      isActive: true,
    },
    {
      title: "Blockchain / Solidity Developer",
      description:
        "Develop smart contracts on Ethereum and Layer-2 networks. Solidity, Hardhat, and DeFi protocol experience.",
      vendorId: QUINN_ID,
      vendorEmail: "quinn@staffplus.com",
      recruiterName: "Quinn Adams",
      recruiterPhone: "+1-555-0707",
      location: "Remote",
      jobType: "remote",
      jobSubType: "",
      salaryMin: 140000,
      salaryMax: 190000,
      payPerHour: 100,
      skillsRequired: ["Solidity", "Ethereum", "Hardhat", "Web3.js", "DeFi"],
      experienceRequired: 3,
      isActive: true,
    },
  ]);
  console.log(`Created ${jobs.length} jobs`);

  // ═══════════════════════════════════════════
  // CANDIDATE PROFILES (10)
  // ═══════════════════════════════════════════
  const profiles = await ProfileModel.insertMany([
    {
      candidateId: ALICE_ID,
      username: "alice-johnson-3458c1",
      name: "Alice Johnson",
      email: "alice@example.com",
      phone: "+1-555-1001",
      currentCompany: "StartupX",
      currentRole: "Frontend Engineer",
      preferredJobType: "full_time",
      expectedHourlyRate: 60,
      experienceYears: 5,
      skills: ["React", "TypeScript", "Redux", "Node.js", "CSS", "Webpack"],
      location: "Austin, TX",
      bio: "Passionate frontend engineer with 5 years building React SPA and MFE architectures. Open to senior roles.",
      resumeSummary:
        "Results-driven Frontend Engineer with 5 years of experience designing and building high-performance React applications. Expertise in micro-frontend architectures using Webpack 5 Module Federation, state management with Redux Toolkit, and end-to-end TypeScript development. Proven track record delivering production-grade SPAs serving 100K+ monthly users.",
      resumeExperience:
        "Frontend Engineer — StartupX (2023–Present)\n• Led migration from monolithic CRA app to Module Federation micro-frontend architecture\n• Reduced initial load time by 42% through code-splitting and lazy-loading strategies\n• Built shared component library used across 4 independent MFE teams\n\nReact Developer — WebFlow Inc. (2021–2023)\n• Developed customer-facing dashboard with real-time WebSocket data feeds\n• Implemented design system with 60+ reusable components in Storybook\n• Mentored 2 junior developers through code reviews and pair programming",
      resumeEducation:
        "B.S. Computer Science — University of Texas at Austin (2019)\nRelevant Coursework: Data Structures, Web Development, Software Engineering, HCI",
      resumeAchievements:
        "• AWS Certified Cloud Practitioner (2023)\n• Speaker at ReactConf Austin 2024 — 'Scaling MFE Architectures'\n• Open-source contributor to Webpack Module Federation plugin",
      profileLocked: true,
      visibilityConfig: { full_time: ["w2", "c2h"], contract: ["c2c"] },
    },
    {
      candidateId: BOB_ID,
      username: "bob-smith-b444f8",
      name: "Bob Smith",
      email: "bob@example.com",
      phone: "+1-555-1002",
      currentCompany: "FreelanceOps",
      currentRole: "Python Developer",
      preferredJobType: "remote",
      expectedHourlyRate: 50,
      experienceYears: 3,
      skills: ["Python", "Django", "REST API", "PostgreSQL", "Docker", "Redis"],
      location: "Remote",
      bio: "Backend developer specializing in Python microservices and REST API design. Django expert.",
      resumeSummary:
        "Python Backend Developer with 3 years of hands-on experience building scalable REST APIs and microservices. Proficient in Django, Flask, PostgreSQL, and containerized deployments with Docker. Strong advocate for clean architecture and test-driven development.",
      resumeExperience:
        "Python Developer — FreelanceOps (2023–Present)\n• Designed and deployed 12 RESTful microservices handling 500K+ API calls/day\n• Implemented Redis caching layer reducing average response time from 320ms to 45ms\n• Set up CI/CD pipeline with GitHub Actions and Docker Compose\n\nJunior Backend Developer — CodeBaseCo (2021–2023)\n• Built Django admin dashboards for internal operations teams\n• Wrote unit and integration tests achieving 92% code coverage\n• Migrated legacy PHP endpoints to Django REST Framework",
      resumeEducation:
        "B.S. Information Technology — Georgia Tech (2021)\nOnline Certificate: Python for Data Science — Coursera (2022)",
      resumeAchievements:
        "• Published 'Async Python Patterns' article on Dev.to — 8K views\n• Django REST Framework contributor (3 merged PRs)\n• Winner, HackGT 2020 — Best Backend Architecture",
      profileLocked: true,
      visibilityConfig: {},
    },
    {
      candidateId: CAROL_ID,
      username: "carol-davis-3f7616",
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
      resumeSummary:
        "Full Stack Developer with 6 years of experience building end-to-end web applications using Node.js, React, and MongoDB. Skilled in TypeScript, AWS cloud services, and agile development. Comfortable owning features from database design through frontend delivery.",
      resumeExperience:
        "Full Stack Developer — DevAgency (2022–Present)\n• Built real-time collaboration platform using Socket.io, React, and MongoDB\n• Architected serverless API layer on AWS Lambda reducing hosting costs by 60%\n• Led 4-person team delivering client projects on 2-week sprint cycles\n\nSoftware Engineer — NexGen Solutions (2019–2022)\n• Developed e-commerce platform processing $2M+ in monthly transactions\n• Implemented GraphQL API layer replacing 40+ REST endpoints\n• Integrated Stripe payments, SendGrid email, and Twilio SMS services",
      resumeEducation:
        "B.S. Computer Science — UC Berkeley (2018)\nM.S. Software Engineering — Stanford (2019, incomplete — joined industry)",
      resumeAchievements:
        "• AWS Solutions Architect Associate (2023)\n• Node.js certified developer (OpenJS Foundation)\n• Open-source maintainer of express-mongo-starter (1.2K GitHub stars)",
      profileLocked: true,
      visibilityConfig: { contract: ["c2c", "c2h", "w2"] },
    },
    {
      candidateId: GRACE_ID,
      username: "grace-lee-a1b2c3",
      name: "Grace Lee",
      email: "grace@devmail.com",
      phone: "+1-555-1004",
      currentCompany: "DataViz Inc.",
      currentRole: "Data Engineer",
      preferredJobType: "full_time",
      expectedHourlyRate: 65,
      experienceYears: 4,
      skills: ["Python", "Spark", "Airflow", "SQL", "AWS", "Kafka"],
      location: "Seattle, WA",
      bio: "Data engineer building large-scale ETL pipelines. Experienced with Spark and real-time streaming.",
      resumeSummary:
        "Data Engineer with 4 years of experience designing and operating large-scale ETL pipelines. Expert in Apache Spark, Airflow, and AWS data services. Processed datasets exceeding 10TB daily with 99.9% pipeline reliability.",
      resumeExperience:
        "Data Engineer — DataViz Inc. (2022–Present)\n• Built and maintained 30+ Airflow DAGs processing 10TB of daily clickstream data\n• Migrated batch Spark jobs to Spark Structured Streaming, reducing latency from hours to minutes\n• Designed data lake architecture on S3 with Glue Catalog and Athena query layer\n\nJunior Data Engineer — AnalyticsCorp (2020–2022)\n• Wrote Python ETL scripts ingesting data from 15+ third-party APIs\n• Built Kafka consumers for real-time event processing pipeline\n• Created monitoring dashboards in Grafana tracking pipeline health metrics",
      resumeEducation:
        "M.S. Data Science — University of Washington (2020)\nB.S. Mathematics — UCLA (2018)",
      resumeAchievements:
        "• AWS Certified Data Analytics Specialty (2023)\n• Speaker at DataEngConf Seattle 2024 — 'Streaming at Scale with Spark'\n• Published research on optimizing Spark shuffle operations",
      profileLocked: true,
      visibilityConfig: { full_time: ["w2"] },
    },
    {
      candidateId: HANK_ID,
      username: "hank-patel-a1b2c3",
      name: "Hank Patel",
      email: "hank@coderz.io",
      phone: "+1-555-1005",
      currentCompany: "MobileLab",
      currentRole: "Mobile Developer",
      preferredJobType: "contract",
      expectedHourlyRate: 55,
      experienceYears: 3,
      skills: [
        "React Native",
        "TypeScript",
        "Swift",
        "Android",
        "Redux",
        "Firebase",
      ],
      location: "Chicago, IL",
      bio: "Cross-platform mobile developer who ships both iOS and Android. React Native and Swift.",
      resumeSummary:
        "Mobile Developer with 3 years building cross-platform apps using React Native and native iOS with Swift. Shipped 5 production apps on both App Store and Google Play. Experienced with offline-first architectures, push notifications, and Firebase backend services.",
      resumeExperience:
        "Mobile Developer — MobileLab (2023–Present)\n• Built React Native fitness app with 50K+ downloads and 4.7-star rating\n• Implemented offline-first sync engine using WatermelonDB and custom conflict resolution\n• Integrated Apple HealthKit and Google Fit APIs for biometric data tracking\n\nJunior iOS Developer — AppWorks Studio (2021–2023)\n• Developed 3 client iOS apps using Swift and UIKit\n• Migrated legacy Objective-C codebase to Swift with zero downtime\n• Set up Fastlane CI/CD for automated TestFlight distributions",
      resumeEducation:
        "B.S. Computer Science — University of Illinois at Chicago (2021)",
      resumeAchievements:
        "• Published 'React Native Performance Patterns' on Medium — 12K reads\n• Apple WWDC 2023 Student Scholar\n• Winner, Chicago Hackathon 2022 — Best Mobile App",
      profileLocked: true,
      visibilityConfig: { contract: ["c2h", "w2"] },
    },
    {
      candidateId: IRENE_ID,
      username: "irene-garcia-a1b2c3",
      name: "Irene Garcia",
      email: "irene@webdev.com",
      phone: "+1-555-1006",
      currentCompany: "CloudScale",
      currentRole: "DevOps Engineer",
      preferredJobType: "full_time",
      expectedHourlyRate: 80,
      experienceYears: 7,
      skills: [
        "AWS",
        "Kubernetes",
        "Docker",
        "Terraform",
        "CI/CD",
        "Linux",
        "Prometheus",
      ],
      location: "Denver, CO",
      bio: "Senior DevOps engineer with 7 years managing cloud infrastructure at scale. AWS Certified.",
      resumeSummary:
        "Senior DevOps Engineer with 7 years of experience building and managing cloud infrastructure for high-traffic platforms. Expert in AWS, Kubernetes, Terraform, and CI/CD pipeline design. Achieved 99.99% uptime across production clusters serving 5M+ requests/day.",
      resumeExperience:
        "DevOps Engineer — CloudScale (2021–Present)\n• Managed 12 Kubernetes clusters across 3 AWS regions with 99.99% uptime\n• Designed IaC framework with Terraform modules adopted by 6 engineering teams\n• Built observability stack (Prometheus + Grafana + PagerDuty) reducing MTTR from 45min to 8min\n\nSystems Engineer — InfraCore (2018–2021)\n• Migrated 200+ EC2 instances to containerized EKS workloads\n• Implemented GitOps workflow with ArgoCD for 40+ microservices\n• Automated security patching pipeline reducing vulnerability window from 30 days to 48 hours",
      resumeEducation:
        "B.S. Computer Engineering — Colorado School of Mines (2017)\nAWS Solutions Architect Professional — Amazon (2022)",
      resumeAchievements:
        "• AWS Certified Solutions Architect Professional + DevOps Engineer Professional\n• HashiCorp Certified Terraform Associate\n• KubeCon 2024 speaker — 'Zero-Downtime Migrations at Scale'\n• Reduced cloud spend by $180K/year through right-sizing and spot instances",
      profileLocked: true,
      visibilityConfig: { full_time: ["w2", "c2h"] },
    },
    {
      candidateId: JACK_ID,
      username: "jack-thompson-a1b2c3",
      name: "Jack Thompson",
      email: "jack@stackhire.com",
      phone: "+1-555-1007",
      currentCompany: "EnterpriseSoft",
      currentRole: "Java Developer",
      preferredJobType: "full_time",
      expectedHourlyRate: 62,
      experienceYears: 5,
      skills: [
        "Java",
        "Spring Boot",
        "Kafka",
        "Microservices",
        "PostgreSQL",
        "Docker",
      ],
      location: "Dallas, TX",
      bio: "Backend Java developer focused on event-driven microservices. Spring Boot and Kafka specialist.",
      resumeSummary:
        "Backend Java Developer with 5 years building enterprise-grade microservices using Spring Boot, Apache Kafka, and PostgreSQL. Experienced in event-driven architecture, domain-driven design, and high-throughput transaction processing systems.",
      resumeExperience:
        "Java Developer — EnterpriseSoft (2022–Present)\n• Designed event-driven order processing system handling 100K transactions/hour via Kafka\n• Built 8 Spring Boot microservices with shared contract-first OpenAPI specifications\n• Implemented saga pattern for distributed transactions across payment and inventory services\n\nSoftware Engineer — FinTechBridge (2019–2022)\n• Developed real-time fraud detection service processing 50K events/second\n• Migrated monolithic Spring MVC app to Spring Boot microservices architecture\n• Built comprehensive integration test suite using Testcontainers and WireMock",
      resumeEducation:
        "B.S. Computer Science — University of Texas at Dallas (2019)\nOracle Certified Professional Java SE 17 Developer (2023)",
      resumeAchievements:
        "• Oracle Certified Professional Java SE 17\n• Spring Certified Professional (VMware)\n• Authored internal 'Kafka Best Practices' guide adopted company-wide\n• Reduced P95 latency by 70% through connection pool optimization",
      profileLocked: true,
      visibilityConfig: { full_time: ["w2", "c2h"] },
    },
    {
      candidateId: KAREN_ID,
      username: "karen-white-a1b2c3",
      name: "Karen White",
      email: "karen@datapro.net",
      phone: "+1-555-1008",
      currentCompany: "AIFirst Labs",
      currentRole: "ML Engineer",
      preferredJobType: "full_time",
      expectedHourlyRate: 90,
      experienceYears: 5,
      skills: [
        "Python",
        "PyTorch",
        "TensorFlow",
        "NLP",
        "MLflow",
        "SQL",
        "Scikit-learn",
      ],
      location: "San Francisco, CA",
      bio: "Machine learning engineer building NLP and recommendation systems. Published researcher.",
      resumeSummary:
        "Machine Learning Engineer with 5 years of experience building production NLP and recommendation systems. Expert in PyTorch, TensorFlow, and MLOps with MLflow. Published researcher with models serving 1M+ daily predictions in production.",
      resumeExperience:
        "ML Engineer — AIFirst Labs (2022–Present)\n• Built talent-matching recommendation engine achieving 85% precision at top-10\n• Deployed NLP classification pipeline processing 500K resumes/month using BERT fine-tuning\n• Designed A/B testing framework for model evaluation reducing experiment cycle from 2 weeks to 2 days\n\nData Scientist — PredictiveAI (2020–2022)\n• Developed sentiment analysis model for customer support tickets (F1: 0.91)\n• Built real-time feature store using Redis and Apache Flink\n• Created model monitoring dashboard tracking drift, latency, and accuracy metrics",
      resumeEducation:
        "Ph.D. Machine Learning — Stanford University (2020)\nB.S. Mathematics & Computer Science — MIT (2016)",
      resumeAchievements:
        "• Published 3 papers at NeurIPS and EMNLP conferences\n• Google Scholar h-index: 8\n• Patent holder: 'Method for Real-Time Resume Skill Extraction' (pending)\n• Kaggle Competition Master (top 1%)",
      profileLocked: true,
      visibilityConfig: { full_time: ["w2"] },
    },
    {
      candidateId: LEO_ID,
      username: "leo-martinez-a1b2c3",
      name: "Leo Martinez",
      email: "leo@cloudops.dev",
      phone: "+1-555-1009",
      currentCompany: "WebWorks",
      currentRole: "Frontend Developer",
      preferredJobType: "remote",
      expectedHourlyRate: 45,
      experienceYears: 2,
      skills: ["Angular", "TypeScript", "RxJS", "SCSS", "JavaScript", "HTML"],
      location: "Remote",
      bio: "Frontend developer with Angular expertise. Eager to grow into full stack roles.",
      resumeSummary:
        "Frontend Developer with 2 years of experience building enterprise dashboards and SPAs using Angular, TypeScript, and RxJS. Quick learner eager to expand into full stack development. Strong foundation in responsive design and accessibility.",
      resumeExperience:
        "Frontend Developer — WebWorks (2024–Present)\n• Built Angular 16 dashboard for fleet management SaaS serving 200+ enterprise clients\n• Implemented NgRx state management reducing prop-drilling bugs by 80%\n• Created reusable component library with 25+ Angular Material-based components\n\nJunior Web Developer — DigitalCraft (2022–2024)\n• Developed responsive marketing sites for 10+ clients using HTML, CSS, and JavaScript\n• Migrated jQuery-based legacy app to Angular 14 with TypeScript\n• Wrote Jasmine/Karma unit tests achieving 85% code coverage",
      resumeEducation:
        "B.S. Computer Science — Florida International University (2022)",
      resumeAchievements:
        "• Angular certified developer (Google)\n• Contributed to Angular Material open-source library\n• Dean's List, FIU College of Engineering (2020–2022)",
      profileLocked: true,
      visibilityConfig: {},
    },
    {
      candidateId: MIA_ID,
      username: "mia-robinson-a1b2c3",
      name: "Mia Robinson",
      email: "mia@appforge.io",
      phone: "+1-555-1010",
      currentCompany: "CryptoVentures",
      currentRole: "Blockchain Developer",
      preferredJobType: "remote",
      expectedHourlyRate: 95,
      experienceYears: 4,
      skills: [
        "Solidity",
        "Ethereum",
        "Hardhat",
        "Web3.js",
        "React",
        "TypeScript",
      ],
      location: "Remote",
      bio: "Blockchain developer specializing in DeFi protocols and smart contract security audits.",
      resumeSummary:
        "Blockchain Developer with 4 years of experience building DeFi protocols, smart contracts, and Web3 applications on Ethereum and Layer-2 networks. Audited 20+ smart contracts with zero post-audit exploits. Dual expertise in Solidity backend and React/TypeScript frontend development.",
      resumeExperience:
        "Blockchain Developer — CryptoVentures (2022–Present)\n• Architected DeFi lending protocol with $15M TVL on Ethereum mainnet\n• Wrote and deployed 30+ Solidity smart contracts with 100% test coverage via Hardhat\n• Built React/TypeScript dApp frontend with Web3.js wallet integration (MetaMask, WalletConnect)\n\nSmart Contract Engineer — ChainSecure (2020–2022)\n• Conducted security audits for 20+ DeFi protocols identifying 45 critical vulnerabilities\n• Developed automated fuzzing tool for smart contract testing using Echidna\n• Created gas optimization patterns reducing contract deployment costs by 35%",
      resumeEducation:
        "B.S. Computer Science — Carnegie Mellon University (2020)\nBlockchain Specialization — Coursera / University of Buffalo (2021)",
      resumeAchievements:
        "• Certified Ethereum Developer (ConsenSys Academy)\n• ETHGlobal 2023 Finalist — 'Cross-Chain Bridge Protocol'\n• Published 'Gas Optimization Patterns in Solidity' — 15K reads on Mirror.xyz\n• Bug bounty: discovered critical reentrancy vulnerability in top-50 DeFi protocol ($25K reward)",
      profileLocked: true,
      visibilityConfig: { contract: ["c2c"], full_time: ["w2"] },
    },
  ]);
  console.log(`Created ${profiles.length} candidate profiles`);

  // ═══════════════════════════════════════════
  // APPLICATIONS (25)
  // ═══════════════════════════════════════════
  const j = (i: number) => (jobs[i] as any)._id.toString();
  const jt = (i: number) => (jobs[i] as any).title;

  const appDocs = await AppModel.insertMany([
    // Alice applies to 3 jobs
    {
      jobId: j(0),
      jobTitle: jt(0),
      candidateId: ALICE_ID,
      candidateEmail: "alice@example.com",
      coverLetter:
        "I am a great fit — I have built MFE architectures similar to your stack.",
      status: "shortlisted",
    },
    {
      jobId: j(3),
      jobTitle: jt(3),
      candidateId: ALICE_ID,
      candidateEmail: "alice@example.com",
      coverLetter: "Full stack is my passion. Node + React is my daily driver.",
      status: "reviewing",
    },
    {
      jobId: j(10),
      jobTitle: jt(10),
      candidateId: ALICE_ID,
      candidateEmail: "alice@example.com",
      coverLetter:
        "I have Angular experience too and would love to broaden my frontend skills.",
      status: "pending",
    },

    // Bob applies to 3 jobs
    {
      jobId: j(1),
      jobTitle: jt(1),
      candidateId: BOB_ID,
      candidateEmail: "bob@example.com",
      coverLetter:
        "3 years of Django experience and ready to contribute to your backend team.",
      status: "reviewing",
    },
    {
      jobId: j(7),
      jobTitle: jt(7),
      candidateId: BOB_ID,
      candidateEmail: "bob@example.com",
      coverLetter:
        "My Python and SQL skills align perfectly with this data engineering role.",
      status: "pending",
    },
    {
      jobId: j(11),
      jobTitle: jt(11),
      candidateId: BOB_ID,
      candidateEmail: "bob@example.com",
      coverLetter:
        "I have experience with Go from personal projects and want to transition full-time.",
      status: "pending",
    },

    // Carol applies to 3 jobs
    {
      jobId: j(3),
      jobTitle: jt(3),
      candidateId: CAROL_ID,
      candidateEmail: "carol@example.com",
      coverLetter:
        "Building hiring platforms is my passion. Can hit the ground running.",
      status: "pending",
    },
    {
      jobId: j(0),
      jobTitle: jt(0),
      candidateId: CAROL_ID,
      candidateEmail: "carol@example.com",
      coverLetter: "TypeScript and Redux are my strongest skills.",
      status: "shortlisted",
    },
    {
      jobId: j(8),
      jobTitle: jt(8),
      candidateId: CAROL_ID,
      candidateEmail: "carol@example.com",
      coverLetter:
        "I have a strong eye for design and experience with Figma + React.",
      status: "reviewing",
    },

    // Grace applies to 2 jobs
    {
      jobId: j(7),
      jobTitle: jt(7),
      candidateId: GRACE_ID,
      candidateEmail: "grace@devmail.com",
      coverLetter:
        "Spark and Airflow are my core technologies. I built pipelines processing 10TB daily.",
      status: "shortlisted",
    },
    {
      jobId: j(5),
      jobTitle: jt(5),
      candidateId: GRACE_ID,
      candidateEmail: "grace@devmail.com",
      coverLetter:
        "ML models need clean data — I can bridge the gap between data eng and ML.",
      status: "pending",
    },

    // Hank applies to 2 jobs
    {
      jobId: j(6),
      jobTitle: jt(6),
      candidateId: HANK_ID,
      candidateEmail: "hank@coderz.io",
      coverLetter:
        "React Native is my specialty. I've shipped 5 apps on both stores.",
      status: "reviewing",
    },
    {
      jobId: j(13),
      jobTitle: jt(13),
      candidateId: HANK_ID,
      candidateEmail: "hank@coderz.io",
      coverLetter:
        "My Swift experience makes me a strong fit for native iOS development.",
      status: "pending",
    },

    // Irene applies to 3 jobs
    {
      jobId: j(4),
      jobTitle: jt(4),
      candidateId: IRENE_ID,
      candidateEmail: "irene@webdev.com",
      coverLetter:
        "7 years in DevOps with AWS Certified Solutions Architect certification.",
      status: "shortlisted",
    },
    {
      jobId: j(12),
      jobTitle: jt(12),
      candidateId: IRENE_ID,
      candidateEmail: "irene@webdev.com",
      coverLetter:
        "SRE is the natural evolution of my DevOps career. I live and breathe uptime.",
      status: "reviewing",
    },
    {
      jobId: j(14),
      jobTitle: jt(14),
      candidateId: IRENE_ID,
      candidateEmail: "irene@webdev.com",
      coverLetter:
        "Network security and OWASP are areas I've been deepening. Ready for this challenge.",
      status: "pending",
    },

    // Jack applies to 2 jobs
    {
      jobId: j(9),
      jobTitle: jt(9),
      candidateId: JACK_ID,
      candidateEmail: "jack@stackhire.com",
      coverLetter:
        "Spring Boot and Kafka are my bread and butter. 5 years enterprise experience.",
      status: "shortlisted",
    },
    {
      jobId: j(2),
      jobTitle: jt(2),
      candidateId: JACK_ID,
      candidateEmail: "jack@stackhire.com",
      coverLetter:
        "I've set up Cypress test suites for microservices — happy to bring that expertise.",
      status: "pending",
    },

    // Karen applies to 2 jobs
    {
      jobId: j(5),
      jobTitle: jt(5),
      candidateId: KAREN_ID,
      candidateEmail: "karen@datapro.net",
      coverLetter:
        "Published NLP researcher with production PyTorch models serving 1M+ users.",
      status: "shortlisted",
    },
    {
      jobId: j(7),
      jobTitle: jt(7),
      candidateId: KAREN_ID,
      candidateEmail: "karen@datapro.net",
      coverLetter:
        "Strong Python and SQL background. Data engineering is how I started my career.",
      status: "reviewing",
    },

    // Leo applies to 2 jobs
    {
      jobId: j(10),
      jobTitle: jt(10),
      candidateId: LEO_ID,
      candidateEmail: "leo@cloudops.dev",
      coverLetter:
        "Angular is my primary framework. RxJS reactive patterns are second nature.",
      status: "reviewing",
    },
    {
      jobId: j(17),
      jobTitle: jt(17),
      candidateId: LEO_ID,
      candidateEmail: "leo@cloudops.dev",
      coverLetter:
        "I have WordPress side projects and am proficient in PHP + JavaScript.",
      status: "pending",
    },

    // Mia applies to 3 jobs
    {
      jobId: j(18),
      jobTitle: jt(18),
      candidateId: MIA_ID,
      candidateEmail: "mia@appforge.io",
      coverLetter:
        "DeFi is my domain. I've audited 20+ smart contracts and built 3 protocols.",
      status: "shortlisted",
    },
    {
      jobId: j(0),
      jobTitle: jt(0),
      candidateId: MIA_ID,
      candidateEmail: "mia@appforge.io",
      coverLetter:
        "React and TypeScript are core to my Web3 frontend work. Happy to apply them in SaaS.",
      status: "pending",
    },
    {
      jobId: j(3),
      jobTitle: jt(3),
      candidateId: MIA_ID,
      candidateEmail: "mia@appforge.io",
      coverLetter:
        "Full stack Node + React — I use this stack alongside Solidity in dApp development.",
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
