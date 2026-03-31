# 🏫 School Management System — Full-Stack Monorepo

The **School Management System** (SMS) is an enterprise-grade, full-stack monorepo application designed to digitize every aspect of educational institution management. From automated merit list generation to real-time attendance alerts via SMS, this platform bridges the gap between administrators, teachers, and students in a single, secure environment.

---

## 🏗️ Monorepo Architecture

This project is built using **npm workspaces**, ensuring shared logic and seamless integration across multiple applications and packages:

### 🧩 Applications
- **`dashboard/`** — A unified React dashboard serving **Admin**, **Teacher**, and **Student** roles with distinct permissions and views.
- **`client/`** — The public-facing institutional website, built for speed and SEO, showcasing school news, galleries, and public resources.
- **`server/`** — A robust Node.js/Express API powered by **Prisma (PostgreSQL)**, handling complex business logic, background tasks, and multi-cloud storage.

### 📦 Shared Packages
- **`@school/common-ui`** — Generic UI primitives (Buttons, Cards, Inputs) used across the entire ecosystem.
- **`@school/client-ui`** — Specialized layout components and data hooks for the public-facing site.
- **`@school/shared-schemas`** — Zod validation schemas shared between frontend and backend for end-to-end type safety.

---

## 🌟 Comprehensive Feature Breakdown

### 🎓 Academic & Result Engine
Leverage powerful automation to handle the core of educational operations:
- **Examination Management**: Create exams, assign class levels, and generate PDF exam routines automatically.
- **Mark Entry System**: Flexible marking schemes supporting **TOTAL** marks or **BREAKDOWN** (CQ, MCQ, Practical) with pass-mark validation.
- **Automated Result Processing**:
    - Generates class-wide merit lists based on performance.
    - **Auto-Promotion**: Calculates `final_merit`, assigns `next_year_roll`, and determines `next_year_section` automatically.
    - **Status Control**: Admins can publish or unpublish results with one click.
- **Dynamic Marksheets**: Print-ready PDF report cards generated on the fly via **Puppeteer**.

### 👩‍🎓 Student Lifecycle & Registration
Streamlined registration flows for all stages:
- **Online Admission System**: Public admission forms, result processing (Merit/Waiting lists), and customizable instructions.
- **Specialized Registration Forms**: Custom, multi-field registration forms designed for **Class 6**, **Class 8**, and **SSC (Class 9)**, matching official requirements.
- **Profile Management**: Full CRUD on student records, including image uploads and batch tracking.
- **Alumni Management**: Transition students to alumni status upon graduation to maintain historical records.

### 📅 Personnel & Operational Management
- **Faculty & Staff Profiles**: Manage teacher signatures, photos, and designations.
- **Resource Libraries**: Upload and manage **Syllabus**, **Holiday Lists**, and the **Citizen Charter** (PDF).
- **Institutional Message**: A dedicated section for the **Head of Institution**'s message and profile.
- **Routine Generator**: Create and distribute **Class Routines** and **Exam Routines** as downloadable PDFs.

### 📱 Communication & Alerts
- **Integrated SMS System**:
    - **Attendance Alerts**: Automatically (or manually) notify parents when a student is present or absent.
    - **Custom Templates**: Define variable-based templates (e.g., `{student_name}`, `{date}`) for different notification types.
    - **SMS Logs**: Track delivery status, cost, and balances directly from the dashboard.
- **Notice Board**: Post digital notices with PDF attachments, securely hosted and optimized for previewing.

### 🖼️ Interactive Media & Gallery
- **Event Management**: Create school events with detailed descriptions and featured images.
- **Student-Crowdsourced Gallery**:
    - Students can upload images from school events.
    - **Approval Workflow**: Admins review (Approve/Reject) pending images before they appear on the public gallery.
- **Categorized Albums**: Organize school memories into albums for easy navigation.

---

## 🔐 Role-Based Access Control (RBAC)

The system enforces strict security boundaries based on user roles:

| Feature | Admin | Teacher | Student |
| :--- | :---: | :---: | :---: |
| Dashboard Overview | ✅ | ✅ | ✅ |
| Manage Exams/Levels | ✅ | ❌ | ❌ |
| Input/Edit Marks | ✅ | ✅ (Assigned) | ❌ |
| View Marksheets | ✅ | ✅ | ✅ |
| Generate Final Results | ✅ | ❌ | ❌ |
| Attendance Tracking | ✅ | ✅ | ❌ |
| SMS Management | ✅ | ❌ | ❌ |
| Content Approval | ✅ | ❌ | ❌ |
| Public Notice Post | ✅ | ❌ | ❌ |

---

## 💻 Tech Stack & Integrations

### Frontend
- **Framework**: React (Dashboard), Next.js (Legacy/Public Components)
- **State Management**: **Zustand** for lightweight global state.
- **Styling**: Tailwind CSS + **Shadcn UI** for a premium aesthetic.
- **Animations**: Framer Motion for smooth transitions.

### Backend
- **Core**: Node.js + Express (ESM).
- **ORM**: **Prisma** with a PostgreSQL database.
- **Background Jobs**: **Bull (Redis)** for handling asynchronous tasks like bulk SMS or image processing.

### Integrations
- **Storage**: **AWS S3 / Cloudflare R2** for file persistence and **Cloudinary** for image optimization.
- **Automation**: **Puppeteer** for server-side PDF generation.
- **Data**: **XLSX** for bulk importing student and subject data from Excel.
- **Email/SMS**: **Brevo (Sendinblue)** and specialized Bulk SMS APIs.
- **Google Ecosystem**: Integration with Google Sheets API for data synchronization.

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/Mutiur03/School.git
cd School
npm install
```

### 2. Environment Setup
Create a `.env` file in `/server` and `/dashboard` using the provided samples.

**Key Variables Needed:**
- `DATABASE_URL` (PostgreSQL)
- `JWT_SECRET`
- `REDIS_URL`
- `CLOUDINARY_URL` / `R2_CONFIG`
- `BULK_SMS_API_KEY`

### 3. Database Initialization
```bash
cd server
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

### 4. Direct Run
To run all applications (Client, Dashboard, Server) simultaneously:
```bash
./run-all.sh
```

---

## 🎥 Demos & Contact

🔗 **Live Demo:** [Panchbibi School Live](https://www.mutiurrahman.com/projects/school-management-system)  
📺 **Detailed Video Walkthrough:** [YouTube Feature Demo](https://www.youtube.com/watch?v=EIk6t_aUbpY)

---

### 🤝 Let's Collaborate
Developed with ❤️ by **[Mutiur Rahman](https://github.com/Mutiur03)**.  
Looking to build something similar? Reach out via [LinkedIn](https://www.linkedin.com/in/mutiur-rahman-mr/) or [Fiverr](https://www.fiverr.com/mutiur_rahman03).
