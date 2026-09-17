# First Commit 2026 --- Complete Competition Rules, Requirements & Build Checklist

> **Event:** First Commit --- Bharat Builds Tour × WeMakeDevs × AWS
> Builder Center\
> **Dates:** 17--20 September 2026\
> **Format:** Online across India; optional in-person build day in
> Bengaluru on 19 September\
> **Team size:** 1--4 students\
> **Purpose of this document:** A practical rulebook and execution
> checklist for selecting a problem statement, building the project,
> using AWS correctly, maintaining a valid repository, and preparing the
> final submission.
>
> **Important:** Sections marked **OFFICIAL** summarize the published
> First Commit/Bharat Builds rules and event page. Sections marked
> **RECOMMENDED** are strategy/best-practice guidance, not additional
> organizer rules.

------------------------------------------------------------------------

## 1. The Competition in One Minute

First Commit is a four-day student hackathon. There is **no fixed
problem statement**. Your team chooses a real problem and builds a new
solution during the event window.

The central requirement is:

> **Find a real problem → build a working solution during the hackathon
> → meaningfully use AWS → show the working product and AWS usage in a
> maximum three-minute demo.**

There are two main technical approaches:

-   **Build It:** Build locally using AWS-related open-source
    technologies.
-   **Ship It:** Deploy the application on AWS and provide a live URL.

There is also a **Best UI** prize consideration. You do **not** need to
select a prize track when entering; the nature of the finished project
determines where it is considered.

------------------------------------------------------------------------

# 2. Eligibility --- OFFICIAL

Before building, every team member should verify all of the following:

-   [ ] I am a **university student in India**.
-   [ ] I am **18 years old or older** to register on my own behalf.
-   [ ] I have individually registered for the Bharat Builds Tour.
-   [ ] I have a **WeMakeDevs account**.
-   [ ] I have an **AWS Builder Center profile**.
-   [ ] My **student status is verified** on AWS Builder Center.
-   [ ] I have checked in to **First Commit** specifically when the
    hackathon opened.
-   [ ] My registration/profile details are accurate.

One tour registration covers the six tour stops, but participants must
check in to each hackathon they want to enter.

People involved in running/judging the tour or working on it for
WeMakeDevs/AWS may attend but cannot win prizes.

------------------------------------------------------------------------

# 3. Team Rules --- OFFICIAL

-   Teams may contain **1 to 4 people**.
-   You may participate **solo**.
-   Teammates do **not** need to attend the same university.
-   Teammates may be from different cities.
-   Every member must independently satisfy the eligibility rules.
-   Every member must register individually.
-   There is **one submission per team**.
-   A person may be on **one team per hackathon stop**.
-   Teams may be mixed between online and in-person participants.
-   Online and in-person projects are judged using the same criteria.

### Team setup checklist

-   [ ] 1--4 eligible members
-   [ ] Every member registered
-   [ ] Every member has Builder Center profile
-   [ ] Every member's student verification is complete
-   [ ] First Commit check-in completed
-   [ ] Roles roughly divided
-   [ ] One shared project/repository agreed upon
-   [ ] One person responsible for final submission

------------------------------------------------------------------------

# 4. Event Window & Prior Work --- CRITICAL OFFICIAL RULES

## The clock is the rule

Project work must begin **after the hackathon opens** and finish by the
submission deadline.

### Allowed before the event

You may:

-   learn technologies;
-   practise AWS;
-   research possible problems;
-   brainstorm;
-   plan;
-   learn frameworks;
-   experiment generally.

### Not allowed

A project that was started before the competition window **does not
qualify**, even if you rewrite it during the event.

In practical terms:

-   Do not submit an old college project.
-   Do not take an old hackathon project and redesign it.
-   Do not clone your own previous product and pretend it was started
    during First Commit.
-   Do not create misleading Git history.

The organizers explicitly state that **prior work passed off as new** or
a **repository whose history does not match the event window** can
disqualify the entire team.

------------------------------------------------------------------------

# 5. GitHub / Repository Requirements --- OFFICIAL + PRACTICAL GUIDANCE

## OFFICIAL

The final submission must contain a **public repository**.

The repository history matters because organizers can use it to
determine whether the project was genuinely created during the
competition.

Plagiarism, prior work represented as new, or repository history
inconsistent with the event window can disqualify the entire team.

## RECOMMENDED Git workflow

