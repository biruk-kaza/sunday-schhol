import React, { createContext, useContext, useState, useEffect } from 'react';

// Common Amharic Translations
const translations = {
  en: {
    // General
    "app.title": "Sunday School Pro",
    "app.loading": "Loading...",
    "btn.save": "Save",
    "btn.submit": "Submit",
    "btn.cancel": "Cancel",
    "btn.edit": "Edit",
    "btn.delete": "Delete",
    "btn.signOut": "Sign Out",
    "status.active": "Active",
    "status.pending": "Pending",
    "day.monday": "Monday",
    "day.tuesday": "Tuesday",
    "day.wednesday": "Wednesday",
    "day.thursday": "Thursday",
    "day.friday": "Friday",
    "day.saturday": "Saturday",
    "day.sunday": "Sunday",

    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.attendance": "Attendance",
    "nav.riskWatch": "Risk Watch",
    "nav.students": "Students",
    "nav.analytics": "Analytics",
    "nav.settings": "Settings",
    "nav.home": "Home",
    "nav.today": "Today",
    "nav.people": "People",
    "nav.stats": "Stats",

    // Dashboard
    "dash.execDashboard": "Executive Dashboard",
    "dash.teacherPortal": "Teacher Portal",
    "dash.totalEnrollment": "Total Enrollment",
    "dash.classSize": "Class size",
    "dash.classParticipation": "Class Participation",
    "dash.weeklyCheckins": "Weekly Check-ins",
    "dash.attendanceTitle": "Attendance",
    "dash.prepareAttendance": "Prepare attendance for",
    "dash.openAttendance": "Open Attendance Sheet",
    "dash.riskTitle": "High Priority Risk",
    "dash.noRisk": "No high-risk students found.",
    "dash.gradePerformance": "Grade-Level Performance",

    // Attendance
    "att.title": "Attendance",
    "att.weekend": "Weekend",
    "att.weekday": "Weekday",
    "att.submitted": "Submitted",
    "att.editing": "Editing",
    "att.search": "Search student...",
    "att.allGrades": "All Grades",
    "att.allPresent": "All Present",
    "att.today": "Today",
    "att.past": "Past",
    "att.upcoming": "Upcoming",
    "att.present": "Present",
    "att.absent": "Absent",
    "att.permission": "Permission",
    "att.unmarked": "unmarked",
    "att.saving": "Saving...",
    "att.submitBtn": "Submit Attendance",
    "att.offlineMode": "Offline mode — using cached roster",
    "att.noStudents": "No students found",

    // Students
    "stu.title": "Student Directory",
    "stu.addStudent": "Add Student",
    "stu.fullName": "Full Name",
    "stu.grade": "Grade",
    "stu.program": "Program",
    "stu.parentPhone": "Parent Phone",
    "stu.status": "Status",
    "stu.actions": "Actions",

    // Settings
    "set.title": "Settings",
    "set.accessProfile": "Your Access Profile",
    "set.email": "Email",
    "set.role": "Role",
    "set.language": "Language",
    "set.export": "Export Students List (CSV)",
    "set.yearlyPromotion": "Yearly Grade Promotion",
    "set.dataManagement": "Data Management",
    
    // Auth / Login
    "auth.enterCredentials": "Enter your credentials to access the portal.",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.authenticating": "Authenticating...",
    "auth.signIn": "Sign In"
  },
  am: {
    // General
    "app.title": "ሰንበት ትምህርት ቤት ፕሮ",
    "app.loading": "እየጫነ ነው...",
    "btn.save": "አስቀምጥ",
    "btn.submit": "አስገባ",
    "btn.cancel": "ሰርዝ",
    "btn.edit": "አስተካክል",
    "btn.delete": "ሰርዝ",
    "btn.signOut": "ውጣ",
    "status.active": "ንቁ",
    "status.pending": "በመጠባበቅ ላይ",
    "day.monday": "ሰኞ",
    "day.tuesday": "ማክሰኞ",
    "day.wednesday": "ረቡዕ",
    "day.thursday": "ሐሙስ",
    "day.friday": "አርብ",
    "day.saturday": "ቅዳሜ",
    "day.sunday": "እሑድ",

    // Navigation
    "nav.dashboard": "ዳሽቦርድ",
    "nav.attendance": "ክትትል",
    "nav.riskWatch": "አደጋ ክትትል",
    "nav.students": "ተማሪዎች",
    "nav.analytics": "ትንታኔ ክፍሎች",
    "nav.settings": "ቅንብሮች",
    "nav.home": "ዋና ገጽ",
    "nav.today": "ዛሬ",
    "nav.people": "ሰዎች",
    "nav.stats": "ስታቲስቲክስ",

    // Dashboard
    "dash.execDashboard": "የአስተዳዳሪ ዳሽቦርድ",
    "dash.teacherPortal": "የመምህራን ፖርታል",
    "dash.totalEnrollment": "ጠቅላላ ምዝገባ",
    "dash.classSize": "የክፍል ብዛት",
    "dash.classParticipation": "የክፍል ተሳትፎ",
    "dash.weeklyCheckins": "ሳምንታዊ ክትትል",
    "dash.attendanceTitle": "ክትትል",
    "dash.prepareAttendance": "ለክትትል ዝግጁ ነዎት",
    "dash.openAttendance": "የክትትል ቅጽ ክፈት",
    "dash.riskTitle": "ከፍተኛ አደጋ ላይ ያሉ",
    "dash.noRisk": "አደጋ ላይ ያለ ተማሪ አልተገኘም።",
    "dash.gradePerformance": "የክፍል ደረጃ አፈጻጸም",

    // Attendance
    "att.title": "ክትትል",
    "att.weekend": "ቅዳሜና እሑድ",
    "att.weekday": "ከሰኞ - አርብ",
    "att.submitted": "ገብቷል",
    "att.editing": "በማስተካከል ላይ",
    "att.search": "ተማሪ ፈልግ...",
    "att.allGrades": "ሁሉም ክፍሎች",
    "att.allPresent": "ሁሉም ተገኝተዋል",
    "att.today": "ዛሬ",
    "att.past": "ያለፈ",
    "att.upcoming": "ቀጣይ",
    "att.present": "ተገኝቷል",
    "att.absent": "አልተገኘም",
    "att.permission": "ፍቃድ",
    "att.unmarked": "ያልተመዘገቡ",
    "att.saving": "እያስቀመጠ ነው...",
    "att.submitBtn": "ክትትል አስገባ",
    "att.offlineMode": "ከመስመር ውጭ (የተቀመጠ መረጃ በመጠቀም ላይ)",
    "att.noStudents": "ተማሪዎች አልተገኙም",

    // Students
    "stu.title": "የተማሪዎች ማውጫ",
    "stu.addStudent": "ተማሪ አክል",
    "stu.fullName": "ሙሉ ስም",
    "stu.grade": "ክፍል",
    "stu.program": "ፕሮግራም",
    "stu.parentPhone": "የወላጅ ስልክ",
    "stu.status": "ሁኔታ",
    "stu.actions": "ድርጊቶች",

    // Settings
    "set.title": "ቅንብሮች",
    "set.accessProfile": "የእርስዎ መለያ ዝርዝር",
    "set.email": "ኢሜይል",
    "set.role": "ኃላፊነት",
    "set.language": "ቋንቋ / Language",
    "set.export": "የተማሪዎችን ዝርዝር አውርድ (CSV)",
    "set.yearlyPromotion": "ዓመታዊ የክፍል ዕድገት",
    "set.dataManagement": "መረጃ አስተዳደር",

    // Auth / Login
    "auth.enterCredentials": "ወደ ሲስተሙ ለመግባት መረጃዎን ያስገቡ።",
    "auth.email": "ኢሜይል",
    "auth.password": "የይለፍ ቃል",
    "auth.authenticating": "በማረጋገጥ ላይ...",
    "auth.signIn": "ግባ"
  }
};

const LanguageContext = createContext({});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('ssp_lang') || 'en';
  });

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'am' : 'en';
    setLanguage(newLang);
    localStorage.setItem('ssp_lang', newLang);
  };

  const setLanguageDirectly = (lang) => {
    setLanguage(lang);
    localStorage.setItem('ssp_lang', lang);
  }

  // Translation function
  const t = (key) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  // Add lang attribute to html tag for styling targeting
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguageDirectly, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
