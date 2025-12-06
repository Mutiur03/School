# 🏫 School Management System — Full-Stack Web Application

The **School Management System** is a comprehensive web application developed to streamline and digitize the administrative, academic, and communication processes of educational institutions. Built as a solo full-stack project, this platform centralizes student records, exam results, attendance tracking, event management, and more — all in a secure, modern interface.

---

## 🗂️ Monorepo Structure

This repository contains multiple apps and services:

- `admin/` — Admin dashboard (React + Vite)
- `students/` — Student dashboard (React + Vite)
- `teachers/` — Teacher dashboard (Next.js)
- `server/` — Backend API (Node.js + Express + Prisma)
- `public/` — Shared frontend assets and styles

Each app is independently deployable and communicates with the backend via REST APIs.

---

## 🌟 Project Overview

This system enables schools to manage all core operations digitally — from enrolling students and scheduling exams to tracking attendance and generating report cards. It’s built with scalability and real-world usage in mind, supporting multiple user roles (Admin, Teacher, Student) with dedicated dashboards and permissions.

---

## 🎯 Key Objectives

- Minimize manual paperwork and reduce administrative overhead
- Enable transparent academic record tracking
- Digitize attendance and exam processes
- Foster better communication through notices and real-time updates
- Securely manage and share documents

---

## 🧩 Core Features

### 👨‍🎓 Student Management

- Add, update, and manage student profiles
- Track academic details and attendance history
- Store and view student images

### 👩‍🏫 Teacher Management

- Manage faculty profiles and subject assignments
- Control access to subject-specific student data
- View attendance and marks based on permissions

### 📘 Subject & Exam Management

- Create, assign, and import subjects in bulk
- Schedule exams per class and section
- Input, edit, and calculate marks, GPA, and grades

### 📊 Marksheet & Reports

- Auto-generate PDF marksheets using Puppeteer
- Provide downloadable and printable report cards
- Maintain academic performance records per term

### 📅 Attendance & Promotion

- Record daily or subject-wise attendance
- Filter by class/date and analyze trends
- Promote students based on performance

### 📢 Notice Board

- Post notices with titles and PDF attachments
- Attach PDFs securely using Cloudinary
- Preview/download files via live links
- Simple and clean notice management

### 🖼️ Gallery & Event Management

- Create public or internal events with media
- Students can upload event images (admin-reviewed)
- Approve and publish student-submitted content

---

## 🔐 Authentication & Security

- JWT-based secure login for Admins and Teachers
- Role-based access control (RBAC)
- File type/size validation and route protection
- Admin-only access to sensitive operations

---

## 💻 Tech Stack

### Frontend:

- React + Vite (admin, students)
- Next.js (teachers)
- Tailwind CSS
- Zustand (State Management)
- Shadcn UI + Lucide Icons
- Framer Motion (UI Animations)

### Backend:

- Node.js + Express
- Prisma ORM
- PostgreSQL

### Additional Integrations:

- Puppeteer (PDF Generation)
- XLSX (Bulk Excel Import)
- Multer (File Upload)
- Cloudinary (Notice PDF hosting)

---

## 📌 Highlights

- Fully responsive and modern UI for mobile and desktop
- Excel-based bulk student and subject import
- Server-side rendered, print-ready reports
- Designed for scalability, privacy, and performance

---

## 🚀 Getting Started

To run this project locally, follow the steps below:

### Clone the Repository

```bash
git clone https://github.com/Mutiur03/School.git
cd School
```

---

### 🔷 Frontend Setup

**Apps:** `admin/`, `students/`, `teachers/`

Each frontend app is independent. Example for `admin`:

1. Navigate to the app folder:

   ```bash
   cd admin
   # or cd students
   # or cd teachers
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file:

   ```env
   VITE_BACKEND_URL=http://localhost:3001
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

The app will be running at: `http://localhost:5173` (or the port shown in your terminal).

---

### 🔶 Backend Setup (`/server`)

**Tech Stack:** Node.js, Express.js, Prisma, PostgreSQL

1. Navigate to the backend folder:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file:

   ```env
    PORT=3001
    DATABASE_URL=...
    JWT_SECRET=...
    private_key= Google Service Private Key
    client_email= Google Service Client Email
    SHEET_ID= Google Sheet ID
    BULK_SMS_API_KEY= SMS API key
    CLOUDINARY_CLOUD_NAME= ...
    CLOUDINARY_API_KEY= ...
    CLOUDINARY_SECRET_KEY= ...
    DOMAIN=".example.com"
    ALLOWED_ORIGINS="https://subdomain.example.com,https://subdomain.example.com,https://subdomain.example.com,https://subdomain.example.com,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000"
   ```

4. Generate Prisma client:

   ```bash
   npx prisma generate
   ```

5. Run migrations:

   ```bash
   npx prisma migrate dev
   ```

6. Start the backend development server:
   ```bash
   npm run dev
   ```

The backend will be running at: `http://localhost:3001`

```
sudo apt update
sudo apt install redis-server -y
sudo systemctl enable redis
sudo systemctl start redis
```

---

sudo apt-get install chromium-browser
https://stackoverflow.com/questions/59979188/error-failed-to-launch-the-browser-process-puppeteer

## 🚀 Live Demo

🔗 **Live Site:** [Live](https://www.mutiurrahman.com/projects/school-management-system)  
🎥 **Detailed Video:** [YouTube](https://www.youtube.com/watch?v=EIk6t_aUbpY)

---

## 🤝 Contact

Looking to collaborate or hire for full-stack projects?  
📬 Reach out via [LinkedIn](https://www.linkedin.com/in/mutiur-rahman-mr/) or [Fiverr](https://www.fiverr.com/mutiur_rahman03)

---