Create a fresh repository for the project and work normally.

Example:

``` text
Sep 17 — Initial project structure
Sep 17 — Add frontend shell
Sep 17 — Implement authentication
Sep 18 — Add API and database
Sep 18 — Integrate AWS service
Sep 19 — Implement core workflow
Sep 19 — Improve UI/error handling
Sep 20 — Demo fixes and documentation
```

Do **not** create meaningless commits purely to make the history look
active. Meaningful commits provide a much clearer development trail.

### Repository checklist

-   [ ] Repository is for this competition project.
-   [ ] Development history begins within the competition window.
-   [ ] Repository is public before submission.
-   [ ] Team contributions are visible naturally through Git.
-   [ ] README explains the project.
-   [ ] README explains the problem.
-   [ ] README explains the architecture.
-   [ ] README identifies AWS technologies/services used.
-   [ ] README contains setup/run instructions.
-   [ ] Third-party code/assets are credited where required.
-   [ ] Licences permit the external components being used.
-   [ ] AI coding tools used are disclosed in the write-up.
-   [ ] No passwords, AWS secrets, tokens or API keys are committed.

------------------------------------------------------------------------

# 6. What You Are Allowed to Use --- OFFICIAL

You **may use**:

-   open-source libraries;
-   frameworks;
-   public APIs;
-   boilerplate;
-   starter templates;
-   AI coding tools.

The key distinction is that **the work being judged must be what your
team adds during the event**.

Anything you did not write yourself should have appropriate credit and a
licence that permits its use.

### AI tools

AI coding tools are explicitly permitted.

If you use tools such as:

-   ChatGPT
-   Claude / Claude Code
-   GitHub Copilot
-   Gemini
-   Cursor
-   other AI development assistants

list the tools you used in the project write-up.

AI assistance does **not** remove the requirement that the submitted
work be your team's legitimate competition project.

------------------------------------------------------------------------

# 7. AWS Is Mandatory --- OFFICIAL

AWS must be **part of the actual project**.

Merely putting an AWS logo in the presentation, mentioning AWS in the
README, or saying that the product "could use AWS" is not sufficient.

The final demo must show AWS being used in a way judges can identify.

The event provides two principal approaches.

------------------------------------------------------------------------

# 8. Track 1 --- Build It

## OFFICIAL concept

**Build It** is intended for projects built locally using AWS-related
open-source technologies.

The event highlights technologies such as:

-   Strands Agents SDK
-   PartyRock
-   Cedar
-   SAM CLI + LocalStack
-   OpenSearch
-   Firecracker
-   Corretto

An AWS cloud account/card is not required for the Build It approach.

### What matters

Do not simply install an AWS open-source project and call that the
submission.

The AWS/open-source component should perform a meaningful job in your
product.

Example:

``` text
User request
    ↓
Application
    ↓
Strands Agent
    ↓
Tools / local model / application logic
    ↓
Useful result
```

The demo should make that contribution understandable.

------------------------------------------------------------------------

# 9. Track 2 --- Ship It

## OFFICIAL concept

**Ship It** is for projects deployed on AWS with a **live URL**.

The event highlights services including:

-   AWS Lambda
-   API Gateway
-   DynamoDB
-   Amazon S3
-   Amazon Bedrock
-   Amplify Hosting
-   App Runner
-   Cognito
-   EventBridge
-   Step Functions

Architecture and cost decisions form part of the work for Ship It.

### Example sensible architecture

``` text
                 USER
                   │
                   ▼
           React / Web App
                   │
          Amplify Hosting
                   │
                   ▼
             API Gateway
                   │
                   ▼
                Lambda
              /        \
             ▼          ▼
        DynamoDB      Bedrock
                         │
                         ▼
                    AI result
```

This is only an example. **Do not add services just because they appear
on the event page.**

Every service should have an answer to:

> What part of our working user flow does this service make possible?

------------------------------------------------------------------------

# 10. Build It vs Ship It

  -------------------------------------------------------------------------------
  Question                Build It                   Ship It
  ----------------------- -------------------------- ----------------------------
  Runs primarily          Locally                    AWS cloud

  Live deployment         No                         Yes
  required for track                                 

  Live URL                Not the defining           Required
                          requirement                

  AWS account necessarily No                         Yes for deployment
  required                                           

  Main AWS angle          AWS/open-source ecosystem  AWS cloud services

  Architecture/cost       Still design responsibly   Explicitly part of the work

  Example                 Strands/OpenSearch/Cedar   Lambda/Bedrock/DynamoDB/S3
  -------------------------------------------------------------------------------

