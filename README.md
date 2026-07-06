# GoldGuard AI — Gold Loan Inspection & Fraud Prevention Platform

GoldGuard AI is a state-of-the-art enterprise Gold Loan Inspection and Fraud Prevention Platform designed for banks, NBFCs, and gold loan providers. The platform standardizes the branch-level jewelry appraisal process, records comprehensive inspection evidence, performs multi-layered AI verification, and enforces security and auditing controls to eliminate gold loan fraud.

---

## 🚀 Key Platform Features

1. **Guided Multi-Step Appraisal Workflow**
   - Step-by-step appraiser inspection wizard: customer verification, jewelry details entry, precise weight/dimensions recording, multi-angle photo capturing, spectrographic light reflection analysis, and touchstone acid reactivity streaks.
   - Real-time **Inspection Quality Score** updates based on the count and completeness of uploaded evidence.

2. **Advanced Multi-Model AI Diagnostics**
   - **Model 1: Surface Analysis (MobileNetV3):** Classifies jewelry texture into Real Gold, Gold-Plated, Copper, or Artificial.
   - **Model 2: Defect Localization (YOLOv11):** Detects fractures, structural anomalies, and visual flaws.
   - **Model 3: Volumetric Density Engine:** Computes physical displacement density and flags lead/tungsten/brass core contaminants.
   - **Model 4: Light Reflection Spectrography (RandomForest):** Inspects surface reflectivity and metallic lustre patterns.
   - **Model 5: Touchstone Acid Reactivity (ResNet18):** Analyzes streak color degradation rates on assay stones.
   - **Model 6: Hybrid Decision Fusion:** Integrates model outputs with custom business rule overrides to output final Authenticity & Risk scores.

3. **Dynamic PDF Streaming Reports**
   - Real-time generated inspection reports streamed directly in-memory (zero ephemeral server disk storage needed).
   - Generates executive narrative assessments, physical specifications, AI model score breakdown, audit logs, and fraud alerts.

4. **Multi-Tenant Branch & Regional Isolation**
   - Role-Based Access Control (RBAC) separating Super Admins, Regional Managers, Branch Managers, Appraisers, and Auditors.
   - Restricts data visibility strictly by Organization, Region, and Branch limits.

5. **Risk-Indexed History & Dashboard**
   - Visual dashboard graphs showing total inspections, volume value, fraud trend charts, branch performance leaderboards, and real-time audit trails.
   - Instant duplicate image reuse fraud detection flagging identical images submitted across different loan applications.

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 18 + Vite
- **Routing:** TanStack Router
- **State Management:** Zustand (persisted via IndexDB storage wrapper)
- **Styling:** Vanilla CSS, Lucide icons, glassmorphic UI components, and premium custom dashboard graphs
- **HTTP Client:** Fetch API client with automatic token attachment

### Backend
- **Framework:** FastAPI
- **Web Server:** Uvicorn
- **ORM:** SQLAlchemy (Async)
- **Database Migrations:** Alembic
- **PDF Generation:** FPDF2
- **Logging:** Structured JSON logging
- **Rate Limiter:** Slowapi

### AI & Machine Learning
- PyTorch
- Torchvision
- Ultralytics YOLOv11
- Scikit-learn
- OpenCV (cv2)

---

## 💻 Local Setup & Development

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` folder based on `.env.example`:
   ```ini
   DATABASE_URL=sqlite+aiosqlite:///./goldguard.db
   SECRET_KEY=your_jwt_secret_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
5. Run database migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the backend dev server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The interactive Swagger API documentation is available at: http://localhost:8000/docs*

### 2. Frontend Setup

1. Install frontend Node modules:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Access the app at: http://localhost:5173*
3. Log in with the preloaded default appraiser credentials:
   - **Username:** `priya.sharma@goldguard.ai`
   - **Password:** `password123`

---

## 🌐 Production Deployment Guide

For full step-by-step production deployment instructions, environment variable keys, database setup on Supabase, backend hosting on Render, and frontend deployment on Vercel, please refer to the comprehensive `DEPLOYMENT.md` guide in the repository root.
