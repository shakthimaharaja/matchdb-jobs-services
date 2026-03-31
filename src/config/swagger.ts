import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MatchDB Jobs Services API",
      version: "1.0.0",
      description:
        "Jobs, Candidate Profiles, Applications, Matching, Employer RBAC & Company Admin API for the MatchDB platform. Handles job postings, candidate profiles, skill-based matching, resume generation, employer operations, company user management, and candidate interactions.",
      contact: { name: "MatchDB Team" },
    },
    servers: [
      { url: "/api/jobs", description: "Default (relative)" },
      {
        url: "http://localhost:8001/api/jobs",
        description: "Local development",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ── Job ────────────────────────────────────────────────
        Job: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            job_type: {
              type: "string",
              enum: ["full_time", "part_time", "contract"],
            },
            job_subtype: {
              type: "string",
              enum: ["c2c", "c2h", "w2", "1099", "direct_hire", "salary"],
            },
            work_mode: { type: "string", enum: ["remote", "onsite", "hybrid"] },
            salary_min: { type: "number", nullable: true },
            salary_max: { type: "number", nullable: true },
            pay_per_hour: { type: "number", nullable: true },
            skills_required: { type: "array", items: { type: "string" } },
            experience_required: { type: "number" },
            recruiter_name: { type: "string" },
            recruiter_email: { type: "string" },
            recruiter_phone: { type: "string" },
            status: { type: "string", enum: ["active", "closed"] },
            vendor_id: { type: "string" },
            vendor_email: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateJobRequest: {
          type: "object",
          required: [
            "title",
            "description",
            "company",
            "location",
            "job_type",
            "skills_required",
            "experience_required",
          ],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            job_type: {
              type: "string",
              enum: ["full_time", "part_time", "contract"],
            },
            job_subtype: { type: "string" },
            work_mode: { type: "string", enum: ["remote", "onsite", "hybrid"] },
            salary_min: { type: "number" },
            salary_max: { type: "number" },
            pay_per_hour: { type: "number" },
            skills_required: { type: "array", items: { type: "string" } },
            experience_required: { type: "number" },
            recruiter_name: { type: "string" },
            recruiter_email: { type: "string" },
            recruiter_phone: { type: "string" },
          },
        },
        // ── Candidate Profile ─────────────────────────────────
        CandidateProfile: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user_id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            current_company: { type: "string" },
            current_role: { type: "string" },
            preferred_job_type: { type: "string" },
            expected_hourly_rate: { type: "number", nullable: true },
            experience_years: { type: "number" },
            skills: { type: "array", items: { type: "string" } },
            bio: { type: "string" },
            resume_summary: { type: "string" },
            resume_experience: { type: "string" },
            resume_education: { type: "string" },
            resume_achievements: { type: "string" },
            username: { type: "string" },
          },
        },
        UpsertProfileRequest: {
          type: "object",
          required: [
            "name",
            "email",
            "preferred_job_type",
            "experience_years",
            "skills",
          ],
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            current_company: { type: "string" },
            current_role: { type: "string" },
            preferred_job_type: { type: "string" },
            expected_hourly_rate: { type: "number" },
            experience_years: { type: "number" },
            skills: { type: "array", items: { type: "string" } },
            bio: { type: "string" },
            resume_summary: { type: "string" },
            resume_experience: { type: "string" },
            resume_education: { type: "string" },
            resume_achievements: { type: "string" },
          },
        },
        // ── Application ───────────────────────────────────────
        Application: {
          type: "object",
          properties: {
            _id: { type: "string" },
            job_id: { type: "string" },
            candidate_id: { type: "string" },
            candidate_email: { type: "string" },
            status: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Match ─────────────────────────────────────────────
        MatchResult: {
          type: "object",
          properties: {
            job: { $ref: "#/components/schemas/Job" },
            profile: { $ref: "#/components/schemas/CandidateProfile" },
            matchPercentage: { type: "number" },
          },
        },
        // ── Poke ──────────────────────────────────────────────
        PokeRequest: {
          type: "object",
          required: ["targetEmail"],
          properties: {
            targetEmail: { type: "string", format: "email" },
            message: { type: "string" },
          },
        },
        // ── Marketer ────────────────────────────────────────────
        Company: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            uid: { type: "string" },
            employer_email: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        RosterCandidate: {
          type: "object",
          properties: {
            id: { type: "string" },
            company_id: { type: "string" },
            candidate_name: { type: "string" },
            candidate_email: { type: "string" },
            invite_status: { type: "string" },
            invite_sent_at: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            poke_count: { type: "number" },
            email_count: { type: "number" },
            current_role: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            experience_years: { type: "number" },
            location: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // ── Financial ─────────────────────────────────────────
        Financial: {
          type: "object",
          properties: {
            id: { type: "string" },
            applicationId: { type: "string" },
            marketerId: { type: "string" },
            candidateId: { type: "string" },
            candidateEmail: { type: "string" },
            billRate: { type: "number" },
            payRate: { type: "number" },
            hoursWorked: { type: "number" },
            projectStart: { type: "string", format: "date", nullable: true },
            projectEnd: { type: "string", format: "date", nullable: true },
            stateCode: { type: "string" },
            stateTaxPct: { type: "number" },
            cashPct: { type: "number" },
            totalBilled: { type: "number" },
            totalPay: { type: "number" },
            taxAmount: { type: "number" },
            cashAmount: { type: "number" },
            netPayable: { type: "number" },
            amountPaid: { type: "number" },
            amountPending: { type: "number" },
            notes: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        UpsertFinancialRequest: {
          type: "object",
          required: [
            "applicationId",
            "billRate",
            "payRate",
            "hoursWorked",
            "stateCode",
            "cashPct",
            "amountPaid",
          ],
          properties: {
            applicationId: { type: "string" },
            candidateId: { type: "string" },
            candidateEmail: { type: "string" },
            billRate: { type: "number" },
            payRate: { type: "number" },
            hoursWorked: { type: "number" },
            projectStart: { type: "string", format: "date" },
            projectEnd: { type: "string", format: "date" },
            stateCode: { type: "string" },
            cashPct: { type: "number" },
            amountPaid: { type: "number" },
            notes: { type: "string" },
          },
        },
        // ── Timesheet ─────────────────────────────────────────
        Timesheet: {
          type: "object",
          properties: {
            _id: { type: "string" },
            candidateId: { type: "string" },
            candidateEmail: { type: "string" },
            candidateName: { type: "string" },
            weekStart: { type: "string", format: "date" },
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", format: "date" },
                  day: { type: "string" },
                  hoursWorked: { type: "number" },
                  notes: { type: "string" },
                },
              },
            },
            status: {
              type: "string",
              enum: ["draft", "submitted", "approved"],
            },
            submittedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            approvedAt: { type: "string", format: "date-time", nullable: true },
            approverNotes: { type: "string", nullable: true },
          },
        },
        UpsertTimesheetRequest: {
          type: "object",
          required: ["weekStart", "entries"],
          properties: {
            weekStart: { type: "string", format: "date" },
            entries: {
              type: "array",
              items: {
                type: "object",
                required: ["date", "day", "hoursWorked"],
                properties: {
                  date: { type: "string", format: "date" },
                  day: { type: "string" },
                  hoursWorked: { type: "number" },
                  notes: { type: "string" },
                },
              },
            },
            candidateName: { type: "string" },
          },
        },
        // ── Interview ─────────────────────────────────────────
        InterviewInvite: {
          type: "object",
          properties: {
            _id: { type: "string" },
            vendorId: { type: "string" },
            vendorEmail: { type: "string" },
            candidateEmail: { type: "string" },
            candidateName: { type: "string" },
            jobId: { type: "string" },
            jobTitle: { type: "string" },
            proposedAt: { type: "string", format: "date-time" },
            meetLink: { type: "string" },
            message: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "accepted", "declined"],
            },
            respondedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            candidateNote: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Poke ──────────────────────────────────────────────
        PokeRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            sender_id: { type: "string" },
            sender_name: { type: "string" },
            sender_email: { type: "string" },
            sender_type: { type: "string" },
            target_id: { type: "string" },
            target_vendor_id: { type: "string" },
            target_email: { type: "string" },
            target_name: { type: "string" },
            subject: { type: "string" },
            is_email: { type: "boolean" },
            job_id: { type: "string" },
            job_title: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // ── Forwarded Opening ─────────────────────────────────
        ForwardedOpening: {
          type: "object",
          properties: {
            id: { type: "string" },
            candidate_email: { type: "string" },
            candidate_name: { type: "string" },
            job_id: { type: "string" },
            job_title: { type: "string" },
            job_location: { type: "string" },
            job_type: { type: "string" },
            job_sub_type: { type: "string" },
            vendor_email: { type: "string" },
            note: { type: "string" },
            status: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        // ── Misc ──────────────────────────────────────────────
        CountResponse: {
          type: "object",
          properties: { count: { type: "number" } },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        // ── RBAC ──────────────────────────────────────────────
        CompanyAdmin: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            companyName: { type: "string" },
            adminUserId: { type: "string" },
            adminEmail: { type: "string" },
            adminName: { type: "string" },
            subscriptionPlanId: { type: "string", nullable: true },
            seatLimit: { type: "number" },
            seatsUsed: { type: "number" },
          },
        },
        CompanyUser: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            userId: { type: "string" },
            workerId: { type: "string" },
            email: { type: "string" },
            fullName: { type: "string" },
            phone: { type: "string" },
            designation: { type: "string" },
            role: {
              type: "string",
              enum: ["admin", "manager", "vendor", "marketer"],
            },
            department: {
              type: "string",
              enum: ["accounts", "immigration", "placement"],
              nullable: true,
            },
            permissions: { type: "array", items: { type: "string" } },
            status: {
              type: "string",
              enum: ["active", "invited", "deactivated"],
            },
            onlineStatus: {
              type: "string",
              enum: ["online", "away", "offline"],
            },
            joinedAt: { type: "string", format: "date-time" },
          },
        },
        EmployeeInvitation: {
          type: "object",
          properties: {
            id: { type: "string" },
            companyId: { type: "string" },
            invitedByAdminId: { type: "string" },
            inviteeEmail: { type: "string" },
            inviteeName: { type: "string" },
            assignedRole: {
              type: "string",
              enum: ["admin", "manager", "vendor", "marketer"],
            },
            assignedDepartment: { type: "string", nullable: true },
            token: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "accepted", "expired", "revoked"],
            },
            expiresAt: { type: "string", format: "date-time" },
            usedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        SubscriptionPlan: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            maxJobPostings: { type: "number", nullable: true },
            maxCandidates: { type: "number", nullable: true },
            maxWorkers: { type: "number", nullable: true },
            priceMonthly: { type: "number" },
            priceYearly: { type: "number" },
            extraAdminFee: { type: "number" },
            isActive: { type: "boolean" },
          },
        },
        ClientCompany: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            employerId: { type: "string" },
          },
        },
        VendorCompany: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            employerId: { type: "string" },
          },
        },
      },
    },
    // ── Paths ──────────────────────────────────────────────────
    paths: {
      // ===== PUBLIC ================================================
      "/": {
        get: {
          tags: ["Public"],
          summary: "List all active jobs",
          parameters: [
            {
              name: "type",
              in: "query",
              schema: { type: "string" },
              description: "Filter by job_type",
            },
            {
              name: "subtype",
              in: "query",
              schema: { type: "string" },
              description: "Filter by job_subtype",
            },
          ],
          responses: {
            200: {
              description: "List of jobs",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
          },
        },
      },
      "/profiles-public": {
        get: {
          tags: ["Public"],
          summary: "List publicly visible candidate profiles",
          responses: {
            200: {
              description: "Public profiles",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CandidateProfile" },
                  },
                },
              },
            },
          },
        },
      },
      // ===== CANDIDATE ROUTES ======================================
      "/my-applications": {
        get: {
          tags: ["Candidate"],
          summary: "List jobs the candidate has applied to",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Application list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Application" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/jobmatches": {
        get: {
          tags: ["Candidate"],
          summary: "Get skill-matched jobs ranked for the candidate",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Matched jobs with scores",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/MatchResult" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/profile": {
        get: {
          tags: ["Profile"],
          summary: "Get current user profile",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Profile data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" },
          },
        },
        post: {
          tags: ["Profile"],
          summary: "Create candidate profile",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertProfileRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Profile created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            401: { description: "Unauthorized" },
            409: { description: "Profile already exists" },
          },
        },
        put: {
          tags: ["Profile"],
          summary: "Update candidate profile",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertProfileRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Profile updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" },
          },
        },
        delete: {
          tags: ["Profile"],
          summary: "Delete candidate profile",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Profile deleted" },
            401: { description: "Unauthorized" },
          },
        },
      },
      // ===== VENDOR ROUTES =========================================
      "/vendor": {
        get: {
          tags: ["Vendor"],
          summary: "List jobs posted by the current vendor",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Vendor job list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/profilematches": {
        get: {
          tags: ["Vendor"],
          summary: "Get skill-matched candidates ranked for vendor jobs",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "jobId",
              in: "query",
              schema: { type: "string" },
              description: "Filter matches for a specific job",
            },
          ],
          responses: {
            200: {
              description: "Matched candidates with scores",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/MatchResult" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/create": {
        post: {
          tags: ["Vendor"],
          summary: "Create a new job posting",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateJobRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Job created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            401: { description: "Unauthorized" },
            403: { description: "Job posting limit reached" },
          },
        },
      },
      // ===== SHARED ================================================
      "/poke": {
        post: {
          tags: ["Shared"],
          summary: "Send a poke (interest notification) to another user",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PokeRequest" },
              },
            },
          },
          responses: {
            200: { description: "Poke sent" },
            401: { description: "Unauthorized" },
            429: { description: "Poke limit exceeded" },
          },
        },
      },
      // ===== RESUME (PUBLIC) =======================================
      "/resume/{username}": {
        get: {
          tags: ["Resume"],
          summary: "Get public resume profile by username",
          parameters: [
            {
              name: "username",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Profile data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            404: { description: "Profile not found" },
          },
        },
      },
      "/resume/{username}/download": {
        get: {
          tags: ["Resume"],
          summary: "Download resume as text file",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "username",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Resume text file",
              content: { "text/plain": { schema: { type: "string" } } },
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" },
          },
        },
      },
      // ===== PARAMETERIZED =========================================
      "/{id}": {
        get: {
          tags: ["Jobs"],
          summary: "Get a single job by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Job details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            404: { description: "Job not found" },
          },
        },
      },
      "/{id}/apply": {
        post: {
          tags: ["Candidate"],
          summary: "Apply to a job",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            201: {
              description: "Application submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Application" },
                },
              },
            },
            401: { description: "Unauthorized" },
            409: { description: "Already applied" },
          },
        },
      },
      "/{id}/close": {
        patch: {
          tags: ["Vendor"],
          summary: "Close (deactivate) a job posting",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Job closed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Job not found" },
          },
        },
      },
      "/{id}/reopen": {
        patch: {
          tags: ["Vendor"],
          summary: "Reopen a closed job posting",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Job reopened",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Job not found" },
          },
        },
      },
      // ===== ADDITIONAL PUBLIC =====================================
      "/count": {
        get: {
          tags: ["Public"],
          summary: "Count active jobs",
          responses: {
            200: {
              description: "Active job count",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CountResponse" },
                },
              },
            },
          },
        },
      },
      "/profiles-count": {
        get: {
          tags: ["Public"],
          summary: "Count candidate profiles",
          responses: {
            200: {
              description: "Profile count",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CountResponse" },
                },
              },
            },
          },
        },
      },
      "/candidate/my-detail": {
        get: {
          tags: ["Candidate"],
          summary:
            "Get current candidate's full detail (profile, projects, forwards, activity)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Candidate detail object" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/pokes/sent": {
        get: {
          tags: ["Shared"],
          summary: "List pokes sent by current user (up to 200)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Sent pokes",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/PokeRecord" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/pokes/received": {
        get: {
          tags: ["Shared"],
          summary: "List pokes received by current user (up to 200)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Received pokes",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/PokeRecord" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      // ===== COMPANIES (app.ts inline) =============================
      "/companies": {
        get: {
          tags: ["Public"],
          summary: "List all companies (for registration dropdowns)",
          responses: {
            200: {
              description: "Company list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Company" },
                  },
                },
              },
            },
          },
        },
      },
      "/companies/search": {
        get: {
          tags: ["Public"],
          summary: "Fuzzy search companies by name",
          parameters: [
            {
              name: "q",
              in: "query",
              schema: { type: "string" },
              description: "Search term",
            },
          ],
          responses: {
            200: {
              description: "Matching companies",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Company" },
                  },
                },
              },
            },
          },
        },
      },
      // ===== INVITES (app.ts inline) ===============================
      "/invite/{token}": {
        get: {
          tags: ["Invites"],
          summary: "Verify an invite token",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Invite details" },
            404: { description: "Invalid or expired token" },
          },
        },
      },
      "/invite/{token}/accept": {
        post: {
          tags: ["Invites"],
          summary: "Accept an invite",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Invite accepted" },
            401: { description: "Unauthorized" },
            404: { description: "Invalid or expired token" },
          },
        },
      },
      "/candidate/forwarded": {
        get: {
          tags: ["Candidate"],
          summary: "List job openings forwarded to the candidate by marketers",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Forwarded openings",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ForwardedOpening" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/events": {
        get: {
          tags: ["Realtime"],
          summary: "Server-Sent Events stream for real-time dashboard updates",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "SSE text/event-stream" },
          },
        },
      },
      // ===== MARKETER ROUTES =======================================
      "/marketer/stats": {
        get: {
          tags: ["Employer"],
          summary: "Get employer dashboard stats",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description:
                "Dashboard statistics with job/profile/placement counts",
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/jobs": {
        get: {
          tags: ["Employer"],
          summary: "List all managed jobs (paginated)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50, maximum: 100 },
            },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
              description: "Filter by title, location, skills",
            },
          ],
          responses: {
            200: { description: "Paginated job list with counts" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/profiles": {
        get: {
          tags: ["Employer"],
          summary: "List all managed candidate profiles (paginated)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50, maximum: 100 },
            },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
              description: "Filter by name, role, company, skills",
            },
          ],
          responses: {
            200: { description: "Paginated profile list" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/company": {
        get: {
          tags: ["Employer"],
          summary: "Get employer's company",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Company or null",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Company" },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["Employer"],
          summary: "Register a company",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Company created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Company" },
                },
              },
            },
            400: { description: "Missing name" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/company-summary": {
        get: {
          tags: ["Employer"],
          summary:
            "Get full company summary (candidates, projects, financials, totals)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description:
                "Full company summary with candidates, projects, domain counts, and totals",
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/candidates": {
        get: {
          tags: ["Employer"],
          summary: "List company roster candidates",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Roster list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/RosterCandidate" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["Employer"],
          summary: "Add candidate to company roster",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["candidateEmail"],
                  properties: {
                    candidateName: { type: "string" },
                    candidateEmail: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Candidate added",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RosterCandidate" },
                },
              },
            },
            400: { description: "Missing email or no company" },
            401: { description: "Unauthorized" },
            409: { description: "Duplicate candidate" },
          },
        },
      },
      "/marketer/candidates/{id}/detail": {
        get: {
          tags: ["Employer"],
          summary:
            "Get full candidate detail (profile, projects, forwards, vendor activity)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description:
                "Candidate detail with roster, profile, projects, forwarded openings, vendor activity",
            },
            401: { description: "Unauthorized" },
            404: { description: "Candidate not found" },
          },
        },
      },
      "/marketer/candidates/{id}": {
        delete: {
          tags: ["Employer"],
          summary: "Remove candidate from roster",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Deleted" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/candidates/{id}/invite": {
        post: {
          tags: ["Employer"],
          summary: "Send invite to a roster candidate",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { offerNote: { type: "string" } },
                },
              },
            },
          },
          responses: {
            200: { description: "Invite sent with token and link" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/forward": {
        post: {
          tags: ["Employer"],
          summary: "Forward a job opening to a roster candidate",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["candidateEmail", "jobId"],
                  properties: {
                    candidateEmail: { type: "string" },
                    jobId: { type: "string" },
                    note: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Opening forwarded",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ForwardedOpening" },
                },
              },
            },
            400: { description: "Missing fields" },
            401: { description: "Unauthorized" },
            403: { description: "Candidate not in roster" },
            404: { description: "Job not found" },
            409: { description: "Already forwarded" },
          },
        },
      },
      "/marketer/forward-with-email": {
        post: {
          tags: ["Employer"],
          summary: "Forward a job opening with email notification",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["candidateEmail", "jobId"],
                  properties: {
                    candidateEmail: { type: "string" },
                    jobId: { type: "string" },
                    note: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Forwarded with email sent" },
            401: { description: "Unauthorized" },
            403: { description: "Not in roster" },
            404: { description: "Job not found" },
            409: { description: "Already forwarded" },
          },
        },
      },
      "/marketer/forwarded": {
        get: {
          tags: ["Employer"],
          summary: "List all forwarded openings",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Forwarded openings list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ForwardedOpening" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/forwarded/{id}/status": {
        patch: {
          tags: ["Employer"],
          summary: "Update forwarded opening status",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: {
                      type: "string",
                      enum: [
                        "pending",
                        "applied",
                        "hired",
                        "declined",
                        "rejected",
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Status updated" },
            400: { description: "Invalid status" },
            401: { description: "Unauthorized" },
            404: { description: "Not found" },
          },
        },
      },
      // ===== FINANCIALS ROUTES =====================================
      "/marketer/financials/states": {
        get: {
          tags: ["Financials"],
          summary: "Get US state tax rates",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "State list with tax percentages",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code: { type: "string" },
                        name: { type: "string" },
                        taxPct: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/financials/summary": {
        get: {
          tags: ["Financials"],
          summary: "Get financial summary across all projects",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Aggregated financials" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/financials/candidate/{candidateId}": {
        get: {
          tags: ["Financials"],
          summary: "Get financials for a specific candidate",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "candidateId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Candidate financials array",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Financial" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/financials/{applicationId}": {
        get: {
          tags: ["Financials"],
          summary: "Get project financial record",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "applicationId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Financial record or null",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Financial" },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
        delete: {
          tags: ["Financials"],
          summary: "Delete project financial",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "applicationId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Deleted" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/financials": {
        post: {
          tags: ["Financials"],
          summary: "Create or update project financial",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertFinancialRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Financial upserted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Financial" },
                },
              },
            },
            400: { description: "Missing applicationId" },
            401: { description: "Unauthorized" },
            404: { description: "Application not found" },
          },
        },
      },
      // ===== TIMESHEET ROUTES ======================================
      "/timesheets": {
        get: {
          tags: ["Timesheets"],
          summary: "List candidate's timesheets (paginated)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 25, maximum: 50 },
            },
          ],
          responses: {
            200: {
              description: "Paginated timesheets",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Timesheet" },
                      },
                      total: { type: "number" },
                      page: { type: "number" },
                      limit: { type: "number" },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
        post: {
          tags: ["Timesheets"],
          summary: "Upsert draft timesheet for a week",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertTimesheetRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Timesheet upserted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Timesheet" },
                },
              },
            },
            400: { description: "Missing required fields" },
            401: { description: "Unauthorized" },
            409: { description: "Non-draft timesheet exists for this week" },
          },
        },
      },
      "/timesheets/{id}/submit": {
        patch: {
          tags: ["Timesheets"],
          summary: "Submit a draft timesheet (only after Saturday)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Timesheet submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Timesheet" },
                },
              },
            },
            400: { description: "Week not ended yet" },
            401: { description: "Unauthorized" },
            403: { description: "Not owner" },
            404: { description: "Not found" },
            409: { description: "Not in draft status" },
          },
        },
      },
      "/timesheets/pending": {
        get: {
          tags: ["Timesheets"],
          summary: "List submitted timesheets from roster (marketer)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              schema: { type: "string", default: "submitted" },
              description: "Use 'all' to get all statuses",
            },
          ],
          responses: {
            200: { description: "Pending timesheets" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/timesheets/{id}/approve": {
        patch: {
          tags: ["Timesheets"],
          summary: "Approve a submitted timesheet",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { notes: { type: "string" } },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Timesheet approved",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Timesheet" },
                },
              },
            },
            401: { description: "Unauthorized" },
            403: { description: "Not authorized" },
            404: { description: "Not found" },
            409: { description: "Not in submitted status" },
          },
        },
      },
      "/timesheets/{id}/reject": {
        patch: {
          tags: ["Timesheets"],
          summary: "Reject a submitted timesheet (returns to draft)",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { notes: { type: "string" } },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Timesheet rejected",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Timesheet" },
                },
              },
            },
            401: { description: "Unauthorized" },
            403: { description: "Not authorized" },
            404: { description: "Not found" },
            409: { description: "Not in submitted status" },
          },
        },
      },
      // ===== INTERVIEW ROUTES ======================================
      "/interviews": {
        post: {
          tags: ["Interviews"],
          summary:
            "Send interview/screening invite (generates Meet link + email)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["candidateEmail"],
                  properties: {
                    candidateEmail: { type: "string", format: "email" },
                    candidateName: { type: "string" },
                    jobId: { type: "string" },
                    jobTitle: { type: "string" },
                    proposedAt: { type: "string", format: "date-time" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Invite sent",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InterviewInvite" },
                },
              },
            },
            400: { description: "Missing candidateEmail" },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/interviews/sent": {
        get: {
          tags: ["Interviews"],
          summary: "List interview invites sent by vendor",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Sent invites",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/InterviewInvite" },
                      },
                      total: { type: "number" },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/interviews/received": {
        get: {
          tags: ["Interviews"],
          summary: "List interview invites received by candidate",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Received invites",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/InterviewInvite" },
                      },
                      total: { type: "number" },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/interviews/{id}/respond": {
        patch: {
          tags: ["Interviews"],
          summary: "Accept or decline an interview invite",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["action"],
                  properties: {
                    action: { type: "string", enum: ["accept", "decline"] },
                    note: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Response recorded",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InterviewInvite" },
                },
              },
            },
            400: { description: "Invalid action" },
            401: { description: "Unauthorized" },
            403: { description: "Not the invitee" },
            404: { description: "Not found" },
            409: { description: "Already responded" },
          },
        },
      },
      // ===== EMPLOYER FINANCIALS =====================================
      "/vendor/financials/summary": {
        get: {
          tags: ["Employer"],
          summary: "Get employer-side financial summary",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Employer financial summary" },
            401: { description: "Unauthorized" },
          },
        },
      },
      // ===== CLIENT/VENDOR COMPANIES ===============================
      "/marketer/client-companies": {
        get: {
          tags: ["Employer"],
          summary: "List client companies for the employer",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Client companies",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ClientCompany" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/marketer/vendor-companies": {
        get: {
          tags: ["Employer"],
          summary: "List vendor companies for the employer",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Vendor companies",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/VendorCompany" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      // ===== ADMIN ROUTES (RBAC) ===================================
      "/admin/plans": {
        get: {
          tags: ["Admin"],
          summary: "List available subscription plans",
          responses: {
            200: {
              description: "Active subscription plans",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SubscriptionPlan" },
                  },
                },
              },
            },
          },
        },
      },
      "/admin/setup": {
        post: {
          tags: ["Admin"],
          summary: "One-time company admin onboarding",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["adminName", "companyName"],
                  properties: {
                    adminName: { type: "string" },
                    adminPhone: { type: "string" },
                    adminDesignation: { type: "string" },
                    companyName: { type: "string" },
                    companyLegalName: { type: "string" },
                    ein: { type: "string" },
                    companyPhone: { type: "string" },
                    companyEmail: { type: "string" },
                    companyWebsite: { type: "string" },
                    industry: { type: "string" },
                    companySize: { type: "string" },
                    subscriptionPlanSlug: {
                      type: "string",
                      default: "starter",
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Company and admin created" },
            400: { description: "Validation error" },
            401: { description: "Unauthorized" },
            409: { description: "Admin already exists" },
          },
        },
      },
      "/admin/me": {
        get: {
          tags: ["Admin"],
          summary: "Get current user's company context, role, and permissions",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description:
                "Company context with companyAdmin, companyUser, role, permissions",
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/admin/invite": {
        post: {
          tags: ["Admin"],
          summary: "Send employee invitation email",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "role"],
                  properties: {
                    email: { type: "string", format: "email" },
                    name: { type: "string" },
                    role: {
                      type: "string",
                      enum: ["admin", "manager", "vendor", "marketer"],
                    },
                    department: {
                      type: "string",
                      enum: ["accounts", "immigration", "placement"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Invitation sent",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EmployeeInvitation" },
                },
              },
            },
            400: { description: "Validation error or seat limit reached" },
            401: { description: "Unauthorized" },
            403: { description: "Not admin" },
            409: { description: "Pending invite already exists" },
          },
        },
      },
      "/admin/invitations": {
        get: {
          tags: ["Admin"],
          summary: "List sent invitations",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Invitation list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/EmployeeInvitation" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/admin/invitations/{id}": {
        delete: {
          tags: ["Admin"],
          summary: "Revoke a pending invitation",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Invitation revoked" },
            401: { description: "Unauthorized" },
            403: { description: "Not admin" },
            404: { description: "Not found" },
          },
        },
      },
      "/admin/register/{token}": {
        post: {
          tags: ["Admin"],
          summary: "Register via employee invite token",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password", "fullName"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                    fullName: { type: "string" },
                    phone: { type: "string" },
                    designation: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "User registered and added to company" },
            400: { description: "Invalid or expired token" },
            409: { description: "Email already registered" },
          },
        },
      },
      "/admin/users": {
        get: {
          tags: ["Admin"],
          summary: "List company users (RBAC-filtered)",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Company users list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CompanyUser" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/admin/users/{id}/role": {
        patch: {
          tags: ["Admin"],
          summary: "Change a user's role and department",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["role"],
                  properties: {
                    role: {
                      type: "string",
                      enum: ["admin", "manager", "vendor", "marketer"],
                    },
                    department: {
                      type: "string",
                      enum: ["accounts", "immigration", "placement"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Role updated" },
            401: { description: "Unauthorized" },
            403: { description: "Not admin" },
            404: { description: "User not found" },
          },
        },
      },
      "/admin/users/{id}/status": {
        patch: {
          tags: ["Admin"],
          summary: "Activate or deactivate a user",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: { type: "string", enum: ["active", "deactivated"] },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Status updated" },
            401: { description: "Unauthorized" },
            403: { description: "Not admin" },
            404: { description: "User not found" },
          },
        },
      },
      "/admin/active-users": {
        get: {
          tags: ["Admin"],
          summary: "List active users with online status",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Active users with online/away/offline status",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CompanyUser" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      // ===== INTERNAL ROUTES =======================================
      "/internal/ingest/jobs": {
        post: {
          tags: ["Internal"],
          summary: "Bulk ingest jobs from data-collection service",
          description: "Requires x-internal-key header",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["records"],
                  properties: {
                    records: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CreateJobRequest" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Ingest result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      inserted: { type: "number" },
                      skipped: { type: "number" },
                    },
                  },
                },
              },
            },
            400: { description: "Empty or missing records" },
          },
        },
      },
      "/internal/ingest/profiles": {
        post: {
          tags: ["Internal"],
          summary: "Bulk ingest profiles from data-collection service",
          description: "Requires x-internal-key header",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["records"],
                  properties: {
                    records: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/UpsertProfileRequest",
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Ingest result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      inserted: { type: "number" },
                      skipped: { type: "number" },
                    },
                  },
                },
              },
            },
            400: { description: "Empty or missing records" },
          },
        },
      },
    },
  },
  apis: [], // All paths defined inline above — no file scanning needed
};

export const swaggerSpec = swaggerJsdoc(options);