You do **not** need to choose the prize track at entry. The completed
project determines how it is considered.

------------------------------------------------------------------------

# 11. Problem Statement --- There Is No Fixed PS

## OFFICIAL theme

The problem is yours to choose.

It should solve a **real problem**, for example:

-   something you personally experience;
-   something your family/community experiences;
-   an inefficient service;
-   a clunky process;
-   a problem relevant to India;
-   healthcare;
-   education;
-   finance;
-   another sector of your choice.

The official judging guidance emphasizes that a **small problem solved
well is better than a large problem solved vaguely**.

------------------------------------------------------------------------

# 12. MUST-HAVE Checklist Before Selecting Any PS

Do not lock a problem statement until the team can answer these clearly.

## A. Problem

-   [ ] Is this a **real problem**?
-   [ ] Can we identify the exact users?
-   [ ] Can we explain the problem in 1--2 sentences?
-   [ ] Do we understand how users currently handle it?
-   [ ] Is there a clear weakness in the current process?
-   [ ] Is the problem narrow enough for four days?
-   [ ] Are we solving a problem rather than starting with a technology?

Bad starting point:

> "Let's build a Bedrock multi-agent platform."

Better starting point:

> "Students miss important deadlines because notices are distributed
> across PDFs, email and multiple portals."

Then determine whether Bedrock/AWS is actually useful.

------------------------------------------------------------------------

## B. Impact

-   [ ] Does solving the problem produce a meaningful benefit?
-   [ ] Can that benefit be demonstrated?
-   [ ] Can we explain **who benefits**?
-   [ ] Can we explain **what changes for them**?
-   [ ] Can we show time/error/cost/effort/access improvement where
    appropriate?

Avoid vague claims such as:

> "This will revolutionize education."

Prefer something testable and specific.

------------------------------------------------------------------------

## C. Four-Day Feasibility

-   [ ] Can the core workflow actually work by September 20?
-   [ ] Can we build it without waiting for inaccessible datasets?
-   [ ] Can we avoid dependencies requiring weeks of approval?
-   [ ] Can we create a useful MVP before adding optional features?
-   [ ] Does the team already have enough baseline skill to execute?
-   [ ] Is there one feature we can complete end-to-end?

The event's own judging guidance favors **one working feature over five
features that almost work**.

------------------------------------------------------------------------

## D. AWS Fit

-   [ ] Does AWS have a real job in the architecture?
-   [ ] Can we explain why the selected AWS service is used?
-   [ ] Can we visibly demonstrate the AWS-powered part?
-   [ ] Would the architecture still make logical sense outside the
    competition?
-   [ ] Are we avoiding unnecessary AWS services?

Potential mappings:

  Need                      Possible AWS component
  ------------------------- ------------------------
  Store uploaded files      S3
  Serverless processing     Lambda
  Expose backend endpoint   API Gateway
  Application data          DynamoDB
  Generative AI/model       Bedrock
  User identity             Cognito
  Frontend deployment       Amplify
  Multi-step process        Step Functions
  Event-driven processing   EventBridge
  Search                    OpenSearch

This table is guidance, not a requirement to use all of them.

------------------------------------------------------------------------

## E. Technical Substance

-   [ ] Is the project more than a static frontend?
-   [ ] Is it more than basic CRUD?
-   [ ] If using AI, does AI do meaningful work?
-   [ ] Is it more than a generic chatbot wrapper?
-   [ ] Is there at least one technically interesting workflow?

Possible technical depth:

-   document processing;
-   semantic search;
-   agent workflows;
-   authorization/policy;
-   event-driven automation;
-   recommendation;
-   multimodal processing;
-   workflow orchestration;
-   real-time processing;
-   meaningful data transformation.

------------------------------------------------------------------------

## F. Demo Potential

-   [ ] Can the problem be explained very quickly?
-   [ ] Can we demonstrate the main workflow on-screen?
-   [ ] Is there a clear **before → action → result**?
-   [ ] Can the core value be shown inside three minutes?
-   [ ] Can AWS usage be shown within the same video?
-   [ ] Does the product produce visible output rather than requiring a
    long explanation?

