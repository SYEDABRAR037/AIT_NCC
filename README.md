# National Cadet Corps (NCC) Unit Web & Management Portal 🇮🇳

An institutional, enterprise-grade command portal and web management system for the NCC Detachment at Army Institute of Technology (AIT), Pune (affiliated with 2 Maharashtra Battalion NCC, Pune).

---

## 🎖️ Key Features

- **Institutional Website**:
  - Regimental homepage featuring unit history, ethos, dynamic activity galleries, live strength counter, and verified achievements.
  - Interactive event calendars, camp announcements, and parade orders.
  - **Command Saathi**: 24/7 AI Cadet Assistant powered by Google Gemini and Anthropic Claude for cadet guidance.

- **Cadet Enrollment & Multi-Tier Verification**:
  - Secure self-registration with duplicate prevention on email, regimental number, and roll number.
  - On-device **Biometric Face Capture** using FaceNet 128-dimensional embedding vectors for automatic muster.
  - Institutional approval hierarchy: `Senior Cadet` → `Platoon Senior` → `ANO (Associate NCC Officer)` final clearance.

- **Command Shells & Multi-Role Portals**:
  - **Cadet Shell**: Digital cadet ID, biometric attendance logs, leave applications, duty rosters, and camp registrations.
  - **Platoon Senior Shell**: Platoon drill muster, strength reports, and applicant vetting.
  - **Admin / ANO Command Shell**: Institutional master dashboard, applicant approval center, biometric attendance override, notifications dispatch (SMS & WhatsApp via Fast2SMS / Twilio / MSG91).

---

## 🛠️ Tech Stack

- **Frontend**:
  - React 19, TypeScript, Vite
  - Lucide React icons, CSS3 Design Tokens
  - `@vladmandic/face-api` (Browser-side neural net face detection & vector extraction)
- **Backend**:
  - Node.js, Express, TypeScript
  - Prisma ORM
  - PostgreSQL database
  - JWT Session & Cookie Authentication with bcrypt hashing
- **DevOps**:
  - Docker, Docker Compose, Nginx

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running locally
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/SYEDABRAR037/AIT_NCC.git
cd AIT_NCC
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL credentials and API keys
npx prisma migrate dev
npx prisma db seed
npm run dev
```
Backend will start on `http://localhost:5050`.

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Frontend will be accessible at `http://localhost:3000`.

---

## 📜 License
Developed for AIT Pune NCC Unit. All rights reserved.
