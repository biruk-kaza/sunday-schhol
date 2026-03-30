# Sunday School Management System: Implementation Plan

## 1. Project Vision
To replace traditional paper-based attendance with a digital, mobile-friendly solution that supports **Saturday and Sunday sessions**. It proactively identifies students at risk of disconnection by flagging consecutive absences and streamlining follow-up actions.

## 2. Core Features (The "What")
### A. Student & Parent CRM
- **Profiles:** Name, Grade/Class, Date of Birth.
- **Contact Info:** Primary parent/guardian phone number and email (one-click call/text integration).
- **Photos:** Optional student photos to help teachers identify them quickly.

### B. Paperless Attendance Tracking
- **Multi-Day Logging:** Easily switch between **Saturday** and **Sunday** sessions.
- **Quick Logging:** A grid view of students where teachers simply toggle "Present" or "Absent".
- **Notes:** Add a quick note for a specific session (e.g., "Left early for doctor appointment").

### C. Professional Risk Logic (The Flagging Engine)
Instead of a simple "missed count," the system uses a professional **Weighted Risk Score (WRS)** model (0–100) to identify at-risk students accurately:
- **Base Score:** 0 (Perfect attendance).
- **Session Miss (+15 pts):** Every individual session missed (Saturday or Sunday).
- **Weekend Penalty (+20 pts):** Additional points if *both* sessions of a single weekend are missed (indicates total disengagement).
- **Sliding Window:** Only assesses the last **6 sessions** (3 weekends) to focus on recent behavior.
- **Engagement Trajectory:** If a student's attendance drops from 100% to 50% in the last month, the score increases faster.

#### Dynamic Thresholds:
- 🟢 **Active (Score 0-15):** No action needed.
- 🟡 **Watching (Score 16-45):** This student has missed 1-2 sessions recently; teacher should observe.
- 🔴 **Action Required (Score 46+):** This student has missed a full weekend OR has a persistent pattern of absence. They appear at the top of the "Call List."

### D. Action & Follow-up Log
- **Call Log:** Record when a parent was called and what the outcome was.
- **Automatic Clearing:** Once a student returns and is marked present, their risk score resets to 0.

### E. Attendance History & Student Profiles
- **Master History:** A searchable calendar or table showing every past attendance record, filterable by date, class, or student.
- **Individual Logs:** A "Timecard" view for each student showing their entire history (e.g., 85% attendance rate over the last 6 months).
- **Summary Reports:** Monthly PDF or Excel reports for the church leadership.

### F. Long-term Sustainability Features
To ensure the system lasts for decades without maintenance or cost:
- **Low-Dependency Design:** Build using "Vanilla" React and CSS to avoid the "dependency hell" that breaks apps over time.
- **Yearly Promotion Tool:** A "New School Year" button that automatically moves all Grade 1 students to Grade 2 and archives the old data while keeping it viewable.
- **Data Portability (The "Escape Hatch"):** A one-click "Download All Data" button so you always have a copy on your local computer.
- **Offline Mode:** Using PWA technology so teachers can mark attendance even if the church Wi-Fi or mobile data is down.

## 3. Technology Stack (The "How": Completely Free & Long-term)
To ensure this remains free forever (for small to medium congregations), we will use services with generous free tiers:

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Frontend UI** | React + Vite | Fast, modern, and industry-standard. |
| **Styling** | Vanilla CSS / CSS Modules | Clean, custom look; will never be "deprecated". |
| **Database/Auth** | **Supabase** | Free tier includes 500MB database and unlimited authentication. |
| **Hosting** | Vercel or Netlify | $0 for hobby/non-profit projects. |
| **Mobile Access** | **PWA (Progressive Web App)** | Teachers "Add to Home Screen" for an app-like experience. |

## 4. Proposed Database Schema
```mermaid
erDiagram
    CLASS ||--o{ STUDENT : contains
    STUDENT ||--o{ ATTENDANCE : records
    STUDENT ||--o{ FOLLOW_UP : tracks
    
    STUDENT {
        uuid id PK
        string name
        string parent_phone
        int grade
        date joined_date
        boolean is_active
    }
    
    ATTENDANCE {
        uuid id PK
        uuid student_id FK
        date session_date
        string session_type -- "Saturday" or "Sunday"
        boolean is_present
        text teacher_note
    }

    FOLLOW_UP {
        uuid id PK
        uuid student_id FK
        date call_date
        text summary
        string result -- "Healthy", "Sick", "Relocated"
    }
```

## 5. Implementation Steps (The Roadmap)
1.  **Architecture Setup:** Initialize the Vite project and connect it to a Supabase project.
2.  **Schema Definition:** Create the tables for Students, Attendance, and Follow-ups.
3.  **UI Foundation:** Build a dashboard with "Today's Session" and "History" tabs.
4.  **Logging Interface:** Interactive grid for session-specific attendance.
5.  **History & Profile View:** Create the searchable master log for **every past attendance**.
6.  **Flagging Logic:** Write the SQL View that detects missed weekends.
7.  **Data Export & Management:** Add CSV export and "Yearly Promotion" functions.
8.  **PWA Setup:** Finalize for offline-ready, app-like use.

## 6. Long-term Sustainability
- **Data Ownership:** Built-in "Export to CSV" ensures you never lose data.
- **Scaling:** Supabase handles up to ~10,000 students on the free tier.
- **Forward-Proof:** The code is yours, and can be hosted elsewhere if these free services ever change.