Because there is **no live judging call**, the recorded demo is
especially important.

------------------------------------------------------------------------

## G. Learning Potential

Learning is an explicit judging category.

-   [ ] Will we learn something meaningful during the four days?
-   [ ] Can we explain what was new to us?
-   [ ] Are we learning a useful AWS technology/service?
-   [ ] Can we describe a challenge we encountered and solved?

Examples:

-   first AWS deployment;
-   first agent;
-   first serverless application;
-   first use of Bedrock;
-   first event-driven architecture;
-   first use of an unfamiliar AWS service.

Do not fake learning. Document genuine learning.

------------------------------------------------------------------------

## H. UI / Usability Potential

Best UI is judged on **design and usability**.

-   [ ] Is the primary user journey obvious?
-   [ ] Can a user operate the core feature without explanation?
-   [ ] Can we make the interface polished within the time limit?
-   [ ] Does the UI support the actual problem instead of being
    decoration?
-   [ ] Are errors/loading/results understandable?

------------------------------------------------------------------------

# 13. The Eight-Question PS Gate

Before approving any PS, answer:

1.  **Who exactly has this problem?**
2.  **What exactly is painful/broken today?**
3.  **What is our one core solution?**
4.  **Can we build that core solution in four days?**
5.  **What exactly will AWS do?**
6.  **What will we learn while building it?**
7.  **What is the strongest visible result?**
8.  **Can we demonstrate all of that in three minutes?**

If several answers are vague, refine the PS before starting.

------------------------------------------------------------------------

# 14. Official Judging Areas

The event lists five principal judging areas.

## 14.1 Idea and Impact

Judges consider whether the project solves a real problem and what
changes for the people affected by it.

### Optimize for

-   precise problem;
-   identifiable users;
-   real utility;
-   focused scope;
-   demonstrable impact.

------------------------------------------------------------------------

## 14.2 Built on AWS

AWS must meaningfully participate in the project.

The project can qualify through:

-   the AWS/open-source route; or
-   AWS cloud services.

AWS usage must be visible in the demo.

### Optimize for

-   purposeful AWS selection;
-   understandable architecture;
-   services tied directly to the user flow;
-   working integration rather than service count.

------------------------------------------------------------------------

## 14.3 Learning

Judges want the four-day event to result in genuine technical learning.

### Keep notes while building

Record:

-   technology you learned;
-   what initially failed;
-   what you changed;
-   why you selected a service;
-   deployment/architecture lessons;
-   trade-offs you discovered.

These notes will make the final write-up much easier.

------------------------------------------------------------------------

## 14.4 Execution

The central question is simple:

> **Does it work?**

The event explicitly favors a smaller feature that works over several
incomplete features.

### Priority order

1.  Core workflow works.
2.  AWS integration works.
3.  Errors are handled.
4.  Demo path is reliable.
5.  UI is polished.
6.  Additional features.

Do not reverse this order.

------------------------------------------------------------------------

## 14.5 Demo Video

The final demo is **up to three minutes**.

There is **no live demo/call**. Judges evaluate what is submitted.

A feature that exists only in the write-up but is not demonstrated does
not count as a demonstrated feature.

### Recommended demo structure --- NOT an official timing rubric

**0:00--0:20 --- Problem**

Who has the problem and what is wrong today?

**0:20--0:40 --- Solution**

One sentence describing what you built.

**0:40--1:40 --- Working product**

Perform the main workflow live/on-screen.

**1:40--2:15 --- Result**

Show the useful output and why it matters.

**2:15--2:40 --- AWS**

Show/explain where AWS fits and the architecture.

**2:40--3:00 --- Impact + learning**

What changed and what the team learned.

The official rule is the maximum video length and required content; the
timing above is merely a recommended structure.

------------------------------------------------------------------------

# 15. Submission Requirements --- OFFICIAL

A valid submission contains **three things**:

1.  **Public repository**
2.  **Demo video up to three minutes**
3.  **Short write-up**

The write-up should cover:

-   the problem;
-   what you built;
-   where AWS fits.

AI coding tools used should also be named.

Submission is made through the First Commit submission form, **once per
team**, before the deadline.

### Deadline rule

Deadlines are strict.

The current tour rules state that teams can submit early and continue
editing the submission up to the deadline. Once the deadline passes, you
cannot submit a new project or edit an already-submitted project.

**Recommended:** create an initial valid submission early rather than
waiting until the final minutes.

------------------------------------------------------------------------

# 16. What the Final Write-Up Should Contain

## Required/core information

-   Problem
-   Build/solution
-   AWS usage
-   AI coding tools used

## Recommended structure

``` markdown
# Project Name

## Problem
Who faces it and why it matters.

## Solution
What we built.

## Core Workflow
Input → processing → output.

## Architecture
Frontend → AWS components → output.

## AWS Usage
Exactly what each AWS service/open-source technology does.

## What We Built During First Commit
Main components/features implemented during Sept 17–20.

## Learning
New services/techniques learned and challenges solved.

## Tech Stack
Frontend, backend, AWS, databases, libraries, APIs.

## Third-Party Credits
Libraries/assets/templates/APIs requiring attribution.

## AI Tools Used
Example: ChatGPT, Claude Code, Copilot.

## Run / Demo
Setup instructions and live URL where applicable.
```

------------------------------------------------------------------------

# 17. Security & Repository Hygiene --- RECOMMENDED

Never commit:

``` text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
API keys
database passwords
JWT secrets
private credentials
.env containing secrets
```

Use:

-   environment variables;
-   `.env.example` with placeholders;
-   `.gitignore`;
-   AWS IAM permissions appropriate to the app;
-   secrets management appropriate to your deployment.

Before making the repository public:

-   [ ] Search repository for secrets.
-   [ ] Check Git history for accidentally committed secrets.
-   [ ] Rotate any credential that was exposed.
-   [ ] Remove private user data.
-   [ ] Ensure datasets/assets may legally be shared.

------------------------------------------------------------------------

# 18. Architecture Rules of Thumb --- RECOMMENDED

Do **not** maximize the number of AWS services.

Instead ask:

> What does this step in the user flow require?

Example:

``` text
User uploads PDF
      ↓
S3 stores PDF
      ↓
Lambda processes upload
      ↓
Bedrock interprets/extracts
      ↓
DynamoDB stores structured result
      ↓
Frontend displays result
```

Every component has a reason to exist.

A complicated architecture with ten services is not automatically
stronger than a clean architecture with four.

For Ship It, be ready to explain basic architecture and cost choices
because those are explicitly part of the track's work.

------------------------------------------------------------------------

# 19. Development Strategy --- RECOMMENDED

## Phase 1 --- Lock the problem

Before coding:

-   [ ] User identified
-   [ ] Problem defined
-   [ ] Existing process understood
-   [ ] Core feature chosen
-   [ ] AWS role chosen
-   [ ] Demo scenario imagined

## Phase 2 --- Design the MVP

Define only:

``` text
INPUT
  ↓
CORE PROCESS
  ↓
OUTPUT
```

Anything outside this is secondary.

## Phase 3 --- Build the core

Get one complete workflow functioning.

Do not spend half the hackathon perfecting landing-page animations
before the backend works.

## Phase 4 --- AWS integration

Make AWS part of the actual workflow and test it repeatedly.

## Phase 5 --- Reliability

Test:

-   empty input;
-   invalid input;
-   service/API failure;
-   loading states;
-   slow network;
-   authentication where relevant;
-   fresh browser/session;
-   live deployment.

## Phase 6 --- UI

Once the core is reliable:

-   simplify screens;
-   make CTA obvious;
-   improve result display;
-   add loading/error feedback;
-   remove unnecessary controls.

## Phase 7 --- Demo

Design the demo around the most impressive **working** path.

------------------------------------------------------------------------

# 20. Disqualification / High-Risk Checklist

## OFFICIAL risks

Avoid:

-   [ ] plagiarism;
-   [ ] submitting prior work as a new project;
-   [ ] repository history inconsistent with the competition window;
-   [ ] work that is not legitimately yours;
-   [ ] unlicensed external work;
-   [ ] missing required attribution;
-   [ ] late submission;
-   [ ] violating event conduct requirements.

The rules state that plagiarism, prior work passed off as new, or
incompatible repository history can disqualify the **whole team**.

------------------------------------------------------------------------

# 21. Code of Conduct --- OFFICIAL

The WeMakeDevs Code of Conduct applies:

-   online;
-   in person;
-   throughout the event;
-   across event-operated channels.

Harassment, cheating, or abuse of mentors, volunteers or other builders
can end participation.

Venue rules and staff instructions also apply to participants attending
in person.

------------------------------------------------------------------------

# 22. In-Person Participation

The hackathon itself runs online across India from **17--20 September
2026**.

There is an optional in-person build day:

**19 September 2026 --- Bengaluru --- 8 AM to 8 PM**

The event page states that in-person participation does **not** add to
the judging score.

The in-person day provides opportunities such as:

-   workshops;
-   project feedback;
-   meeting the Amazon team;
-   event/community interaction.

It requires its own in-person signup in addition to hackathon check-in,
subject to seat availability.

------------------------------------------------------------------------

# 23. Prize Structure Shown on the First Commit Page

At the time this document was prepared, the official First Commit page
lists:

### Ship It --- First Prize

-   ₹2,00,000 cash
-   \$3,000 AWS credits

### Build It --- Second Prize

-   ₹1,50,000 cash
-   \$2,000 AWS credits

### Best UI --- Third Prize

-   ₹1,00,000 cash
-   \$1,000 AWS credits

### Four runners-up

-   \$1,000 AWS credits to each team

### Top five blogs

The event page lists a Logitech gaming keyboard for each of the five
selected blog authors.

### Tour swag

Listed for top teams.

Prize terms should always be rechecked on the live event page before
relying on them.

------------------------------------------------------------------------

# 24. Certificates

The official FAQ states that **everyone who submits a project gets a
certificate**, and the winning team also receives a certificate.

Therefore, registration alone is not the same as completing the
certificate requirement: **submit a project**.

------------------------------------------------------------------------

# 25. Amazon Fast-Track Interview Opportunity --- OFFICIAL

This is separate from winning a competition prize.

Top student projects from the specified graduation cohorts may be
considered for fast-track interview opportunities with Amazon's
University Talent Acquisition Team.

The current rules specify:

-   **Pre-Final Year (2028)** and **Final Year (2027)** students;
-   up to **10 opportunities per hackathon**;
-   10 is a maximum, **not a guarantee**;
-   fewer or none may be offered;
-   opportunities relate to available **six-month internships and
    full-time positions**;
-   winning a track is **neither required nor sufficient**;
-   prize decisions and interview decisions are separate;
-   selection is discretionary and final;
-   candidates still have to clear Amazon's interview/evaluation
    process;
-   an interview opportunity is **not an employment offer**;
-   availability depends on open roles, headcount and business
    requirements;
-   opportunities are non-transferable;
-   terms may be modified, paused or withdrawn.

If this opportunity matters to you, ensure your registration information
and verified Builder Center profile are accurate.

------------------------------------------------------------------------

# 26. Intellectual Property --- OFFICIAL

You keep the rights to what you build.

By entering, you permit WeMakeDevs and AWS to show the project and name
your team when writing about the tour.

------------------------------------------------------------------------

# 27. Recommended Team Division

For a 4-person team, one possible division is:

### Member 1 --- Product / Frontend

-   user flow;
-   UI;
-   frontend integration.

### Member 2 --- Backend

-   APIs;
-   business logic;
-   database integration.

### Member 3 --- AWS / AI

-   cloud architecture;
-   Bedrock/agents;
-   deployment;
-   IAM/service configuration.

### Member 4 --- Integration / QA / Documentation

-   integration;
-   testing;
-   Git/README;
-   demo preparation.

These are **not official roles**. Everyone should still understand the
entire project.

------------------------------------------------------------------------

# 28. Suggested Four-Day Execution Plan

## Day 1 --- Problem + skeleton

-   Lock PS.
-   Create repository.
-   Define user flow.
-   Define AWS architecture.
-   Build frontend/backend skeleton.
-   Get the simplest end-to-end path running.

## Day 2 --- Core functionality

-   Complete main feature.
-   Integrate AWS.
-   Persist required data.
-   Test real input/output.

## Day 3 --- Reliability + UI

-   Fix integration problems.
-   Handle failures.
-   Improve UX.
-   Deploy Ship It project.
-   Start README/write-up.
-   Prepare demo dataset/scenario.

## Day 4 --- Freeze + submit

-   Stop adding risky features.
-   Test from a clean session/device.
-   Verify AWS integration.
-   Verify live URL if applicable.
-   Finish README.
-   Record demo.
-   Submit early enough to recover from upload/form problems.
-   Recheck submission before deadline.

This schedule is recommended strategy, not an official organizer
schedule.

------------------------------------------------------------------------

# 29. Pre-Submission Master Checklist

## Eligibility

-   [ ] Every member is eligible.
-   [ ] Every member registered.
-   [ ] Builder Center profiles exist.
-   [ ] Student verification completed.
-   [ ] First Commit check-in completed.

## Project validity

-   [ ] New project created during event.
-   [ ] No old project reused as submission.
-   [ ] Work is genuinely ours.
-   [ ] External work is properly licensed/credited.

## AWS

-   [ ] AWS is actually used.
-   [ ] AWS component works.
-   [ ] AWS component can be shown in demo.
-   [ ] Each service has a purpose.
-   [ ] Ship It live URL works, if submitting a deployed project.

## Product

-   [ ] Core feature works end-to-end.
-   [ ] Main user can understand the flow.
-   [ ] Important errors are handled.
-   [ ] Demo data works reliably.
-   [ ] No major feature in the pitch is fake.

## GitHub

-   [ ] Public repository.
-   [ ] Valid competition-window history.
-   [ ] README complete.
-   [ ] Setup instructions included.
-   [ ] Architecture documented.
-   [ ] AWS usage documented.
-   [ ] AI tools disclosed.
-   [ ] Third-party credits/licences documented.
-   [ ] No secrets committed.

## Demo

-   [ ] Maximum three minutes.
-   [ ] Shows the problem.
-   [ ] Shows target user.
-   [ ] Shows working product.
-   [ ] Shows important output.
-   [ ] Shows/explains AWS.
-   [ ] Does not depend on features only described verbally.
-   [ ] Audio/text is understandable.
-   [ ] Final video link/file works as required by submission form.

## Write-up

-   [ ] Problem explained.
-   [ ] Solution explained.
-   [ ] Build explained.
-   [ ] AWS usage explained.
-   [ ] AI coding tools named.
-   [ ] Learning/challenges included where useful.

## Submission

-   [ ] Submitted through correct First Commit form.
-   [ ] One submission for team.
-   [ ] Submitted before deadline.
-   [ ] All links accessible.
-   [ ] Repository accessible publicly.
-   [ ] Demo accessible.
-   [ ] Live URL accessible where applicable.

------------------------------------------------------------------------

# 30. Quick Decision Card for Any Project Idea

Copy this for every idea your team considers:

``` markdown
## Idea:

### User
Who has the problem?

### Problem
What exactly is broken?

### Existing Method
What do people currently do?

### Core Solution
What ONE thing will we build?

### Input
What does the user give the system?

### Processing
What happens?

### Output
What valuable result is produced?

### AWS Role
Which AWS service/open-source project is necessary and why?

### Four-Day MVP
Exactly what can be completed by the deadline?

### Demo Moment
What will the judge see that proves the product works?

### Impact
What improves for the user?

### Learning
What new technology will the team genuinely learn?

### Main Risk
What could prevent us from completing this?
```

If you cannot fill these fields clearly, the idea probably needs more
refinement before coding.

------------------------------------------------------------------------

# 31. Absolute Minimum to Remember

If you remember nothing else, remember these rules:

1.  **Build a new project during the event window.**
2.  **Solve a real, specific problem.**
3.  **Use AWS meaningfully.**
4.  **Build one core workflow that genuinely works.**
5.  **Maintain honest Git/repository history.**
6.  **Credit external work and disclose AI coding tools.**
7.  **Submit a public repository.**
8.  **Submit a demo video no longer than three minutes.**
9.  **Submit a short write-up explaining the problem, build and AWS
    usage.**
10. **Show AWS and the working feature in the video.**
11. **Do not rely on a live judging call---there isn't one.**
12. **Submit before the deadline.**

------------------------------------------------------------------------

# 32. Official References

-   First Commit overview: `https://www.wemakedevs.org/aws/first-commit`
-   First Commit rules:
    `https://www.wemakedevs.org/aws/first-commit/rules`
-   Bharat Builds Tour rules: `https://www.wemakedevs.org/aws/rules`
-   WeMakeDevs cloud-project planning guide:
    `https://www.wemakedevs.org/blogs/how-to-plan-a-cloud-project`

> Rules and event information can be updated by the organizers. For any
> conflict between this document and the live official pages, the **live
> official rules control**.

------------------------------------------------------------------------

**Prepared for First Commit, 17--20 September 2026.**
