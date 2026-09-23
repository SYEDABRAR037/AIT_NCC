import React, { useState, useEffect } from 'react';
import {
  Users,
  LogOut,
  ChevronRight,
  Shield,
  ArrowLeft,
  Search,
  RefreshCw,
  Calendar,
  Bell,
  Plus,
  Clock,
  Flag,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Camera,
  Check,
  X,
  Award,
  Printer,
  ShieldCheck,
  Copy,
  Download,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FaceAttendanceModal } from '../attendance/FaceAttendanceModal';
import { FaceEnrollmentModal } from '../attendance/FaceEnrollmentModal';
import { CadetProfileView } from './CadetProfileView';
import { RequestCenterView } from './RequestCenterView';
import { ApprovalCenterView } from './ApprovalCenterView';
import { TimelineView } from './TimelineView';
import { CampsActivitiesView } from './CampsActivitiesView';
import { DutyRosterView } from './DutyRosterView';
import { InquiryDeskView } from './InquiryDeskView';


interface RoleShellViewProps {
  role: string;
  onBackToHome: () => void;
}

export const RoleShellView: React.FC<RoleShellViewProps> = ({ role, onBackToHome }) => {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Admin Data State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [adminSummary, setAdminSummary] = useState<any | null>(null);
  const [adminCamps, setAdminCamps] = useState<any[]>([]);
  const [adminEvents, setAdminEvents] = useState<any[]>([]);
  const [adminNotices, setAdminNotices] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPlatoon, setFilterPlatoon] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // New Item Creation Modals State
  const [newCampModal, setNewCampModal] = useState(false);
  const [newEventModal, setNewEventModal] = useState(false);
  const [newNoticeModal, setNewNoticeModal] = useState(false);

  const [campForm, setCampForm] = useState({
    name: '',
    campType: 'Combined Annual Training Camp',
    location: 'AIT Grounds, Pune',
    startDate: '',
    endDate: '',
    description: '',
    capacity: 50,
  });

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventDate: '',
    location: 'AIT Parade Grounds',
    isPublic: true,
  });

  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    category: 'General',
    isUrgent: false,
    isPublic: true,
  });

  // Phase 7-9: Senior & Platoon Senior assigned cadets
  const [assignedCadets, setAssignedCadets] = useState<any[]>([]);
  const [platoonCadets, setPlatoonCadets] = useState<any[]>([]);

  // Phase 7-9: Leave Management State
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]); // for review (senior/PS/admin)
  const [myLeaves, setMyLeaves] = useState<any[]>([]);                   // own leaves (cadet)
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveRemarkModal, setLeaveRemarkModal] = useState<{ leave: any; action: string } | null>(null);
  const [leaveRemarks, setLeaveRemarks] = useState('');
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Medical',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Phase 9: Cadet notices feed
  const [cadetNotices, setCadetNotices] = useState<any[]>([]);

  // Phase 10: Attendance Management State
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [selectedAttendanceSession, setSelectedAttendanceSession] = useState<any | null>(null);
  const [myAttendanceData, setMyAttendanceData] = useState<{ stats: any; records: any[] }>({
    stats: { total: 0, present: 0, absent: 0, excused: 0, percentage: 0 },
    records: [],
  });
  const [attendanceSummaryList, setAttendanceSummaryList] = useState<any[]>([]);
  const [newAttendanceSessionModal, setNewAttendanceSessionModal] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    title: '',
    activity: 'Morning Physical Training & Foot Drill',
    timing: '0600 - 0730 hrs',
    location: 'AIT Central Parade Grounds',
    focus: 'Squad drill, cadence alignment, and rifle drill',
    targetPlatoon: 'Unit Contingent',
    date: new Date().toISOString().split('T')[0],
  });
  const [biometricCameraActive, setBiometricCameraActive] = useState(false);
  const [enrollCadetTarget, setEnrollCadetTarget] = useState<any | null>(null);
  // Inline confirm state for accidental-change-prone dropdowns
  const [pendingAction, setPendingAction] = useState<{ userId: string; userName: string; type: 'role' | 'status' | 'platoon'; value: string } | null>(null);

  // Phase 11: Digital Certificate Vault State
  const [cadetCertificates, setCadetCertificates] = useState<any[]>([]);
  const [allCertificates, setAllCertificates] = useState<any[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<any | null>(null);
  const [newCertificateModal, setNewCertificateModal] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [verifyingHash, setVerifyingHash] = useState(false);
  const [certificateForm, setCertificateForm] = useState({
    cadetId: '',
    certificateType: "NCC 'B' Certificate",
    title: "National Cadet Corps 'B' Certificate Examination",
    grade: 'A',
    campName: 'Annual Training Camp ATC (Pune)',
    remarks: 'Distinction in Weapon Training (.22 Rifle) and Drill Bearing',
  });

  // Notification Gateway State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Bulk Importers State (Google Sheets / CSV)
  const [attendanceImportModal, setAttendanceImportModal] = useState(false);
  const [attendanceImportText, setAttendanceImportText] = useState('');
  const [attendanceImportSessionId, setAttendanceImportSessionId] = useState('');
  const [attendanceImportPreview, setAttendanceImportPreview] = useState<any[]>([]);
  const [importingAttendance, setImportingAttendance] = useState(false);

  const [cadetImportModal, setCadetImportModal] = useState(false);
  const [cadetImportText, setCadetImportText] = useState('');
  const [cadetImportPreview, setCadetImportPreview] = useState<any[]>([]);
  const [importingCadets, setImportingCadets] = useState(false);

  // Fetch Admin Summary
  const fetchAdminSummary = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdminSummary(data.summary);
      }
    } catch (err) {
      console.error('Fetch admin summary error:', err);
    }
  };

  const fetchAdminCamps = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/camps', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setAdminCamps(data.camps);
    } catch (err) {
      console.error('Fetch camps error:', err);
    }
  };

  const fetchAdminEvents = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setAdminEvents(data.events);
    } catch (err) {
      console.error('Fetch events error:', err);
    }
  };

  const fetchAdminAuditLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setAdminAuditLogs(data.logs);
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    }
  };

  const fetchAdminNotices = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/notices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setAdminNotices(data.notices);
    } catch (err) {
      console.error('Fetch notices error:', err);
    }
  };


  const handleDeleteEvent = async (id: string, _title?: string) => {
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdminEvents();
      } else {
        alert(data.message || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Delete event error:', err);
    }
  };

  const handleDeleteNotice = async (id: string, _title?: string) => {
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdminNotices();
      } else {
        alert(data.message || 'Failed to delete notice');
      }
    } catch (err) {
      console.error('Delete notice error:', err);
    }
  };

  // Fetch Admin Users
  const fetchAdminUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterRole) params.append('role', filterRole);
      if (filterPlatoon) params.append('platoon', filterPlatoon);

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsersList(data.users);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch Senior Assigned Cadets
  const fetchSeniorCadets = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/hierarchy/senior/cadets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAssignedCadets(data.assignedCadets);
      }
    } catch (err) {
      console.error('Fetch senior cadets error:', err);
    }
  };

  // Fetch Platoon Cadets
  const fetchPlatoonCadets = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/hierarchy/platoon-senior/cadets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlatoonCadets(data.cadets);
      }
    } catch (err) {
      console.error('Fetch platoon cadets error:', err);
    }
  };

  // Registration Review Queue State
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);

  // Fetch Pending Reviews
  const fetchPendingReviews = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/reviews/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.applications)) {
          setPendingReviews(data.applications);
          return;
        }
      }
      throw new Error('Non-JSON response');
    } catch (err) {
      console.warn('Fetch pending reviews fallback:', err);
      try {
        const offlineCadets: any[] = JSON.parse(localStorage.getItem('ncc_offline_cadets') || '[]');
        setPendingReviews(offlineCadets.filter((c: any) => c.status === 'UNDER_REVIEW' || c.status === 'HOLD'));
      } catch {}
    }
  };

  // Fetch Leave Applications (for review — Senior/PS/Admin)
  const fetchLeaveApplications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/leave/review', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setLeaveApplications(data.leaves);
    } catch (err) {
      console.error('Fetch leave applications error:', err);
    }
  };

  // Fetch My Leaves (for cadet's own leave history)
  const fetchMyLeaves = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/leave/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setMyLeaves(data.leaves);
    } catch (err) {
      console.error('Fetch my leaves error:', err);
    }
  };

  // Fetch public notices for cadet portal
  const fetchCadetNotices = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/public/notices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) setCadetNotices(data.notices || []);
    } catch (err) {
      console.error('Fetch cadet notices error:', err);
    }
  };

  // Phase 10: Attendance Fetchers & Handlers
  const fetchAttendanceSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/attendance/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAttendanceSessions(data.sessions || []);
        if (data.sessions?.length > 0 && !selectedAttendanceSession) {
          fetchSessionDetails(data.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch attendance sessions error:', err);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedAttendanceSession(data.session);
      }
    } catch (err) {
      console.error('Fetch session attendance error:', err);
    }
  };

  const fetchMyAttendance = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/attendance/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMyAttendanceData({ stats: data.stats, records: data.records || [] });
      }
    } catch (err) {
      console.error('Fetch my attendance error:', err);
    }
  };

  const fetchAttendanceSummary = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/attendance/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAttendanceSummaryList(data.summary || []);
      }
    } catch (err) {
      console.error('Fetch attendance summary error:', err);
    }
  };

  const handleMarkCadetAttendance = async (sessionId: string, cadetId: string, status: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}/mark`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cadetId, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchSessionDetails(sessionId);
        fetchAttendanceSessions();
      } else {
        alert(data.message || 'Failed to mark attendance');
      }
    } catch (err) {
      console.error('Mark attendance error:', err);
    }
  };

  const handleCreateAttendanceSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(attendanceForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewAttendanceSessionModal(false);
        setAttendanceForm({
          title: '',
          activity: 'Morning Physical Training & Foot Drill',
          timing: '0600 - 0730 hrs',
          location: 'AIT Central Parade Grounds',
          focus: 'Squad drill, cadence alignment, and rifle drill',
          targetPlatoon: 'Unit Contingent',
          date: new Date().toISOString().split('T')[0],
        });
        fetchAttendanceSessions();
        if (data.session) {
          setSelectedAttendanceSession(data.session);
          setBiometricCameraActive(true);
        }
      } else {
        alert(data.message || 'Failed to create attendance session');
      }
    } catch (err) {
      console.error('Create attendance session error:', err);
    }
  };

  // Phase 11: Digital Certificate Vault Handlers
  const fetchCadetCertificates = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/certificates/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCadetCertificates(data.certificates || []);
      }
    } catch (err) {
      console.error('Fetch cadet certificates error:', err);
    }
  };

  const fetchAllCertificates = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/certificates/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAllCertificates(data.certificates || []);
      }
    } catch (err) {
      console.error('Fetch all certificates error:', err);
    }
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(certificateForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setNewCertificateModal(false);
        setCertificateForm({
          cadetId: '',
          certificateType: "NCC 'B' Certificate",
          title: "National Cadet Corps 'B' Certificate Examination",
          grade: 'A',
          campName: 'Annual Training Camp ATC (Pune)',
          remarks: 'Distinction in Weapon Training (.22 Rifle) and Drill Bearing',
        });
        fetchAllCertificates();
      } else {
        alert(data.message || 'Failed to issue digital certificate');
      }
    } catch (err) {
      console.error('Issue certificate error:', err);
    }
  };

  const handleRevokeCertificate = async (certId: string) => {
    if (!token) return;
    const reason = prompt('Enter official revocation reason:');
    if (!reason) return;
    try {
      const res = await fetch(`/api/certificates/${certId}/revoke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remarks: reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchAllCertificates();
      } else {
        alert(data.message || 'Failed to revoke certificate');
      }
    } catch (err) {
      console.error('Revoke certificate error:', err);
    }
  };

  const handleVerifyQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setVerifyingHash(true);
    try {
      const encoded = encodeURIComponent(queryText.trim());
      const res = await fetch(`/api/certificates/verify/${encoded}`);
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      console.error('Verify certificate query error:', err);
      setVerifyResult({ success: false, message: 'Server verification connection error' });
    } finally {
      setVerifyingHash(false);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  // CSV Parser for Attendance
  const parseAttendanceCSV = (rawText: string) => {
    const lines = rawText.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('regimental') || firstLine.includes('roll') || firstLine.includes('status') ? 1 : 0;
    const records = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 1 && parts[0]) {
        records.push({
          regimentalNumber: parts[0],
          status: parts[1] ? parts[1].toUpperCase() : 'PRESENT',
          remarks: parts[2] || 'Imported via spreadsheet',
        });
      }
    }
    return records;
  };

  // CSV Parser for Cadets
  const parseCadetCSV = (rawText: string) => {
    const lines = rawText.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('name') || firstLine.includes('regimental') || firstLine.includes('roll') ? 1 : 0;
    const records = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 4) {
        records.push({
          fullName: parts[0],
          regimentalNumber: parts[1],
          collegeRollNumber: parts[2],
          email: parts[3],
          phone: parts[4] || '',
          year: parts[5] || 'FE (1st Year)',
          branch: parts[6] || 'Computer Engineering',
          platoonName: parts[7] || 'Senior Division',
        });
      }
    }
    return records;
  };

  const handleExecuteAttendanceImport = async () => {
    if (!token || !attendanceImportSessionId) {
      alert('Please select a target parade session.');
      return;
    }
    if (attendanceImportPreview.length === 0) {
      alert('No valid records parsed from the spreadsheet data.');
      return;
    }
    setImportingAttendance(true);
    try {
      const res = await fetch('/api/attendance/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId: attendanceImportSessionId,
          records: attendanceImportPreview,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setAttendanceImportModal(false);
        setAttendanceImportText('');
        setAttendanceImportPreview([]);
        fetchAttendanceSessions();
        fetchAttendanceSummary();
      } else {
        alert(data.message || 'Import failed.');
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Error during attendance import');
    } finally {
      setImportingAttendance(false);
    }
  };

  const handleExecuteCadetImport = async () => {
    if (!token) return;
    if (cadetImportPreview.length === 0) {
      alert('No valid cadet records found in the pasted data.');
      return;
    }
    setImportingCadets(true);
    try {
      const res = await fetch('/api/admin/import-cadets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cadets: cadetImportPreview }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setCadetImportModal(false);
        setCadetImportText('');
        setCadetImportPreview([]);
        fetchAdminUsers();
        fetchAdminSummary();
      } else {
        alert(data.message || 'Cadet import failed.');
      }
    } catch (err) {
      console.error('Cadet import error:', err);
      alert('Error during cadet import');
    } finally {
      setImportingCadets(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    if (role === 'ADMIN_ANO') {
      fetchAdminUsers();
      fetchPendingReviews();
      fetchAdminSummary();
      fetchAdminCamps();
      fetchAdminEvents();
      fetchAdminNotices();
      fetchAdminAuditLogs();
      fetchLeaveApplications();
      fetchAttendanceSessions();
      fetchAllCertificates();
    } else if (role === 'SENIOR') {
      fetchSeniorCadets();
      fetchPendingReviews();
      fetchLeaveApplications();
      fetchAttendanceSessions();
      fetchAttendanceSummary();
      fetchCadetCertificates();
    } else if (role === 'PLATOON_SENIOR') {
      fetchPlatoonCadets();
      fetchPendingReviews();
      fetchLeaveApplications();
      fetchAttendanceSessions();
      fetchAttendanceSummary();
      fetchCadetCertificates();
    } else if (role === 'CADET') {
      fetchMyLeaves();
      fetchCadetNotices();
      fetchMyAttendance();
      fetchCadetCertificates();
    }
  }, [role, token, filterRole, filterPlatoon]);



  // Admin Actions
  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdminUsers();
      } else {
        alert(data.message || 'Action rejected');
      }
    } catch (err) {
      console.error('Role update error:', err);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdminUsers();
      } else {
        alert(data.message || 'Status update failed');
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleTransferPlatoon = async (userId: string, platoonName: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/platoon`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ platoonName }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchAdminUsers();
      } else {
        alert(data.message || 'Transfer failed');
      }
    } catch (err) {
      console.error('Transfer error:', err);
    }
  };

  // Execute pending inline confirm action
  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { userId, type, value } = pendingAction;
    setPendingAction(null);
    if (type === 'role') await handleUpdateRole(userId, value);
    else if (type === 'status') await handleUpdateStatus(userId, value);
    else if (type === 'platoon') await handleTransferPlatoon(userId, value);
  };



  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/camps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(campForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setNewCampModal(false);
        fetchAdminCamps();
        fetchAdminSummary();
        fetchAdminAuditLogs();
      } else {
        alert(data.message || 'Failed to create camp');
      }
    } catch (err) {
      console.error('Create camp error:', err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(eventForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setNewEventModal(false);
        fetchAdminEvents();
        fetchAdminSummary();
        fetchAdminAuditLogs();
      } else {
        alert(data.message || 'Failed to create event');
      }
    } catch (err) {
      console.error('Create event error:', err);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(noticeForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setNewNoticeModal(false);
        fetchAdminNotices();
        fetchAdminSummary();
        fetchAdminAuditLogs();
      } else {
        alert(data.message || 'Failed to publish notice');
      }
    } catch (err) {
      console.error('Create notice error:', err);
    }
  };

  // Phase 7-9: Submit Leave Application (for Cadet)
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(leaveForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Leave application submitted successfully.');
        setLeaveModal(false);
        setLeaveForm({ leaveType: 'Medical', startDate: '', endDate: '', reason: '' });
        fetchMyLeaves();
      } else {
        alert(data.message || 'Failed to submit leave application');
      }
    } catch (err) {
      console.error('Submit leave error:', err);
    }
  };

  // Phase 7-8: Senior / Platoon Senior processes leave action
  const handleLeaveAction = async () => {
    if (!leaveRemarkModal || !token) return;
    try {
      const res = await fetch(`/api/leave/${leaveRemarkModal.leave.id}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: leaveRemarkModal.action, remarks: leaveRemarks }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        setLeaveRemarkModal(null);
        setLeaveRemarks('');
        fetchLeaveApplications();
      } else {
        alert(data.message || 'Failed to process leave action');
      }
    } catch (err) {
      console.error('Leave action error:', err);
    }
  };

  const getRoleMeta = () => {

    switch (role) {
      case 'ADMIN_ANO':
        return {
          title: 'ANO / Admin Command Center',
          subtitle: 'Institutional Command & Administrative Sanction',
          badge: 'ANO COMMAND LEVEL',
          items: [
            { id: 'overview', name: 'Command Overview' },
            { id: 'approvals', name: 'Central Approval Desk' },
            { id: 'inquiries', name: 'Official Inquiries' },
            { id: 'leave', name: 'Leave Sanctions' },
            { id: 'cadets', name: 'Cadet Directory & Roles' },
            { id: 'camps', name: 'Camps & Activities' },
            { id: 'duties', name: 'Duty & Ceremonial Detail' },
            { id: 'timeline', name: 'Unit Activity Timeline' },
            { id: 'certificates', name: 'Certificate Vault & Issuance' },
            { id: 'notices', name: 'Institutional Notices' },
            { id: 'audit', name: 'Audit Logs' },
          ],
        };
      case 'PLATOON_SENIOR':
        return {
          title: 'Platoon Senior Command Panel',
          subtitle: 'Platoon Command · Attendance · Leave Review · Cadet Operations',
          badge: 'PLATOON SENIOR LEVEL',
          items: [
            { id: 'overview', name: 'Platoon Overview' },
            { id: 'approvals', name: 'Central Approval Desk' },
            { id: 'inquiries', name: 'Official Inquiries' },
            { id: 'leave', name: 'Leave Sanctions' },
            { id: 'attendance', name: 'Platoon Attendance & Biometrics' },
            { id: 'cadets', name: 'Platoon Cadets' },
            { id: 'camps', name: 'Camps & Nominations' },
            { id: 'duties', name: 'Duty & Ceremonial Detail' },
            { id: 'timeline', name: 'Activity Timeline' },
            { id: 'certificates', name: 'My Certificates' },
          ],
        };
      case 'SENIOR':
        return {
          title: 'Senior Cadet Management Panel',
          subtitle: 'Squad Mentorship · Cadet Review · Leave Sanction',
          badge: 'SENIOR CADET LEVEL',
          items: [
            { id: 'overview', name: 'Section Overview' },
            { id: 'approvals', name: 'Central Approval Desk' },
            { id: 'inquiries', name: 'Official Inquiries' },
            { id: 'leave', name: 'Leave Sanctions' },
            { id: 'attendance', name: 'Squad Attendance & Biometrics' },
            { id: 'assigned', name: 'Assigned Cadets' },
            { id: 'camps', name: 'Camps & Activities' },
            { id: 'duties', name: 'Duty & Ceremonial Detail' },
            { id: 'timeline', name: 'Activity Timeline' },
            { id: 'certificates', name: 'My Certificates' },
          ],
        };
      case 'CADET':
      default:
        return {
          title: 'Cadet Personal Operations Portal',
          subtitle: 'Digital NCC Record · Leave Applications · Notices & Orders',
          badge: 'ENROLLED CADET LEVEL',
          items: [
            { id: 'overview', name: 'Cadet Dashboard' },
            { id: 'profile', name: 'Digital NCC Profile' },
            { id: 'requests', name: 'NCC Request Center' },
            { id: 'inquiries', name: 'My Official Inquiries' },
            { id: 'timeline', name: 'Activity Timeline' },
            { id: 'camps', name: 'Camps & Activities' },
            { id: 'duties', name: 'My Assigned Duties' },
            { id: 'attendance', name: 'My Attendance Record' },
            { id: 'certificates', name: 'Digital Certificate Vault' },
            { id: 'leave', name: 'Leave Applications' },
            { id: 'notices', name: 'Unit Notices & Orders' },
          ],
        };
    }
  };

  const meta = getRoleMeta();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--white-surface)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Command Bar */}
      <div
        style={{
          backgroundColor: 'var(--navy-primary)',
          color: 'var(--white-pure)',
          borderBottom: '2px solid var(--navy-border)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img
            src="/assets/logos/ncc_logo.png"
            alt="NCC"
            style={{ width: '36px', height: '42px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800 }}>
              {meta.title}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#93C5FD' }}>{meta.subtitle}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* In-App Notification Bell & Popover */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              style={{
                position: 'relative',
                background: notificationsOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '4px',
                padding: '0.45rem 0.6rem',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Command Notifications & Alerts"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '0.1rem 0.35rem',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover */}
            {notificationsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  width: '320px',
                  backgroundColor: '#FFFFFF',
                  color: '#061325',
                  border: '2px solid var(--navy-primary)',
                  borderRadius: '6px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                  zIndex: 1200,
                  maxHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--navy-primary)', color: '#FFFFFF', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em' }}>COMMAND NOTIFICATIONS</span>
                  <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>{unreadCount} Unread</span>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748B', fontSize: '0.82rem' }}>
                      No notifications recorded
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkNotificationRead(n.id)}
                        style={{
                          padding: '0.65rem 1rem',
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: n.isRead ? '#FFFFFF' : '#F0FDF4',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: n.isUrgent ? '#DC2626' : 'var(--navy-primary)' }}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span style={{ width: '7px', height: '7px', backgroundColor: '#047857', borderRadius: '50%', display: 'inline-block', flexShrink: 0, marginTop: '4px' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '0.3rem' }}>
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(n.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="badge-dark" style={{ background: '#061325' }}>
            {meta.badge}
          </span>
          <button
            onClick={onBackToHome}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={14} />
            <span>BACK TO HOMEPAGE</span>
          </button>
          {user && (
            <button
              onClick={async () => {
                await logout();
                onBackToHome();
              }}
              className="btn-outline-white btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <LogOut size={14} />
              <span>LOGOUT</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout: Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 70px)' }}>
        {/* Navy Sidebar */}
        <aside
          style={{
            width: '260px',
            backgroundColor: 'var(--navy-dark)',
            borderRight: '1px solid var(--navy-border)',
            padding: '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: '#94A3B8', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
            OPERATIONAL SECTIONS
          </div>
          {meta.items.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.7rem 0.85rem',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === item.id ? 'var(--navy-hover)' : 'transparent',
                color: activeTab === item.id ? 'var(--white-pure)' : '#CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>{item.name}</span>
              <ChevronRight size={14} style={{ opacity: activeTab === item.id ? 1 : 0.4 }} />
            </button>
          ))}

          <div style={{ marginTop: 'auto', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '4px', border: '1px solid var(--navy-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93C5FD', marginBottom: '0.25rem' }}>
              SECURITY POLICY
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: '1.4' }}>
              Camera for facial attendance is strictly restricted to Platoon Senior & Senior.
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main style={{ flex: 1, padding: '2rem', backgroundColor: 'var(--white-surface)', overflowX: 'auto' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* CENTRAL APPROVAL DESK (MODULE 3 & 7) */}
            {activeTab === 'approvals' && (
              <ApprovalCenterView role={role} />
            )}

            {/* CENTRAL NCC REQUEST CENTER (MODULE 2) */}
            {activeTab === 'requests' && (
              <RequestCenterView />
            )}

            {/* ACTIVITY TIMELINE (MODULE 4) */}
            {activeTab === 'timeline' && (
              <TimelineView role={role} />
            )}

            {/* OFFICIAL INQUIRIES & COMMUNICATIONS DESK (PHASE 14) */}
            {activeTab === 'inquiries' && (
              <InquiryDeskView role={role} token={token} />
            )}



            {/* CAMPS & ACTIVITIES (MODULE 6) */}
            {activeTab === 'camps' && (
              <CampsActivitiesView userRole={role} />
            )}

            {/* CEREMONIAL & BATTALION DUTY ROSTER */}
            {activeTab === 'duties' && (
              <DutyRosterView userRole={role} />
            )}

            {/* 1. ADMIN PANEL: OVERVIEW */}
            {role === 'ADMIN_ANO' && activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Command Overview & Real-Time Statistics</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Institutional oversight of personnel strength, training camps, scheduled events, and operational audits.
                    </p>
                  </div>
                  <button onClick={() => { fetchAdminSummary(); fetchAdminAuditLogs(); }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} />
                    <span>REFRESH DATA</span>
                  </button>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Total Cadets</span>
                      <Users size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                      {adminSummary?.totalCadets ?? 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      {adminSummary?.approvedCadets ?? 0} Active / Approved
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Pending Review</span>
                      <Clock size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>
                      {pendingReviews.length}
                    </div>
                    <button
                      onClick={() => setActiveTab('approvals')}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--navy-primary)', textDecoration: 'underline', cursor: 'pointer', marginTop: '0.25rem' }}
                    >
                      Process queue &rarr;
                    </button>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Training Camps</span>
                      <Flag size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                      {adminCamps.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      Annual & attachment camps
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Scheduled Events</span>
                      <Calendar size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                      {adminEvents.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      Parades & ceremonies
                    </div>
                  </div>
                </div>

                {/* Quick Action Commands */}
                <div className="institutional-card" style={{ marginBottom: '2rem', backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ color: 'var(--white-pure)', fontSize: '1.2rem', marginBottom: '0.25rem' }}>Direct Command Actions</h3>
                      <p style={{ fontSize: '0.85rem', color: '#93C5FD' }}>Execute instant unit operations with audit logging</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button onClick={() => setNewCampModal(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Plus size={14} /> <span>Schedule Camp</span>
                      </button>
                      <button onClick={() => setNewEventModal(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Plus size={14} /> <span>Publish Event</span>
                      </button>
                      <button onClick={() => setNewNoticeModal(true)} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Plus size={14} /> <span>Broadcast Notice</span>
                      </button>
                      <button onClick={() => setActiveTab('cadets')} className="btn-outline-white btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={14} /> <span>Manage Cadets</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Unit Activity Audit Trail */}
                <div className="institutional-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: 'var(--navy-primary)', fontSize: '1.15rem' }}>Recent Operational Activity</h3>
                    <button onClick={() => setActiveTab('audit')} style={{ background: 'none', border: 'none', color: 'var(--navy-primary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                      View all audit logs &rarr;
                    </button>
                  </div>
                  {adminAuditLogs.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>No audit events recorded yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {adminAuditLogs.slice(0, 5).map((log) => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--white-border)', fontSize: '0.85rem' }}>
                          <div>
                            <strong>{log.actorName}</strong>: <span style={{ color: 'var(--navy-primary)', fontWeight: 600 }}>{log.action}</span> &mdash; {log.details}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1. ADMIN PANEL: Cadets Directory & Role Management */}
            {role === 'ADMIN_ANO' && activeTab === 'cadets' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Unit Personnel & Roles</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Authorized management for cadet roles, statuses, platoons, and mentor assignments.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setCadetImportModal(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Download size={14} />
                      <span>BATCH IMPORT ROSTER (CSV/EXCEL)</span>
                    </button>
                    <button onClick={fetchAdminUsers} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <RefreshCw size={14} className={loadingUsers ? 'spinning' : ''} />
                      <span>REFRESH LIST</span>
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', backgroundColor: 'var(--white-pure)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
                    <Search size={16} style={{ color: 'var(--navy-text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search by name, regimental no, roll..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAdminUsers()}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--white-border)', borderRadius: '4px', outline: 'none', fontSize: '0.88rem' }}
                    />
                  </div>

                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem', outline: 'none' }}
                  >
                    <option value="">All Cadets</option>
                    <option value="CADET">Enrolled Cadets</option>
                    <option value="SENIOR">Senior Cadets</option>
                    <option value="PLATOON_SENIOR">Platoon Seniors</option>
                    <option value="ADMIN_ANO">Admin / ANO</option>
                  </select>

                  <select
                    value={filterPlatoon}
                    onChange={(e) => setFilterPlatoon(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem', outline: 'none' }}
                  >
                    <option value="">All Wings / Contingents</option>
                    <option value="Senior Division">Senior Division (SD)</option>
                    <option value="Senior Wing">Senior Wing (SW)</option>
                  </select>
                </div>

                {/* Personnel Table */}
                <div style={{ backgroundColor: 'var(--white-pure)', borderRadius: '4px', border: '1px solid var(--white-border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Cadet / Officer</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Regimental No</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Wing / Contingent</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--navy-text-muted)' }}>
                            <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: 'var(--navy-primary)' }} />
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                              No Cadets Found
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>
                              There are currently no cadets in the system.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        usersList.map((u) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--white-border)', verticalAlign: 'middle' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {u.fullName}
                            <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', fontWeight: 400 }}>{u.email}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>{u.regimentalNumber}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <select
                              value={pendingAction && pendingAction.userId === u.id && pendingAction.type === 'platoon' ? pendingAction.value : (u.platoonName || 'Senior Division')}
                              onChange={(e) => setPendingAction({ userId: u.id, userName: u.fullName, type: 'platoon', value: e.target.value })}
                              style={{ padding: '0.3rem', fontSize: '0.8rem', borderRadius: '3px', border: '1px solid var(--white-border)', cursor: 'pointer' }}
                            >
                              <option value="Senior Division">Senior Division</option>
                              <option value="Senior Wing">Senior Wing</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <select
                              value={pendingAction && pendingAction.userId === u.id && pendingAction.type === 'role' ? pendingAction.value : u.role}
                              disabled={u.id === user?.id}
                              onChange={(e) => setPendingAction({ userId: u.id, userName: u.fullName, type: 'role', value: e.target.value })}
                              style={{ padding: '0.3rem', fontSize: '0.8rem', borderRadius: '3px', border: '1px solid var(--white-border)', fontWeight: 600, cursor: u.id === user?.id ? 'not-allowed' : 'pointer' }}
                            >
                              <option value="CADET">CADET</option>
                              <option value="SENIOR">SENIOR</option>
                              <option value="PLATOON_SENIOR">PLATOON_SENIOR</option>
                              <option value="ADMIN_ANO">ADMIN_ANO</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <select
                              value={pendingAction && pendingAction.userId === u.id && pendingAction.type === 'status' ? pendingAction.value : u.status}
                              onChange={(e) => setPendingAction({ userId: u.id, userName: u.fullName, type: 'status', value: e.target.value })}
                              style={{
                                padding: '0.3rem',
                                fontSize: '0.8rem',
                                borderRadius: '3px',
                                border: pendingAction && pendingAction.userId === u.id && pendingAction.type === 'status' ? '2px solid #D97706' : '1px solid var(--white-border)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: u.status === 'ACTIVE' || u.status === 'APPROVED' ? '#047857'
                                  : u.status === 'REJECTED' || u.status === 'INACTIVE' ? '#DC2626'
                                  : u.status === 'UNDER_REVIEW' ? '#D97706'
                                  : 'inherit',
                              }}
                            >
                              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                              <option value="APPROVED">APPROVED</option>
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="HOLD">HOLD</option>
                              <option value="REJECTED">REJECTED</option>
                              <option value="INACTIVE">INACTIVE</option>
                              <option value="PASSED_OUT">PASSED_OUT</option>
                            </select>
                            {/* Inline confirm for dropdown changes */}
                            {pendingAction && pendingAction.userId === u.id && (
                              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 600 }}>Apply change?</span>
                                <button
                                  onClick={executePendingAction}
                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', backgroundColor: '#047857', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setPendingAction(null)}
                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', backgroundColor: '#6B7280', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                >
                                  No
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                              {/* Quick Approve for pending cadets */}
                              {(u.status === 'UNDER_REVIEW' || u.status === 'REJECTED') && (
                                <button
                                  className="btn-primary btn-sm"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: '#047857',
                                    borderColor: '#047857',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                  onClick={() => handleUpdateStatus(u.id, 'APPROVED')}
                                >
                                  <CheckCircle size={11} /> Approve
                                </button>
                              )}
                              {/* Deactivate / Activate */}
                              {u.id !== user?.id && (
                                u.status !== 'INACTIVE' ? (
                                  <button
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.6rem',
                                      fontSize: '0.75rem',
                                      borderColor: '#DC2626',
                                      color: '#DC2626',
                                    }}
                                    onClick={() => handleUpdateStatus(u.id, 'INACTIVE')}
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    className="btn-primary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.6rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: '#047857',
                                      borderColor: '#047857',
                                    }}
                                    onClick={() => handleUpdateStatus(u.id, 'ACTIVE')}
                                  >
                                    Activate
                                  </button>
                                )
                              )}
                              {/* Enroll Face — Cadets only */}
                              {u.role === 'CADET' && (
                                <button
                                  className="btn-secondary btn-sm"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                  onClick={() => setEnrollCadetTarget(u)}
                                  title="Enroll or Re-enroll Biometric Face"
                                >
                                  <Camera size={11} />
                                  <span>Enroll Face</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}



            {/* 1. ADMIN PANEL: EVENTS MANAGEMENT */}
            {role === 'ADMIN_ANO' && activeTab === 'events' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Unit Events & Ceremonials</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Schedule institutional ceremonial parades, flag-hoisting drills, guest lectures, and social service rallies.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={fetchAdminEvents} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <RefreshCw size={14} /> <span>REFRESH</span>
                    </button>
                    <button onClick={() => setNewEventModal(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Plus size={14} /> <span>PUBLISH EVENT</span>
                    </button>
                  </div>
                </div>

                {adminEvents.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Calendar size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4 style={{ color: 'var(--navy-primary)' }}>No Events Scheduled</h4>
                    <p>Click "Publish Event" to announce an upcoming parade or ceremony.</p>
                  </div>
                ) : (
                  <div className="grid-2">
                    {adminEvents.map((evt) => (
                      <div key={evt.id} className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)' }}>{evt.title}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge-institutional">{evt.isPublic ? 'PUBLIC' : 'INTERNAL'}</span>
                            <button
                              onClick={() => handleDeleteEvent(evt.id, evt.title)}
                              title="Delete Event"
                              style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '0.75rem' }}>
                          {evt.description || 'No description provided.'}
                        </p>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6', background: 'var(--white-surface)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                          <div><strong>Location:</strong> {evt.location}</div>
                          <div><strong>Date & Time:</strong> {new Date(evt.eventDate).toLocaleString()}</div>
                          <div><strong>Status:</strong> <span style={{ color: '#047857', fontWeight: 700 }}>{evt.status}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 1. ADMIN PANEL: NOTICES MANAGEMENT */}
            {role === 'ADMIN_ANO' && activeTab === 'notices' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Institutional Orders & Notices</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Official unit orders, drill instructions, camp circulars, and ANO commands.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={fetchAdminNotices} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <RefreshCw size={14} /> <span>REFRESH</span>
                    </button>
                    <button onClick={() => setNewNoticeModal(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Plus size={14} /> <span>BROADCAST NOTICE</span>
                    </button>
                  </div>
                </div>

                {adminNotices.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Bell size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4 style={{ color: 'var(--navy-primary)' }}>No Notices Broadcasted</h4>
                    <p>Click "Broadcast Notice" to publish an official circular.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {adminNotices.map((notice) => (
                      <div key={notice.id} className="institutional-card" style={{ borderLeft: notice.isUrgent ? '4px solid #DC2626' : '4px solid var(--navy-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)' }}>{notice.title}</h3>
                            {notice.isUrgent && (
                              <span className="badge-institutional" style={{ background: '#FEE2E2', color: '#991B1B', borderColor: '#EF4444' }}>
                                URGENT DIRECTIVE
                              </span>
                            )}
                            <span className="badge-institutional">{notice.category}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                              {new Date(notice.createdAt).toLocaleString()}
                            </span>
                            <button
                              onClick={() => handleDeleteNotice(notice.id, notice.title)}
                              title="Delete Notice"
                              style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--navy-dark)', lineHeight: '1.6', marginBottom: '0.5rem' }}>
                          {notice.content}
                        </p>
                        <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                          Target Audience: <strong>{notice.targetRole || 'All Roles'}</strong> &bull; Platoon: <strong>{notice.targetPlatoon || 'All Platoons'}</strong> &bull; Public Bulletin: <strong>{notice.isPublic ? 'YES' : 'NO'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 1. ADMIN PANEL: AUDIT LOGS */}
            {role === 'ADMIN_ANO' && activeTab === 'audit' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Security & Action Audit Logs</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Tamper-evident system trail for role modifications, approvals, camp creations, and sensitive administrative events.
                    </p>
                  </div>
                  <button onClick={fetchAdminAuditLogs} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} /> <span>REFRESH AUDIT TRAIL</span>
                  </button>
                </div>

                <div style={{ backgroundColor: 'var(--white-pure)', borderRadius: '4px', border: '1px solid var(--white-border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Operator</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Action Code</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Target Entity</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--navy-text-muted)' }}>
                            No audit logs logged in current ledger.
                          </td>
                        </tr>
                      ) : (
                        adminAuditLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--navy-text-muted)' }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{log.actorName}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge-institutional" style={{ fontSize: '0.72rem' }}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>{log.targetType || '-'}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-dark)' }}>{log.details || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ADMIN / ANO: INSTITUTIONAL LEAVE SANCTION COMMAND */}
            {role === 'ADMIN_ANO' && activeTab === 'leave' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                      Institutional Leave Sanction Command (Stage 3: ANO Final Authority)
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Multi-tier leave review desk. Review cadet applications endorsed through Senior Cadets and Platoon Seniors for final commanding sanction.
                    </p>
                  </div>
                  <button
                    onClick={() => fetchLeaveApplications()}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH LEAVES</span>
                  </button>
                </div>

                {/* 4 Stat Overview Cards */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Awaiting ANO Sanction</span>
                      <Clock size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>
                      {leaveApplications.filter((l) => l.status === 'ANO_REVIEW').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Stage 3 pending final action</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>In Prior Tiers</span>
                      <FileText size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                      {leaveApplications.filter((l) => ['SUBMITTED', 'SENIOR_REVIEW', 'PLATOON_SENIOR_REVIEW', 'PENDING'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Under senior/platoon review</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Sanctioned & Approved</span>
                      <CheckCircle size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>
                      {leaveApplications.filter((l) => l.status === 'APPROVED').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Officially granted leaves</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #DC2626' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Rejected / Returned</span>
                      <XCircle size={20} style={{ color: '#DC2626' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626' }}>
                      {leaveApplications.filter((l) => ['REJECTED', 'RETURNED'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Disallowed or revised</div>
                  </div>
                </div>

                {leaveApplications.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <CheckCircle size={36} style={{ color: '#047857', margin: '0 auto 1rem' }} />
                    <h4>No Leave Applications Registered</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>All cadet leaves are current and accounted for.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {leaveApplications.map((leave) => {
                      const isApproved = leave.status === 'APPROVED';
                      const isRejected = leave.status === 'REJECTED';
                      const isReturned = leave.status === 'RETURNED';
                      const isCancelled = leave.status === 'CANCELLED';
                      const isAnoPending = leave.status === 'ANO_REVIEW';
                      const canAct = !isApproved && !isRejected && !isCancelled;
                      const reviews = leave.leaveReviews || [];

                      return (
                        <div
                          key={leave.id}
                          className="institutional-card"
                          style={{
                            borderLeft: `4px solid ${
                              isApproved ? '#047857' :
                              isRejected ? '#DC2626' :
                              isReturned ? '#D97706' :
                              isCancelled ? '#94A3B8' : '#2563EB'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                                  {leave.cadet?.fullName || 'Cadet'} ({leave.cadet?.regimentalNumber || 'Cadet'})
                                </span>
                                <span
                                  className="badge-institutional"
                                  style={{
                                    backgroundColor: isApproved ? '#D1FAE5' : isRejected ? '#FEE2E2' : isReturned ? '#FEF3C7' : '#DBEAFE',
                                    color: isApproved ? '#047857' : isRejected ? '#DC2626' : isReturned ? '#92400E' : '#1E40AF',
                                    fontWeight: 700,
                                  }}
                                >
                                  {leave.status === 'SUBMITTED' ? 'STAGE 1: SENIOR REVIEW' :
                                   leave.status === 'SENIOR_REVIEW' ? 'STAGE 1: SENIOR REVIEW' :
                                   leave.status === 'PLATOON_SENIOR_REVIEW' ? 'STAGE 2: PLATOON SR. REVIEW' :
                                   leave.status === 'ANO_REVIEW' ? 'STAGE 3: AWAITING ANO SANCTION' :
                                   leave.status}
                                </span>
                                <span className="badge-institutional">{leave.leaveType} LEAVE</span>
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                                Platoon: <strong>{leave.cadet?.platoonName || 'Alpha'}</strong> · Branch: <strong>{leave.cadet?.branch || 'General'}</strong> · Roll: <strong>{leave.cadet?.collegeRollNumber || 'N/A'}</strong> · Duration: <strong>{new Date(leave.startDate).toLocaleDateString()}</strong> to <strong>{new Date(leave.endDate).toLocaleDateString()}</strong>
                              </div>
                            </div>

                            {canAct && (
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => setLeaveRemarkModal({ leave, action: 'APPROVE' })}
                                  className="btn-primary btn-sm"
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <CheckCircle size={13} />
                                  <span>Sanction &amp; Final Approve</span>
                                </button>
                                <button
                                  onClick={() => setLeaveRemarkModal({ leave, action: 'RETURN' })}
                                  className="btn-secondary btn-sm"
                                  style={{ borderColor: '#D97706', color: '#D97706' }}
                                >
                                  Return
                                </button>
                                <button
                                  onClick={() => setLeaveRemarkModal({ leave, action: 'REJECT' })}
                                  className="btn-secondary btn-sm"
                                  style={{ borderColor: '#DC2626', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <XCircle size={13} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Multi-tier Stage Progression Bar */}
                          <div style={{ background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Multi-tier Workflow:</span>
                            <span style={{ color: '#047857', fontWeight: 600 }}>1. Cadet Submission ✓</span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: ['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' : '#B45309',
                              fontWeight: 600,
                            }}>
                              2. Senior Endorsement {['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' : leave.status === 'PLATOON_SENIOR_REVIEW' ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: isApproved ? '#047857' : isAnoPending ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              4. ANO Final Sanction {isApproved ? '✓' : ''}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '0.5rem' }}>
                            <strong>Reason:</strong> {leave.reason}
                            {leave.remarks && (
                              <div style={{ marginTop: '0.25rem', color: '#1E293B' }}>
                                <strong>Remarks:</strong> {leave.remarks}
                              </div>
                            )}
                          </div>

                          {reviews.length > 0 && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--white-border)', fontSize: '0.8rem', color: 'var(--navy-text-muted)' }}>
                              <strong>Review Trail:</strong>{' '}
                              {reviews.map((r: any) => `${r.reviewer?.fullName || r.reviewerRole || 'Reviewer'} (${r.action}): "${r.remarks || 'No remarks'}"`).join(' → ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PHASE 11: ANO CERTIFICATE VAULT & ISSUANCE */}
            {role === 'ADMIN_ANO' && activeTab === 'certificates' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Digital Certificate Vault & Issuance Command</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Issue authentic 'A', 'B', 'C' certificates and camp commendations with SHA-256 cryptographic verification hashes.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setNewCertificateModal(true)}
                      className="btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={14} /> <span>ISSUE NEW CERTIFICATE</span>
                    </button>
                    <button
                      onClick={() => { setVerifyModal(true); setVerifyResult(null); }}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--navy-primary)', color: 'var(--navy-primary)' }}
                    >
                      <ShieldCheck size={14} /> <span>VERIFY ANY HASH</span>
                    </button>
                    <button
                      onClick={() => fetchAllCertificates()}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RefreshCw size={14} /> <span>REFRESH</span>
                    </button>
                  </div>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Issued Certificates</span>
                      <Award size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{allCertificates.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Total institutional records</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>'A' / 'B' / 'C' Exams</span>
                      <ShieldCheck size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>
                      {allCertificates.filter((c) => c.certificateType.includes('Certificate')).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Directorate certified</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Camp Commendations</span>
                      <Flag size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                      {allCertificates.filter((c) => c.certificateType.includes('Camp') || c.certificateType.includes('Commendation')).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Field camp certifications</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Cryptographic Hash</span>
                      <CheckCircle size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706', marginTop: '0.35rem' }}>SHA-256</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>100% tamper-evident verified</div>
                  </div>
                </div>

                {/* Certificates Table */}
                <div className="institutional-card" style={{ borderTop: '4px solid var(--navy-primary)' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '1rem' }}>
                    Master Institutional Certificate Register
                  </h3>
                  {allCertificates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--navy-text-muted)' }}>
                      <Award size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                      <p>No certificates issued yet. Click "ISSUE NEW CERTIFICATE" to award credentials to eligible cadets.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Certificate Serial No.</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Cadet Name & Regimental</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Type & Title</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Grade</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Issue Date</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Verification Digest</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allCertificates.map((cert) => (
                            <tr key={cert.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--navy-primary)', whiteSpace: 'nowrap' }}>
                                {cert.certificateNo}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--navy-primary)' }}>{cert.cadet?.fullName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>{cert.cadet?.regimentalNumber} · {cert.cadet?.platoonName}</div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 600 }}>{cert.title}</div>
                                <span className="badge-institutional" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>{cert.certificateType}</span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  className="badge-institutional"
                                  style={{
                                    backgroundColor: cert.grade === 'A' ? '#D1FAE5' : '#FEF3C7',
                                    color: cert.grade === 'A' ? '#047857' : '#D97706',
                                    fontWeight: 700,
                                  }}
                                >
                                  GRADE {cert.grade}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--navy-text-muted)' }}>
                                {new Date(cert.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <code style={{ fontSize: '0.72rem', backgroundColor: 'var(--white-surface)', padding: '0.2rem 0.4rem', borderRadius: '3px', border: '1px solid var(--white-border)' }}>
                                  {cert.verificationHash?.substring(0, 12)}...
                                </code>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => setSelectedCertificate(cert)}
                                    className="btn-primary btn-sm"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                  >
                                    VIEW
                                  </button>
                                  {cert.status === 'VALID' && (
                                    <button
                                      onClick={() => handleRevokeCertificate(cert.id)}
                                      className="btn-secondary btn-sm"
                                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: '#DC2626', color: '#DC2626' }}
                                    >
                                      REVOKE
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. SENIOR PANEL: Assigned Cadets */}
            {/* ===== PHASE 7 — SENIOR CADET MANAGEMENT PANEL ===== */}
            {role === 'SENIOR' && activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Senior Cadet Section Overview</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>Mentorship scope · Squad cadet supervision · Leave sanction authority</p>
                  </div>
                  <button onClick={() => { fetchSeniorCadets(); fetchPendingReviews(); fetchLeaveApplications(); }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} /><span>REFRESH</span>
                  </button>
                </div>
                <div className="grid-3" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Assigned Cadets</span>
                      <Users size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{assignedCadets.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Under your mentorship</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Pending Reviews</span>
                      <AlertTriangle size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>{pendingReviews.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Applications awaiting action</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Leave Requests</span>
                      <FileText size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                      {leaveApplications.filter(l => ['SUBMITTED', 'SENIOR_REVIEW', 'PENDING'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Pending senior endorsement</div>
                  </div>
                </div>
                <div className="institutional-card" style={{ backgroundColor: 'var(--navy-badge-bg)', border: '1px solid var(--navy-badge-border)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Shield size={20} style={{ color: 'var(--navy-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>SENIOR CADET AUTHORITY NOTICE</div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.6' }}>
                        Your authority is limited to cadets strictly assigned to your squad. You may Forward or Hold cadet applications — only the ANO issues final approvals.
                        Leave sanctions beyond FORWARD require ANO clearance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {role === 'SENIOR' && activeTab === 'assigned' && (
              <div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>My Assigned Squad Cadets</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginBottom: '1.5rem' }}>
                  Authorized mentorship scope: Access restricted strictly to cadets assigned to your squad.
                </p>
                {assignedCadets.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4>No cadets are currently assigned to your squad.</h4>
                    <p>Admin will assign cadets under your mentorship.</p>
                  </div>
                ) : (
                  <div className="grid-2">
                    {assignedCadets.map((c) => (
                      <div key={c.id} className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--navy-primary)' }}>{c.fullName}</h4>
                          <span className="badge-institutional">{c.status}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                          <div><strong>Regimental:</strong> {c.regimentalNumber}</div>
                          <div><strong>Roll:</strong> {c.collegeRollNumber}</div>
                          <div><strong>Branch:</strong> {c.branch} ({c.year})</div>
                          <div><strong>Platoon:</strong> {c.platoonName}</div>
                          {c.email && <div><strong>Email:</strong> {c.email}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {role === 'SENIOR' && activeTab === 'leave' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                      Leave Sanction Panel (Stage 1: Senior Review)
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Review leave applications from cadets under your mentorship. Endorse and forward valid requests to Platoon Senior.
                    </p>
                  </div>
                  <button
                    onClick={() => { fetchSeniorCadets(); fetchLeaveApplications(); }}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH LEAVES</span>
                  </button>
                </div>

                {leaveApplications.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <CheckCircle size={36} style={{ color: '#047857', margin: '0 auto 1rem' }} />
                    <h4>No leave applications pending</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>All cadet leaves are currently processed.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {leaveApplications.map((leave) => {
                      const isPendingSenior = ['SUBMITTED', 'SENIOR_REVIEW', 'PENDING'].includes(leave.status);
                      const isApproved = leave.status === 'APPROVED';
                      const isRejected = leave.status === 'REJECTED';
                      const isReturned = leave.status === 'RETURNED';
                      const isForwarded = ['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status);
                      const reviews = leave.leaveReviews || [];

                      return (
                        <div
                          key={leave.id}
                          className="institutional-card"
                          style={{
                            borderLeft: `4px solid ${
                              isApproved ? '#047857' :
                              isRejected ? '#DC2626' :
                              isReturned ? '#D97706' : '#2563EB'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                                {leave.cadet?.fullName || 'Cadet'} — {leave.leaveType} Leave
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)' }}>
                                Reg: {leave.cadet?.regimentalNumber} · {leave.cadet?.platoonName || 'Alpha'} Platoon · {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                              </div>
                            </div>
                            <span
                              className="badge-institutional"
                              style={{
                                backgroundColor: isApproved ? '#D1FAE5' : isRejected ? '#FEE2E2' : isReturned ? '#FEF3C7' : '#DBEAFE',
                                color: isApproved ? '#047857' : isRejected ? '#DC2626' : isReturned ? '#92400E' : '#1E40AF',
                                fontWeight: 700,
                              }}
                            >
                              {leave.status === 'SUBMITTED' ? 'STAGE 1: SENIOR REVIEW' :
                               leave.status === 'SENIOR_REVIEW' ? 'STAGE 1: SENIOR REVIEW' :
                               leave.status === 'PLATOON_SENIOR_REVIEW' ? 'STAGE 2: PLATOON SR. REVIEW' :
                               leave.status === 'ANO_REVIEW' ? 'STAGE 3: AWAITING ANO SANCTION' :
                               leave.status}
                            </span>
                          </div>

                          {/* Multi-tier Stage Progression Bar */}
                          <div style={{ background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Workflow Stage:</span>
                            <span style={{ color: '#047857', fontWeight: 600 }}>1. Cadet Applied ✓</span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: isForwarded ? '#047857' : isPendingSenior ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              2. Senior Endorsement {isForwarded ? '✓' : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' : leave.status === 'PLATOON_SENIOR_REVIEW' ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: isApproved ? '#047857' : leave.status === 'ANO_REVIEW' ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              4. ANO Sanction {isApproved ? '✓' : ''}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '0.75rem' }}>
                            <strong>Reason:</strong> {leave.reason}
                            {leave.remarks && <><br /><strong>Remarks:</strong> {leave.remarks}</>}
                          </div>

                          {reviews.length > 0 && (
                            <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--white-border)', fontSize: '0.8rem', color: 'var(--navy-text-muted)' }}>
                              <strong>Review Trail:</strong>{' '}
                              {reviews.map((r: any) => `${r.reviewer?.fullName || r.reviewerRole || 'Reviewer'} (${r.action}): "${r.remarks || 'No remarks'}"`).join(' → ')}
                            </div>
                          )}

                          {isPendingSenior && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'FORWARD' })}
                                className="btn-primary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <CheckCircle size={13} />
                                <span>Endorse &amp; Forward to Platoon Senior</span>
                              </button>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'RETURN' })}
                                className="btn-secondary btn-sm"
                                style={{ borderColor: '#D97706', color: '#D97706' }}
                              >
                                Return
                              </button>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'REJECT' })}
                                className="btn-secondary btn-sm"
                                style={{ borderColor: '#DC2626', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <XCircle size={13} />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {role === 'SENIOR' && activeTab === 'attendance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Squad Attendance &amp; Biometrics</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Conduct morning muster, schedule physical parades, verify facial biometrics, and track certification eligibility.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setNewAttendanceSessionModal(true)}
                      className="btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={14} /> <span>START ATTENDANCE</span>
                    </button>
                    {selectedAttendanceSession && (
                      <button
                        onClick={() => setBiometricCameraActive(true)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--navy-primary)', color: 'var(--navy-primary)' }}
                      >
                        <Camera size={14} /> <span>{selectedAttendanceSession.status === 'CLOSED' ? 'VIEW ABSENT LIST & SUMMARY' : 'LIVE FACE SCANNER (CAMERA)'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setAttendanceImportModal(true)}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Download size={14} /> <span>IMPORT GOOGLE SHEETS / CSV</span>
                    </button>
                    <button
                      onClick={() => { fetchAttendanceSessions(); fetchAttendanceSummary(); }}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RefreshCw size={14} /> <span>REFRESH</span>
                    </button>
                  </div>
                </div>

                {/* 4 Attendance Stat Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Muster Sessions</span>
                      <Calendar size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{attendanceSessions.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Conducted this term</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Average Turnout</span>
                      <CheckCircle size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>
                      {attendanceSummaryList.length > 0
                        ? Math.round(attendanceSummaryList.reduce((acc, c) => acc + (c.stats?.percentage || 0), 0) / attendanceSummaryList.length)
                        : 0}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Squad parade turnout rate</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Exam Eligible</span>
                      <Shield size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                      {attendanceSummaryList.length > 0
                        ? `${attendanceSummaryList.filter((c) => (c.stats?.percentage || 0) >= 75).length} / ${attendanceSummaryList.length}`
                        : '0 / 0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Met &ge; 75% parade criterion</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #DC2626' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Low Attendance Warning</span>
                      <AlertTriangle size={20} style={{ color: '#DC2626' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626' }}>
                      {attendanceSummaryList.filter((c) => (c.stats?.percentage || 0) < 75 && c.stats?.total > 0).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Cadets under mandatory threshold</div>
                  </div>
                </div>

                {/* Session Selector Strip */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                      SCHEDULED MUSTER / PARADE SESSIONS:
                    </label>
                  </div>
                  {attendanceSessions.length === 0 ? (
                    <div className="institutional-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <Calendar size={28} style={{ color: 'var(--navy-border)', margin: '0 auto 0.5rem' }} />
                      <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>No attendance sessions conducted yet. Schedule one above.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                      {attendanceSessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => fetchSessionDetails(session.id)}
                          className="institutional-card"
                          style={{
                            minWidth: '250px',
                            cursor: 'pointer',
                            border: selectedAttendanceSession?.id === session.id ? '2px solid var(--navy-primary)' : '1px solid var(--white-border)',
                            backgroundColor: selectedAttendanceSession?.id === session.id ? 'var(--navy-badge-bg)' : 'var(--white-pure)',
                            padding: '0.85rem 1rem',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                            {new Date(session.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {session.timing}
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-primary)', margin: '0.25rem 0' }}>
                            {session.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)' }}>
                            Present: <strong style={{ color: '#047857' }}>{session.presentCount || 0}</strong> · Absent: <strong style={{ color: '#DC2626' }}>{session.absentCount || 0}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Session Roster Marking Table */}
                {selectedAttendanceSession && (
                  <div className="institutional-card" style={{ borderTop: '4px solid var(--navy-primary)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                          {selectedAttendanceSession.title}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', marginTop: '0.2rem' }}>
                          Location: <strong>{selectedAttendanceSession.location}</strong> · Activity: <strong>{selectedAttendanceSession.activity}</strong> · Target: <strong>{selectedAttendanceSession.targetPlatoon || 'All Platoons'}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => setBiometricCameraActive(true)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--navy-primary)', color: 'var(--navy-primary)' }}
                      >
                        <Camera size={14} /> <span>OPEN FACIAL SCANNER</span>
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Cadet Name</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Regimental No.</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Roll No.</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Current Status</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Mark Attendance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAttendanceSession.attendance?.map((record: any) => (
                            <tr key={record.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--navy-primary)' }}>
                                {record.cadet?.fullName}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {record.cadet?.regimentalNumber}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {record.cadet?.collegeRollNumber || 'N/A'}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  className="badge-institutional"
                                  style={{
                                    backgroundColor: record.status === 'PRESENT' ? '#D1FAE5' : record.status === 'ABSENT' ? '#FEE2E2' : '#FEF3C7',
                                    color: record.status === 'PRESENT' ? '#047857' : record.status === 'ABSENT' ? '#DC2626' : '#D97706',
                                  }}
                                >
                                  {record.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => handleMarkCadetAttendance(selectedAttendanceSession.id, record.cadetId, 'PRESENT')}
                                    className="btn-primary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: record.status === 'PRESENT' ? 'var(--navy-primary)' : 'var(--white-pure)',
                                      color: record.status === 'PRESENT' ? 'var(--white-pure)' : 'var(--navy-primary)',
                                      border: '1px solid var(--navy-primary)',
                                    }}
                                  >
                                    <Check size={11} style={{ display: 'inline', marginRight: '2px' }} /> Present
                                  </button>
                                  <button
                                    onClick={() => handleMarkCadetAttendance(selectedAttendanceSession.id, record.cadetId, 'ABSENT')}
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: record.status === 'ABSENT' ? '#DC2626' : 'var(--white-pure)',
                                      color: record.status === 'ABSENT' ? 'var(--white-pure)' : '#DC2626',
                                      borderColor: '#DC2626',
                                    }}
                                  >
                                    <X size={11} style={{ display: 'inline', marginRight: '2px' }} /> Absent
                                  </button>
                                  <button
                                    onClick={() => handleMarkCadetAttendance(selectedAttendanceSession.id, record.cadetId, 'EXCUSED')}
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: record.status === 'EXCUSED' ? '#D97706' : 'var(--white-pure)',
                                      color: record.status === 'EXCUSED' ? 'var(--white-pure)' : '#D97706',
                                      borderColor: '#D97706',
                                    }}
                                  >
                                    Excused
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Squad Cumulative Attendance Summary Table */}
                <div className="institutional-card" style={{ borderTop: '4px solid var(--navy-primary)' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>
                    Squad Cumulative Attendance &amp; Certification Eligibility
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '1rem' }}>
                    NCC Directorate protocol: Cadets must maintain a minimum <strong>75% parade attendance</strong> to qualify for NCC 'B' &amp; 'C' Certificate examinations.
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--white-surface)', borderBottom: '2px solid var(--navy-primary)', textAlign: 'left', color: 'var(--navy-primary)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Cadet Name</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Regimental No.</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Branch / Year</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Total Parades</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Attended</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Attendance %</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Certificate Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSummaryList.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--navy-text-muted)' }}>
                              No attendance records are available yet.
                            </td>
                          </tr>
                        ) : (
                          attendanceSummaryList.map((cadet) => (
                            <tr key={cadet.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--navy-primary)' }}>
                                {cadet.fullName}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {cadet.regimentalNumber}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {cadet.branch} ({cadet.year})
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>{cadet.stats?.total || 0}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#047857' }}>
                                {cadet.stats?.present || 0}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--white-surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--white-border)' }}>
                                    <div
                                      style={{
                                        width: `${cadet.stats?.percentage || 0}%`,
                                        height: '100%',
                                        backgroundColor: (cadet.stats?.percentage || 0) >= 75 ? '#047857' : (cadet.stats?.percentage || 0) >= 60 ? '#D97706' : '#DC2626',
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: '0.8rem', minWidth: '35px' }}>
                                    {cadet.stats?.percentage || 0}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {(cadet.stats?.percentage || 0) >= 75 ? (
                                  <span className="badge-institutional" style={{ backgroundColor: '#D1FAE5', color: '#047857' }}>
                                    ELIGIBLE
                                  </span>
                                ) : (
                                  <span className="badge-institutional" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                                    BELOW CRITERIA
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== PHASE 8 — PLATOON SENIOR COMMAND PANEL ===== */}
            {role === 'PLATOON_SENIOR' && activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Cadet Leadership Command Center</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>Cadet leadership command · Review authority · Leave management</p>
                  </div>
                  <button onClick={() => { fetchPlatoonCadets(); fetchPendingReviews(); fetchLeaveApplications(); }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} /><span>REFRESH</span>
                  </button>
                </div>
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Unit Cadet Strength</span>
                      <Users size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{platoonCadets.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Active enrolled cadets</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Applications</span>
                      <AlertTriangle size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>{pendingReviews.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Awaiting platoon review</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Leave Pending</span>
                      <FileText size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                      {leaveApplications.filter(l => ['PLATOON_SENIOR_REVIEW', 'SUBMITTED', 'SENIOR_REVIEW', 'PENDING'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Platoon leave requests</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Auth Level</span>
                      <Shield size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>TIER 2</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Platoon command authority</div>
                  </div>
                </div>
                <div className="institutional-card" style={{ backgroundColor: 'var(--navy-badge-bg)', border: '1px solid var(--navy-badge-border)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Shield size={20} style={{ color: 'var(--navy-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>PLATOON SENIOR COMMAND AUTHORITY</div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.6' }}>
                        As Platoon Senior, you exercise Tier-2 review authority over cadet applications in your platoon.
                        You may Forward applications to ANO for final sanction, or Hold/Reject as required.
                        Camera attendance is activated for your command level.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {role === 'PLATOON_SENIOR' && activeTab === 'cadets' && (
              <div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>
                  Unit Cadet Roster
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginBottom: '1.5rem' }}>
                  Authorized command scope: Full visibility of all enrolled active cadets in the unit.
                </p>
                {platoonCadets.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4>No cadets found in unit roster</h4>
                  </div>
                ) : (
                  <div className="grid-2">
                    {platoonCadets.map((c) => (
                      <div key={c.id} className="institutional-card" style={{ borderLeft: '4px solid var(--navy-hover)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--navy-primary)' }}>{c.fullName}</h4>
                          <span className="badge-institutional">{c.status}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                          <div><strong>Regimental:</strong> {c.regimentalNumber}</div>
                          <div><strong>Roll:</strong> {c.collegeRollNumber}</div>
                          <div><strong>Branch:</strong> {c.branch} ({c.year})</div>
                          {c.email && <div><strong>Email:</strong> {c.email}</div>}
                          {c.phone && <div><strong>Phone:</strong> {c.phone}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {role === 'PLATOON_SENIOR' && activeTab === 'leave' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                      Platoon Leave Management (Stage 2: Platoon Senior Review)
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Review leave applications from cadets in your platoon. Endorse and recommend forwarded requests to ANO / Admin for final sanction.
                    </p>
                  </div>
                  <button
                    onClick={() => { fetchPlatoonCadets(); fetchLeaveApplications(); }}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH LEAVES</span>
                  </button>
                </div>

                {leaveApplications.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <CheckCircle size={36} style={{ color: '#047857', margin: '0 auto 1rem' }} />
                    <h4>No leave applications from your platoon</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>No platoon leave applications are awaiting review.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {leaveApplications.map((leave) => {
                      const isApproved = leave.status === 'APPROVED';
                      const isRejected = leave.status === 'REJECTED';
                      const isReturned = leave.status === 'RETURNED';
                      const isAnoPending = leave.status === 'ANO_REVIEW';
                      const canAct = !isApproved && !isRejected && !isAnoPending;
                      const reviews = leave.leaveReviews || [];

                      return (
                        <div
                          key={leave.id}
                          className="institutional-card"
                          style={{
                            borderLeft: `4px solid ${
                              isApproved ? '#047857' :
                              isRejected ? '#DC2626' :
                              isReturned ? '#D97706' : '#2563EB'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                                {leave.cadet?.fullName || 'Cadet'} — {leave.leaveType} Leave
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)' }}>
                                Reg: {leave.cadet?.regimentalNumber} · {leave.cadet?.platoonName || 'Alpha'} Platoon · {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                              </div>
                            </div>
                            <span
                              className="badge-institutional"
                              style={{
                                backgroundColor: isApproved ? '#D1FAE5' : isRejected ? '#FEE2E2' : isReturned ? '#FEF3C7' : '#DBEAFE',
                                color: isApproved ? '#047857' : isRejected ? '#DC2626' : isReturned ? '#92400E' : '#1E40AF',
                                fontWeight: 700,
                              }}
                            >
                              {leave.status === 'SUBMITTED' ? 'STAGE 1: SENIOR REVIEW' :
                               leave.status === 'SENIOR_REVIEW' ? 'STAGE 1: SENIOR REVIEW' :
                               leave.status === 'PLATOON_SENIOR_REVIEW' ? 'STAGE 2: PLATOON SR. REVIEW' :
                               leave.status === 'ANO_REVIEW' ? 'STAGE 3: AWAITING ANO SANCTION' :
                               leave.status}
                            </span>
                          </div>

                          {/* Multi-tier Stage Progression Bar */}
                          <div style={{ background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Workflow Stage:</span>
                            <span style={{ color: '#047857', fontWeight: 600 }}>1. Cadet Applied ✓</span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: ['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' : '#B45309',
                              fontWeight: 600,
                            }}>
                              2. Senior Endorsement {['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '#047857' : leave.status === 'PLATOON_SENIOR_REVIEW' ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>➔</span>
                            <span style={{
                              color: isApproved ? '#047857' : isAnoPending ? '#B45309' : '#94A3B8',
                              fontWeight: 600,
                            }}>
                              4. ANO Sanction {isApproved ? '✓' : ''}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '0.75rem' }}>
                            <strong>Reason:</strong> {leave.reason}
                            {leave.remarks && <><br /><strong>Remarks:</strong> {leave.remarks}</>}
                          </div>

                          {reviews.length > 0 && (
                            <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--white-border)', fontSize: '0.8rem', color: 'var(--navy-text-muted)' }}>
                              <strong>Review Trail:</strong>{' '}
                              {reviews.map((r: any) => `${r.reviewer?.fullName || r.reviewerRole || 'Reviewer'} (${r.action}): "${r.remarks || 'No remarks'}"`).join(' → ')}
                            </div>
                          )}

                          {canAct && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'FORWARD' })}
                                className="btn-primary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <CheckCircle size={13} />
                                <span>Recommend &amp; Forward to ANO</span>
                              </button>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'RETURN' })}
                                className="btn-secondary btn-sm"
                                style={{ borderColor: '#D97706', color: '#D97706' }}
                              >
                                Return
                              </button>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'REJECT' })}
                                className="btn-secondary btn-sm"
                                style={{ borderColor: '#DC2626', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <XCircle size={13} />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}


            {role === 'PLATOON_SENIOR' && activeTab === 'attendance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Platoon Attendance & Biometrics</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Conduct morning muster, schedule physical parades, verify facial biometrics, and track certification eligibility.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setNewAttendanceSessionModal(true)}
                      className="btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={14} /> <span>START ATTENDANCE</span>
                    </button>
                    {selectedAttendanceSession && (
                      <button
                        onClick={() => setBiometricCameraActive(true)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--navy-primary)', color: 'var(--navy-primary)' }}
                      >
                        <Camera size={14} /> <span>{selectedAttendanceSession.status === 'CLOSED' ? 'VIEW ABSENT LIST & SUMMARY' : 'LIVE FACE SCANNER (CAMERA)'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setAttendanceImportModal(true)}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Download size={14} /> <span>IMPORT GOOGLE SHEETS / CSV</span>
                    </button>
                    <button
                      onClick={() => { fetchAttendanceSessions(); fetchAttendanceSummary(); }}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RefreshCw size={14} /> <span>REFRESH</span>
                    </button>
                  </div>
                </div>

                {/* 4 Attendance Stat Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Muster Sessions</span>
                      <Calendar size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{attendanceSessions.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Conducted this term</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Average Turnout</span>
                      <CheckCircle size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>
                      {attendanceSummaryList.length > 0
                        ? Math.round(attendanceSummaryList.reduce((acc, c) => acc + (c.stats?.percentage || 0), 0) / attendanceSummaryList.length)
                        : 0}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Platoon parade turnout rate</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Exam Eligible</span>
                      <Shield size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>
                      {attendanceSummaryList.length > 0
                        ? `${attendanceSummaryList.filter((c) => (c.stats?.percentage || 0) >= 75).length} / ${attendanceSummaryList.length}`
                        : '0 / 0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Met &ge; 75% parade criterion</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #DC2626' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Low Attendance Warning</span>
                      <AlertTriangle size={20} style={{ color: '#DC2626' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#DC2626' }}>
                      {attendanceSummaryList.filter((c) => (c.stats?.percentage || 0) < 75 && c.stats?.total > 0).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Cadets under mandatory threshold</div>
                  </div>
                </div>

                {/* Session Selector Strip */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                      SCHEDULED MUSTER / PARADE SESSIONS:
                    </label>
                  </div>
                  {attendanceSessions.length === 0 ? (
                    <div className="institutional-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <Calendar size={28} style={{ color: 'var(--navy-border)', margin: '0 auto 0.5rem' }} />
                      <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>No attendance sessions conducted yet. Schedule one above.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                      {attendanceSessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => fetchSessionDetails(session.id)}
                          className="institutional-card"
                          style={{
                            minWidth: '250px',
                            cursor: 'pointer',
                            border: selectedAttendanceSession?.id === session.id ? '2px solid var(--navy-primary)' : '1px solid var(--white-border)',
                            backgroundColor: selectedAttendanceSession?.id === session.id ? 'var(--navy-badge-bg)' : 'var(--white-pure)',
                            padding: '0.85rem 1rem',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                            {new Date(session.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {session.timing}
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-primary)', margin: '0.25rem 0' }}>
                            {session.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)' }}>
                            Present: <strong style={{ color: '#047857' }}>{session.presentCount || 0}</strong> · Absent: <strong style={{ color: '#DC2626' }}>{session.absentCount || 0}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Session Roster Marking Table */}
                {selectedAttendanceSession && (
                  <div className="institutional-card" style={{ borderTop: '4px solid var(--navy-primary)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                          {selectedAttendanceSession.title}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', marginTop: '0.2rem' }}>
                          Location: <strong>{selectedAttendanceSession.location}</strong> · Activity: <strong>{selectedAttendanceSession.activity}</strong> · Target: <strong>{selectedAttendanceSession.targetPlatoon || 'All Platoons'}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => setBiometricCameraActive(true)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--navy-primary)', color: 'var(--navy-primary)' }}
                      >
                        <Camera size={14} /> <span>OPEN FACIAL SCANNER</span>
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Cadet Name</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Regimental No.</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Roll No.</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Current Status</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Mark Attendance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAttendanceSession.attendance?.map((record: any) => (
                            <tr key={record.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--navy-primary)' }}>
                                {record.cadet?.fullName}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {record.cadet?.regimentalNumber}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {record.cadet?.collegeRollNumber || 'N/A'}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  className="badge-institutional"
                                  style={{
                                    backgroundColor: record.status === 'PRESENT' ? '#D1FAE5' : record.status === 'ABSENT' ? '#FEE2E2' : '#FEF3C7',
                                    color: record.status === 'PRESENT' ? '#047857' : record.status === 'ABSENT' ? '#DC2626' : '#D97706',
                                  }}
                                >
                                  {record.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => handleMarkCadetAttendance(selectedAttendanceSession.id, record.cadetId, 'PRESENT')}
                                    className="btn-primary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: record.status === 'PRESENT' ? 'var(--navy-primary)' : 'var(--white-pure)',
                                      color: record.status === 'PRESENT' ? 'var(--white-pure)' : 'var(--navy-primary)',
                                      border: '1px solid var(--navy-primary)',
                                    }}
                                  >
                                    <Check size={11} style={{ display: 'inline', marginRight: '2px' }} /> Present
                                  </button>
                                  <button
                                    onClick={() => handleMarkCadetAttendance(selectedAttendanceSession.id, record.cadetId, 'ABSENT')}
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: record.status === 'ABSENT' ? '#DC2626' : 'var(--white-pure)',
                                      color: record.status === 'ABSENT' ? 'var(--white-pure)' : '#DC2626',
                                      borderColor: '#DC2626',
                                    }}
                                  >
                                    <X size={11} style={{ display: 'inline', marginRight: '2px' }} /> Absent
                                  </button>
                                  <button
                                    onClick={() => handleMarkCadetAttendance(selectedAttendanceSession.id, record.cadetId, 'EXCUSED')}
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: record.status === 'EXCUSED' ? '#D97706' : 'var(--white-pure)',
                                      color: record.status === 'EXCUSED' ? 'var(--white-pure)' : '#D97706',
                                      borderColor: '#D97706',
                                    }}
                                  >
                                    Excused
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Platoon Cumulative Attendance Summary Table */}
                <div className="institutional-card" style={{ borderTop: '4px solid var(--navy-primary)' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>
                    Platoon Cumulative Attendance & Certification Eligibility
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '1rem' }}>
                    NCC Directorate protocol: Cadets must maintain a minimum <strong>75% parade attendance</strong> to qualify for NCC 'B' & 'C' Certificate examinations.
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--white-surface)', borderBottom: '2px solid var(--navy-primary)', textAlign: 'left', color: 'var(--navy-primary)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Cadet Name</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Regimental No.</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Branch / Year</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Total Parades</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Attended</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Attendance %</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Certificate Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceSummaryList.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--navy-text-muted)' }}>
                              No attendance records are available yet.
                            </td>
                          </tr>
                        ) : (
                          attendanceSummaryList.map((cadet) => (
                            <tr key={cadet.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--navy-primary)' }}>
                                {cadet.fullName}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {cadet.regimentalNumber}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {cadet.branch} ({cadet.year})
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>{cadet.stats?.total || 0}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#047857' }}>
                                {cadet.stats?.present || 0}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--white-surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--white-border)' }}>
                                    <div
                                      style={{
                                        width: `${cadet.stats?.percentage || 0}%`,
                                        height: '100%',
                                        backgroundColor: (cadet.stats?.percentage || 0) >= 75 ? '#047857' : (cadet.stats?.percentage || 0) >= 60 ? '#D97706' : '#DC2626',
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: '0.8rem', minWidth: '35px' }}>
                                    {cadet.stats?.percentage || 0}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {(cadet.stats?.percentage || 0) >= 75 ? (
                                  <span className="badge-institutional" style={{ backgroundColor: '#D1FAE5', color: '#047857' }}>
                                    ELIGIBLE
                                  </span>
                                ) : (
                                  <span className="badge-institutional" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                                    BELOW CRITERIA
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}


            {/* 5. CADET PANEL */}
            {/* ===== PHASE 9 — CADET PERSONAL OPERATIONS PORTAL ===== */}
            {role === 'CADET' && activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>
                      Welcome, {user?.fullName?.split(' ')[0] || 'Cadet'}
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Your NCC digital command portal — Leave, Notices, Profile & Records
                    </p>
                  </div>
                  <button onClick={() => { fetchMyLeaves(); fetchCadetNotices(); }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} /><span>REFRESH</span>
                  </button>
                </div>
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>My Leaves</span>
                      <FileText size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{myLeaves.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Total applications</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Approved</span>
                      <CheckCircle size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>{myLeaves.filter(l => l.status === 'APPROVED').length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Sanctioned leaves</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Pending</span>
                      <Clock size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>{myLeaves.filter(l => l.status === 'PENDING').length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Awaiting sanction</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Unit Notices</span>
                      <Bell size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>{cadetNotices.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Active orders & notices</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="institutional-card" style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--navy-primary)', marginBottom: '1rem', fontWeight: 700 }}>QUICK ACTIONS</h4>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={() => { setActiveTab('leave'); setLeaveModal(true); }} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Plus size={14} /><span>APPLY FOR LEAVE</span>
                    </button>
                    <button onClick={() => setActiveTab('profile')} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <User size={14} /><span>VIEW PROFILE</span>
                    </button>
                    <button onClick={() => setActiveTab('notices')} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Bell size={14} /><span>UNIT NOTICES</span>
                    </button>
                  </div>
                </div>

                {/* Account Status Card */}
                <div className="institutional-card" style={{ backgroundColor: user?.status === 'APPROVED' || user?.status === 'ACTIVE' ? '#F0FDF4' : 'var(--navy-badge-bg)', border: `1px solid ${user?.status === 'APPROVED' || user?.status === 'ACTIVE' ? '#86EFAC' : 'var(--navy-badge-border)'}` }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Shield size={20} style={{ color: user?.status === 'APPROVED' || user?.status === 'ACTIVE' ? '#047857' : 'var(--navy-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>ACCOUNT STATUS: {user?.status}</div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.6' }}>
                        {user?.status === 'APPROVED' || user?.status === 'ACTIVE'
                          ? 'Your NCC cadet account is fully active. You are cleared for all digital operations including leave applications and unit notice access.'
                          : 'Your account is pending final clearance. Contact your Senior Cadet or Platoon Senior for status update.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {role === 'CADET' && activeTab === 'profile' && (
              <CadetProfileView />
            )}

            {role === 'CADET' && activeTab === 'leave' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Official Leave Applications</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Multi-tier progression: Submission &rarr; Senior Review &rarr; Platoon Senior Review &rarr; ANO Final Sanction.
                    </p>
                  </div>
                  <button onClick={() => setLeaveModal(true)} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Plus size={14} /><span>APPLY FOR LEAVE</span>
                  </button>
                </div>

                {myLeaves.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <FileText size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4>No leave applications filed</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                      Click "Apply for Leave" to initiate an official application through the command chain.
                    </p>
                    <button onClick={() => setLeaveModal(true)} className="btn-primary btn-sm">APPLY FOR LEAVE</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {myLeaves.map((leave) => {
                      const canCancel = ['SUBMITTED', 'SENIOR_REVIEW', 'PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'HOLD'].includes(leave.status);
                      const isApproved = leave.status === 'APPROVED';
                      const isRejected = leave.status === 'REJECTED';
                      const isCancelled = leave.status === 'CANCELLED';

                      return (
                        <div
                          key={leave.id}
                          className="institutional-card"
                          style={{
                            borderLeft: `4px solid ${
                              isApproved ? '#047857' : isRejected ? '#DC2626' : isCancelled ? '#64748B' : '#D97706'
                            }`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                                {leave.leaveType} Leave
                              </div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', marginTop: '0.2rem' }}>
                                {new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {' '}&ndash;{' '}
                                {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span
                                className="badge-institutional"
                                style={{
                                  backgroundColor: isApproved ? '#D1FAE5' : isRejected ? '#FEE2E2' : isCancelled ? '#F1F5F9' : '#FEF3C7',
                                  color: isApproved ? '#047857' : isRejected ? '#DC2626' : isCancelled ? '#475569' : '#92400E',
                                  borderColor: isApproved ? '#047857' : isRejected ? '#DC2626' : isCancelled ? '#CBD5E1' : '#F59E0B',
                                }}
                              >
                                {leave.status === 'SUBMITTED' ? 'UNDER SENIOR REVIEW' :
                                 leave.status === 'SENIOR_REVIEW' ? 'SENIOR ENDORSED (TIER 1)' :
                                 leave.status === 'PLATOON_SENIOR_REVIEW' ? 'PLATOON SR. ENDORSED (TIER 2)' :
                                 leave.status === 'ANO_REVIEW' ? 'PENDING ANO SANCTION' :
                                 leave.status}
                              </span>

                              {canCancel && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/leave/${leave.id}/cancel`, {
                                        method: 'POST',
                                        headers: {
                                          Authorization: `Bearer ${localStorage.getItem('token')}`,
                                          'Content-Type': 'application/json',
                                        },
                                      });
                                      if (res.ok) {
                                        alert('Leave application withdrawn.');
                                        fetchMyLeaves();
                                      } else {
                                        const d = await res.json();
                                        alert(d.message || d.error || 'Failed to withdraw application');
                                      }
                                    } catch (err) {
                                      console.error('Cancel leave error:', err);
                                    }
                                  }}
                                  className="btn-secondary btn-sm"
                                  style={{ color: '#DC2626', borderColor: '#FCA5A5', fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                >
                                  Withdraw
                                </button>
                              )}
                            </div>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                            <strong>Official Grounds:</strong> {leave.reason}
                            {leave.remarks && (
                              <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', backgroundColor: 'var(--white-surface)', borderRadius: '4px', borderLeft: '2px solid var(--navy-primary)' }}>
                                <strong>Officer Review Remarks:</strong> {leave.remarks}
                              </div>
                            )}
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.5rem' }}>
                            Application Logged: {new Date(leave.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {role === 'CADET' && activeTab === 'notices' && (
              <div>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>Unit Notices & Orders</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', marginBottom: '1.5rem' }}>
                  Official notices, orders, and announcements from your unit command.
                </p>
                {cadetNotices.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Bell size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4>No active unit notices</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.9rem' }}>Check back later for unit orders and announcements.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {cadetNotices.map((notice: any) => (
                      <div key={notice.id} className="institutional-card" style={{ borderLeft: `4px solid ${notice.isUrgent ? '#DC2626' : 'var(--navy-primary)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                            {notice.isUrgent && <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', color: '#DC2626' }} />}
                            {notice.title}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {notice.isUrgent && <span className="badge-institutional" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>URGENT</span>}
                            <span className="badge-institutional">{notice.category}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', lineHeight: '1.6', marginBottom: '0.5rem' }}>{notice.content}</p>
                        <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                          Issued: {new Date(notice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {role === 'CADET' && activeTab === 'attendance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>My Attendance & Parade Record</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Official institutional parade attendance ledger, muster verification, and certificate exam eligibility.
                    </p>
                  </div>
                  <button
                    onClick={() => fetchMyAttendance()}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH LEDGER</span>
                  </button>
                </div>

                {/* 4 Attendance Overview Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Overall Attendance</span>
                      <Shield size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: myAttendanceData.stats.percentage >= 75 ? '#047857' : '#DC2626' }}>
                      {myAttendanceData.stats.percentage}%
                    </div>
                    <div style={{ marginTop: '0.5rem', height: '6px', backgroundColor: 'var(--white-surface)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--white-border)' }}>
                      <div
                        style={{
                          width: `${myAttendanceData.stats.percentage}%`,
                          height: '100%',
                          backgroundColor: myAttendanceData.stats.percentage >= 75 ? '#047857' : '#DC2626',
                        }}
                      />
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Parades Attended</span>
                      <CheckCircle size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#047857' }}>
                      {myAttendanceData.stats.present} / {myAttendanceData.stats.total}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Full physical presence verified</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid #DC2626' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Absences Recorded</span>
                      <XCircle size={20} style={{ color: '#DC2626' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#DC2626' }}>
                      {myAttendanceData.stats.absent}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      {myAttendanceData.stats.excused > 0 ? `${myAttendanceData.stats.excused} sanctioned on leave` : 'Unsanctioned absences'}
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: `4px solid ${myAttendanceData.stats.percentage >= 75 ? '#047857' : '#DC2626'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Exam Clearance</span>
                      <Award size={20} style={{ color: myAttendanceData.stats.percentage >= 75 ? '#047857' : '#DC2626' }} />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: myAttendanceData.stats.percentage >= 75 ? '#047857' : '#DC2626', marginTop: '0.25rem' }}>
                      {myAttendanceData.stats.percentage >= 75 ? 'ELIGIBLE (≥75%)' : 'BELOW 75%'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      Required for 'B' & 'C' Cert exams
                    </div>
                  </div>
                </div>

                {/* Institutional Directorate Protocol Notice */}
                <div className="institutional-card" style={{ backgroundColor: 'var(--navy-badge-bg)', border: '1px solid var(--navy-badge-border)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Shield size={20} style={{ color: 'var(--navy-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                        NCC DIRECTORATE PARADE ATTENDANCE POLICY
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.6' }}>
                        Under Army Institute of Technology NCC Unit orders, cadets must attend a minimum of <strong>75% regular parades</strong> and <strong>1 mandatory annual training camp</strong> to qualify for certificate examinations. Absences during examinations must be covered by pre-sanctioned leave applications.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Session History Table */}
                <div className="institutional-card">
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '1rem' }}>
                    Parade & Training Attendance Ledger
                  </h3>
                  {myAttendanceData.records.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--navy-text-muted)' }}>
                      <Calendar size={32} style={{ color: 'var(--navy-border)', margin: '0 auto 0.75rem' }} />
                      <p style={{ fontSize: '0.95rem' }}>No muster records logged yet for your regimental number.</p>
                      <p style={{ fontSize: '0.82rem' }}>Attendance marked by Platoon Seniors during parades will appear here in real time.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Date & Timing</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Training Activity</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Location</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Platoon Wing</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Attendance Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myAttendanceData.records.map((record) => (
                            <tr key={record.id} style={{ borderBottom: '1px solid var(--white-border)' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--navy-primary)' }}>
                                {new Date(record.session?.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', fontWeight: 400 }}>
                                  {record.session?.timing}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--navy-primary)' }}>{record.session?.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>{record.session?.activity}</div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {record.session?.location}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--navy-text-muted)' }}>
                                {record.session?.targetPlatoon || 'All Platoons'}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <span
                                  className="badge-institutional"
                                  style={{
                                    backgroundColor: record.status === 'PRESENT' ? '#D1FAE5' : record.status === 'ABSENT' ? '#FEE2E2' : '#FEF3C7',
                                    color: record.status === 'PRESENT' ? '#047857' : record.status === 'ABSENT' ? '#DC2626' : '#D97706',
                                    fontWeight: 700,
                                  }}
                                >
                                  {record.status === 'PRESENT' && <Check size={11} style={{ display: 'inline', marginRight: '4px' }} />}
                                  {record.status === 'ABSENT' && <X size={11} style={{ display: 'inline', marginRight: '4px' }} />}
                                  {record.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PHASE 11: CADET / STUDENT DIGITAL CERTIFICATE VAULT */}
            {activeTab === 'certificates' && role !== 'ADMIN_ANO' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Digital Certificate Vault</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)' }}>
                      Official institutional certificates, camp credentials, and cryptographic tamper-evident verification ledger.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { setVerifyModal(true); setVerifyResult(null); }}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid var(--navy-primary)', color: 'var(--navy-primary)' }}
                    >
                      <ShieldCheck size={14} /> <span>VERIFY ANY RECORD</span>
                    </button>
                    <button
                      onClick={() => fetchCadetCertificates()}
                      className="btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RefreshCw size={14} /> <span>REFRESH VAULT</span>
                    </button>
                  </div>
                </div>

                {/* 4 Overview Stat Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Certificates Earned</span>
                      <Award size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{cadetCertificates.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Awarded in personal vault</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Highest Grade</span>
                      <CheckCircle size={20} style={{ color: '#047857' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857', marginTop: '0.35rem' }}>
                      {cadetCertificates.find((c) => c.grade === 'A') ? "GRADE 'A' (DISTINCTION)" : cadetCertificates.length > 0 ? "GRADE 'B'" : "NO RECORDS"}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Examination qualification grade</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Validity Status</span>
                      <ShieldCheck size={20} style={{ color: '#2563EB' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB', marginTop: '0.35rem' }}>
                      {cadetCertificates.length > 0 && cadetCertificates.every((c) => c.status === 'VALID') ? 'OFFICIALLY VALID' : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Directorial Directorate Record</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Security Hash</span>
                      <Shield size={20} style={{ color: '#D97706' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706', marginTop: '0.35rem' }}>SHA-256 DIGEST</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Cryptographically signed</div>
                  </div>
                </div>

                {/* Certificates Grid / List */}
                {cadetCertificates.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <Award size={48} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '0.5rem' }}>
                      No Certificates Logged in Vault Yet
                    </h3>
                    <p style={{ color: 'var(--navy-text-muted)', maxWidth: '480px', margin: '0 auto', fontSize: '0.88rem', lineHeight: '1.6' }}>
                      Certificates for annual examinations ('A', 'B', 'C') and camp completion credentials are authenticated by the ANO Command and will appear here with cryptographic verification stamps.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {cadetCertificates.map((cert) => (
                      <div
                        key={cert.id}
                        className="institutional-card"
                        style={{
                          borderLeft: '5px solid var(--navy-primary)',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <img
                              src="/assets/logos/ncc_logo.png"
                              alt="NCC"
                              style={{ width: '48px', height: '56px', objectFit: 'contain' }}
                            />
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {cert.issuingUnit} · {cert.institution}
                              </div>
                              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-primary)', margin: '0.2rem 0' }}>
                                {cert.title}
                              </h3>
                              <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                                Serial No: <strong style={{ color: 'var(--navy-primary)', fontFamily: 'monospace' }}>{cert.certificateNo}</strong>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span
                              className="badge-institutional"
                              style={{
                                backgroundColor: cert.grade === 'A' ? '#D1FAE5' : '#FEF3C7',
                                color: cert.grade === 'A' ? '#047857' : '#D97706',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                padding: '0.35rem 0.65rem',
                              }}
                            >
                              GRADE '{cert.grade}'
                            </span>
                            <span
                              className="badge-institutional"
                              style={{
                                backgroundColor: cert.status === 'VALID' ? '#EFF6FF' : '#FEE2E2',
                                color: cert.status === 'VALID' ? '#2563EB' : '#DC2626',
                                fontWeight: 700,
                              }}
                            >
                              {cert.status}
                            </span>
                          </div>
                        </div>

                        {/* Certificate Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', backgroundColor: 'var(--white-surface)', padding: '0.85rem 1rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ color: 'var(--navy-text-muted)' }}>Awarded To:</span>{' '}
                            <strong>{cert.cadet?.fullName}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--navy-text-muted)' }}>Regimental No:</span>{' '}
                            <strong>{cert.cadet?.regimentalNumber}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--navy-text-muted)' }}>Date of Issue:</span>{' '}
                            <strong>{new Date(cert.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--navy-text-muted)' }}>Certifying Officer:</span>{' '}
                            <strong>{cert.issuedBy}</strong>
                          </div>
                          {cert.campName && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: 'var(--navy-text-muted)' }}>Camp Credential:</span>{' '}
                              <strong>{cert.campName}</strong>
                            </div>
                          )}
                          {cert.remarks && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: 'var(--navy-text-muted)' }}>Commendation:</span>{' '}
                              <em>"{cert.remarks}"</em>
                            </div>
                          )}
                        </div>

                        {/* Cryptographic Hash Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--white-border)', paddingTop: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                            <ShieldCheck size={14} style={{ color: '#047857' }} />
                            <span>SHA-256 Digest:</span>
                            <code style={{ backgroundColor: 'var(--white-surface)', padding: '0.15rem 0.4rem', borderRadius: '3px', border: '1px solid var(--white-border)' }}>
                              {cert.verificationHash}
                            </code>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(cert.verificationHash);
                                alert('Verification hash copied to clipboard.');
                              }}
                              className="btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                            >
                              <Copy size={13} /> <span>COPY HASH</span>
                            </button>
                            <button
                              onClick={() => setSelectedCertificate(cert)}
                              className="btn-primary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                            >
                              <Award size={13} /> <span>VIEW OFFICIAL CERTIFICATE</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}




          </div>
        </main>
      </div>

      {/* CREATE CAMP MODAL */}
      {newCampModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setNewCampModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                backgroundColor: 'var(--navy-primary)',
                color: 'var(--white-pure)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)' }}>Schedule Unit Training Camp</h3>
              <button
                onClick={() => setNewCampModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateCamp} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  CAMP TITLE / DESIGNATION *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Combined Annual Training Camp (CATC-104)"
                  value={campForm.name}
                  onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    CAMP TYPE *
                  </label>
                  <select
                    value={campForm.campType}
                    onChange={(e) => setCampForm({ ...campForm, campType: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="Combined Annual Training Camp">CATC</option>
                    <option value="Thal Sainik Camp">TSC</option>
                    <option value="National Integration Camp">NIC</option>
                    <option value="Basic Leadership Camp">BLC</option>
                    <option value="Republic Day Camp">RDC</option>
                    <option value="Army Attachment Camp">Army Attachment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    CADET CAPACITY *
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={campForm.capacity}
                    onChange={(e) => setCampForm({ ...campForm, capacity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  LOCATION / MILITARY STATION *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIT Drill Ground & Camp Arena, Pune"
                  value={campForm.location}
                  onChange={(e) => setCampForm({ ...campForm, location: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    COMMENCEMENT DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={campForm.startDate}
                    onChange={(e) => setCampForm({ ...campForm, startDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    TERMINATION DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={campForm.endDate}
                    onChange={(e) => setCampForm({ ...campForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  CURRICULUM / OPERATIONAL DETAILS
                </label>
                <textarea
                  rows={3}
                  placeholder="Weapon classification, obstacle course training, map reading & night march syllabus..."
                  value={campForm.description}
                  onChange={(e) => setCampForm({ ...campForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => setNewCampModal(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm">
                  Sanction & Publish Camp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE EVENT MODAL */}
      {newEventModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setNewEventModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                backgroundColor: 'var(--navy-primary)',
                color: 'var(--white-pure)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)' }}>Schedule Unit Event / Parade</h3>
              <button
                onClick={() => setNewEventModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateEvent} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  EVENT TITLE *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kargil Vijay Diwas Ceremonial Parade"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    DATE & TIME *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.eventDate}
                    onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    VISIBILITY *
                  </label>
                  <select
                    value={eventForm.isPublic ? 'true' : 'false'}
                    onChange={(e) => setEventForm({ ...eventForm, isPublic: e.target.value === 'true' })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="true">Public (Shown on Homepage)</option>
                    <option value="false">Internal Cadet Order</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  LOCATION / VENUE *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIT Parade Ground, Pune"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  CEREMONIAL INSTRUCTIONS & BRIEF
                </label>
                <textarea
                  rows={3}
                  placeholder="Dress regulation: Ceremonial Khaki with Beret and Hackle. Reporting at 0630 hrs..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => setNewEventModal(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm">
                  Publish Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NOTICE MODAL */}
      {newNoticeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setNewNoticeModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                backgroundColor: 'var(--navy-primary)',
                color: 'var(--white-pure)',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)' }}>Broadcast Official Unit Notice</h3>
              <button
                onClick={() => setNewNoticeModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateNotice} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  NOTICE SUBJECT / TITLE *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mandatory Drill Inspection & Hackle Turnout Check"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    CATEGORY
                  </label>
                  <select
                    value={noticeForm.category}
                    onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="General">General Order</option>
                    <option value="Training">Training & Drill</option>
                    <option value="Camp">Camp Circular</option>
                    <option value="Parade">Parade Timing</option>
                    <option value="Administrative">Administrative Order</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem', paddingTop: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={noticeForm.isUrgent}
                      onChange={(e) => setNoticeForm({ ...noticeForm, isUrgent: e.target.checked })}
                    />
                    <strong style={{ color: '#DC2626' }}>Mark as URGENT Directive</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={noticeForm.isPublic}
                      onChange={(e) => setNoticeForm({ ...noticeForm, isPublic: e.target.checked })}
                    />
                    <span>Publish to Public Portal Bulletin</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  OFFICIAL TEXT / DIRECTIVE *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Full text of the order, instructions, turnout regulations, and consequences of non-compliance..."
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => setNewNoticeModal(false)} className="btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm">
                  Broadcast Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 9: LEAVE APPLICATION MODAL (Cadet) */}
      {leaveModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setLeaveModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%', maxWidth: '520px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)' }}>Submit Leave Application</h3>
              <button onClick={() => setLeaveModal(false)} style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <form onSubmit={handleSubmitLeave} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>LEAVE TYPE *</label>
                <select
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                >
                  <option value="Medical">Medical Leave</option>
                  <option value="Academic">Academic / Examination Leave</option>
                  <option value="Personal">Personal Leave</option>
                  <option value="Emergency">Emergency Leave</option>
                </select>
              </div>
              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>FROM DATE *</label>
                  <input type="date" required value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>TO DATE *</label>
                  <input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>REASON FOR LEAVE *</label>
                <textarea rows={3} required placeholder="State the specific reason for leave. For medical leave, mention doctor's advice..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => setLeaveModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn-primary btn-sm">SUBMIT LEAVE APPLICATION</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 7-8: LEAVE ACTION CONFIRM MODAL (Senior / Platoon Senior) */}
      {leaveRemarkModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => { setLeaveRemarkModal(null); setLeaveRemarks(''); }}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: `2px solid ${leaveRemarkModal.action === 'APPROVE' ? '#047857' : leaveRemarkModal.action === 'REJECT' ? '#DC2626' : 'var(--navy-primary)'}`,
              borderRadius: '6px',
              width: '100%', maxWidth: '480px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              backgroundColor: leaveRemarkModal.action === 'APPROVE' ? '#047857' : leaveRemarkModal.action === 'REJECT' ? '#DC2626' : 'var(--navy-primary)',
              color: 'var(--white-pure)',
              padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)' }}>
                {leaveRemarkModal.action} Leave — {leaveRemarkModal.leave.cadet?.fullName}
              </h3>
              <button onClick={() => { setLeaveRemarkModal(null); setLeaveRemarks(''); }} style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--navy-text-muted)', lineHeight: '1.6', backgroundColor: 'var(--white-surface)', padding: '0.75rem', borderRadius: '4px' }}>
                <strong>Leave Details:</strong><br />
                Type: {leaveRemarkModal.leave.leaveType}<br />
                Period: {new Date(leaveRemarkModal.leave.startDate).toLocaleDateString()} – {new Date(leaveRemarkModal.leave.endDate).toLocaleDateString()}<br />
                Reason: {leaveRemarkModal.leave.reason}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>COMMANDING REMARKS</label>
                <textarea rows={3} placeholder="Enter your remarks for this leave sanction decision..."
                  value={leaveRemarks}
                  onChange={(e) => setLeaveRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => { setLeaveRemarkModal(null); setLeaveRemarks(''); }} className="btn-secondary btn-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handleLeaveAction}
                  className="btn-primary btn-sm"
                  style={{ backgroundColor: leaveRemarkModal.action === 'REJECT' ? '#DC2626' : leaveRemarkModal.action === 'HOLD' ? '#D97706' : undefined, borderColor: leaveRemarkModal.action === 'REJECT' ? '#DC2626' : leaveRemarkModal.action === 'HOLD' ? '#D97706' : undefined }}
                >
                  CONFIRM {leaveRemarkModal.action}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* PHASE 10: CREATE ATTENDANCE SESSION MODAL */}
      {newAttendanceSessionModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setNewAttendanceSessionModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%', maxWidth: '540px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)', margin: 0 }}>Start Live Attendance Session</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: '#94A3B8' }}>
                  Senior device opens camera. Cadets step forward for automatic facial recognition.
                </p>
              </div>
              <button onClick={() => setNewAttendanceSessionModal(false)} style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <form onSubmit={handleCreateAttendanceSession} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>TRAINING ACTIVITY *</label>
                <select
                  value={attendanceForm.activity}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, activity: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                >
                  <option value="Morning Physical Training & Foot Drill">Morning Physical Training & Foot Drill</option>
                  <option value="Arms Drill & Weapon Handling">Arms Drill & Weapon Handling</option>
                  <option value="Map Reading & Field Craft">Map Reading & Field Craft</option>
                  <option value="Guard of Honour Rehearsal">Guard of Honour Rehearsal</option>
                  <option value="Obstacle Course & Physical Endurance">Obstacle Course & Physical Endurance</option>
                </select>
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>PARADE DATE *</label>
                  <input
                    type="date"
                    required
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>START TIME *</label>
                  <input
                    type="text"
                    required
                    placeholder="06:00"
                    value={attendanceForm.timing}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, timing: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>TARGET MUSTER</label>
                  <select
                    value={attendanceForm.targetPlatoon}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, targetPlatoon: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="All Cadets">Entire Unit Muster (All Cadets)</option>
                    <option value="Senior Division">Senior Division (SD)</option>
                    <option value="Senior Wing">Senior Wing (SW)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>LOCATION *</label>
                  <input
                    type="text"
                    required
                    value={attendanceForm.location}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, location: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Dynamic Database Expected Count Badge */}
              <div
                style={{
                  backgroundColor: 'var(--navy-badge-bg)',
                  border: '1px solid var(--navy-badge-border)',
                  borderRadius: '4px',
                  padding: '0.6rem 0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: 'var(--navy-primary)', fontWeight: 600 }}>
                  Expected Eligible Cadets (from Database):
                </span>
                <span
                  style={{
                    backgroundColor: 'var(--navy-primary)',
                    color: '#FFFFFF',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  {usersList.filter((u) => u.role === 'CADET').length || 7} CADETS
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => setNewAttendanceSessionModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button
                  type="submit"
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Camera size={14} />
                  <span>START LIVE ATTENDANCE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 11: LIVE FACE ATTENDANCE & BIOMETRIC SCANNER MODAL */}
      {biometricCameraActive && selectedAttendanceSession && (
        <FaceAttendanceModal
          session={selectedAttendanceSession}
          token={token || ''}
          onClose={() => setBiometricCameraActive(false)}
          onSessionUpdated={() => {
            fetchAttendanceSessions();
            if (selectedAttendanceSession?.id) {
              fetchSessionDetails(selectedAttendanceSession.id);
            }
          }}
        />
      )}

      {/* BIOMETRIC ENROLLMENT MODAL */}
      {enrollCadetTarget && (
        <FaceEnrollmentModal
          cadet={enrollCadetTarget}
          token={token || ''}
          onClose={() => setEnrollCadetTarget(null)}
          onEnrolled={() => {
            fetchAdminUsers();
            fetchPlatoonCadets();
          }}
        />
      )}

      {/* PHASE 11: OFFICIAL PRINTABLE MILITARY CERTIFICATE MODAL */}
      {selectedCertificate && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            overflowY: 'auto',
          }}
          onClick={() => setSelectedCertificate(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '6px',
              width: '100%', maxWidth: '820px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Toolbar */}
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
                <Award size={16} /> <span>Official NCC Institutional Certificate</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-outline-white btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                >
                  <Printer size={13} /> <span>PRINT / PDF</span>
                </button>
                <button
                  onClick={() => setSelectedCertificate(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Official Military Certificate Document Body */}
            <div
              id="printable-ncc-certificate"
              style={{
                padding: '2.5rem 3rem',
                backgroundColor: '#FFFFFF',
                color: '#061325',
                border: '12px double #0B2545',
                margin: '1rem',
                position: 'relative',
              }}
            >
              {/* Inner Decorative Border */}
              <div style={{ border: '2px solid #13315C', padding: '2rem 2.25rem', position: 'relative' }}>
                {/* Header Dual Crests */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <img
                    src="/assets/logos/ncc_logo.png"
                    alt="National Cadet Corps"
                    style={{ width: '68px', height: '80px', objectFit: 'contain' }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.15em', color: '#061325', textTransform: 'uppercase' }}>
                      NATIONAL CADET CORPS (NCC)
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#0B2545', marginTop: '0.25rem' }}>
                      2 MAHARASHTRA BATTALION NCC, PUNE
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                      ARMY INSTITUTE OF TECHNOLOGY, DIGHI CAMP, PUNE - 411015
                    </div>
                  </div>
                  <img
                    src="/assets/logos/ait_logo.gif"
                    alt="Army Institute of Technology"
                    style={{ width: '72px', height: '80px', objectFit: 'contain' }}
                  />
                </div>

                {/* Ornate Divider */}
                <div style={{ height: '3px', backgroundColor: '#0B2545', margin: '1rem auto 1.5rem', width: '80%' }} />

                {/* Certificate Main Title */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.2em', color: '#64748B', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    CERTIFICATE OF MERIT & QUALIFICATION
                  </div>
                  <h1 style={{ fontSize: '1.7rem', color: '#061325', fontFamily: 'var(--font-display)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {selectedCertificate.title}
                  </h1>
                  <div style={{ fontSize: '0.82rem', color: '#64748B', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                    SERIAL NO: <strong>{selectedCertificate.certificateNo}</strong>
                  </div>
                </div>

                {/* Certificate Text Body */}
                <div style={{ fontSize: '0.95rem', lineHeight: '2', textAlign: 'justify', marginBottom: '2rem', color: '#1E293B' }}>
                  This is to certify that Cadet <strong>{selectedCertificate.cadet?.fullName || 'CDT Rohan Verma'}</strong>,
                  Regimental Number <strong>{selectedCertificate.cadet?.regimentalNumber || 'MH24SDA100303'}</strong>,
                  College Roll Number <strong>{selectedCertificate.cadet?.collegeRollNumber || '24103'}</strong>,
                  of <strong>{selectedCertificate.cadet?.platoonName || 'Senior Division'}</strong>,
                  Army Institute of Technology, Pune has successfully undergone prescribed institutional training under the
                  National Cadet Corps Act of 1948 and has been awarded:
                </div>

                {/* Grade Callout */}
                <div style={{ textAlign: 'center', margin: '1.5rem auto 2rem' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#F8FAFC',
                      border: '2px solid #0B2545',
                      padding: '0.65rem 2.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: '0.5rem' }}>
                      ASSESSMENT GRADE:
                    </span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0B2545' }}>
                      GRADE '{selectedCertificate.grade}' (DISTINCTION)
                    </span>
                  </div>
                </div>

                {selectedCertificate.campName && (
                  <div style={{ textAlign: 'center', fontSize: '0.88rem', color: '#334155', marginBottom: '1.5rem' }}>
                    Camp Credential: <strong>{selectedCertificate.campName}</strong>
                  </div>
                )}

                {selectedCertificate.remarks && (
                  <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic', marginBottom: '2rem' }}>
                    "{selectedCertificate.remarks}"
                  </div>
                )}

                {/* Signatures & Seal Block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem', paddingTop: '1.5rem' }}>
                  {/* Left Signature */}
                  <div style={{ textAlign: 'center', minWidth: '180px' }}>
                    <div style={{ fontFamily: 'cursive', fontSize: '1.1rem', color: '#0B2545', marginBottom: '0.25rem' }}>
                      R.K. Sharma
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#0B2545', width: '100%', marginBottom: '0.35rem' }} />
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#061325' }}>Lt. Col. R.K. Sharma</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Associate NCC Officer (ANO)</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>AIT NCC Detachment</div>
                  </div>

                  {/* Center Official Seal Stamp */}
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: '85px',
                        height: '85px',
                        border: '3px double #0B2545',
                        borderRadius: '50%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0B2545',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        padding: '0.25rem',
                      }}
                    >
                      <div>★ NCC ★</div>
                      <div style={{ fontSize: '0.55rem', margin: '2px 0' }}>2 MAH BN</div>
                      <div>SEAL</div>
                    </div>
                  </div>

                  {/* Right Signature */}
                  <div style={{ textAlign: 'center', minWidth: '180px' }}>
                    <div style={{ fontFamily: 'cursive', fontSize: '1.1rem', color: '#0B2545', marginBottom: '0.25rem' }}>
                      A.K. Deshmukh
                    </div>
                    <div style={{ height: '1px', backgroundColor: '#0B2545', width: '100%', marginBottom: '0.35rem' }} />
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#061325' }}>Col. A.K. Deshmukh</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Commanding Officer</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B' }}>2 Maharashtra Bn NCC, Pune</div>
                  </div>
                </div>

                {/* Cryptographic Verification Footer */}
                <div style={{ marginTop: '2rem', paddingTop: '0.75rem', borderTop: '1px dashed #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748B', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    Date of Issue: <strong>{new Date(selectedCertificate.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={13} style={{ color: '#047857' }} />
                    <span>Cryptographic Digest:</span>
                    <code style={{ fontSize: '0.68rem', backgroundColor: '#F1F5F9', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                      {selectedCertificate.verificationHash}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 11: ANO ISSUE DIGITAL CERTIFICATE MODAL */}
      {newCertificateModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setNewCertificateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%', maxWidth: '560px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} />
                <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)' }}>Issue Institutional NCC Certificate</h3>
              </div>
              <button onClick={() => setNewCertificateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>
            <form onSubmit={handleIssueCertificate} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>SELECT CADET *</label>
                <select
                  required
                  value={certificateForm.cadetId}
                  onChange={(e) => setCertificateForm({ ...certificateForm, cadetId: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                >
                  <option value="">-- Choose enrolled cadet --</option>
                  {usersList
                    .filter((u: any) => u.role === 'CADET' || u.role === 'SENIOR' || u.role === 'PLATOON_SENIOR')
                    .map((cadet: any) => (
                      <option key={cadet.id} value={cadet.id}>
                        {cadet.fullName} ({cadet.regimentalNumber}) — {cadet.branch || 'Cadet'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>CERTIFICATE TYPE *</label>
                  <select
                    value={certificateForm.certificateType}
                    onChange={(e) => setCertificateForm({ ...certificateForm, certificateType: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="NCC 'B' Certificate">NCC 'B' Certificate</option>
                    <option value="NCC 'A' Certificate">NCC 'A' Certificate</option>
                    <option value="NCC 'C' Certificate">NCC 'C' Certificate</option>
                    <option value="ATC Camp Certificate">Annual Training Camp (ATC) Certificate</option>
                    <option value="Special Commendation">Commanding Officer Special Commendation</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>AWARDED GRADE *</label>
                  <select
                    value={certificateForm.grade}
                    onChange={(e) => setCertificateForm({ ...certificateForm, grade: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="A">Grade 'A' (Distinction)</option>
                    <option value="B">Grade 'B' (First Class)</option>
                    <option value="C">Grade 'C' (Pass)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>EXAMINATION / CERTIFICATE TITLE *</label>
                <input
                  type="text"
                  required
                  value={certificateForm.title}
                  onChange={(e) => setCertificateForm({ ...certificateForm, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>CAMP CREDENTIAL / REFERENCE (OPTIONAL)</label>
                <input
                  type="text"
                  value={certificateForm.campName}
                  onChange={(e) => setCertificateForm({ ...certificateForm, campName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>COMMENDATION & DRILL REMARKS</label>
                <textarea
                  rows={2}
                  value={certificateForm.remarks}
                  onChange={(e) => setCertificateForm({ ...certificateForm, remarks: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => setNewCertificateModal(false)} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn-primary btn-sm">ISSUE DIGITAL CERTIFICATE</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 11: PUBLIC / EXTERNAL CRYPTOGRAPHIC VERIFICATION MODAL */}
      {verifyModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => { setVerifyModal(false); setVerifyResult(null); }}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%', maxWidth: '580px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--white-pure)' }}>
                  National Cadet Corps Directorate · Certificate Verification
                </h3>
              </div>
              <button onClick={() => { setVerifyModal(false); setVerifyResult(null); }} style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', lineHeight: '1.6' }}>
                Enter the official certificate serial number (e.g. <code>NCC/MAH/2BN/2026/B-108474</code>) or SHA-256 cryptographic verification digest to verify genuineness against the Ministry of Defence / NCC Directorate records.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Enter Certificate Serial No. or SHA-256 Hash..."
                  value={verifyQuery}
                  onChange={(e) => setVerifyQuery(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.85rem', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  disabled={verifyingHash || !verifyQuery.trim()}
                  onClick={() => handleVerifyQuery(verifyQuery)}
                  className="btn-primary btn-sm"
                >
                  {verifyingHash ? 'Verifying...' : 'VERIFY'}
                </button>
              </div>

              {/* Verification Result */}
              {verifyResult && (
                <div style={{ marginTop: '0.5rem' }}>
                  {verifyResult.success && verifyResult.valid ? (
                    <div style={{ backgroundColor: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '6px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                        <CheckCircle size={18} /> <span>VERIFIED GENUINE INSTITUTIONAL RECORD</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.82rem', lineHeight: '1.5' }}>
                        <div><strong>Cadet:</strong> {verifyResult.certificate.cadetName}</div>
                        <div><strong>Regimental:</strong> {verifyResult.certificate.regimentalNumber}</div>
                        <div><strong>Certificate:</strong> {verifyResult.certificate.title}</div>
                        <div><strong>Grade:</strong> {verifyResult.certificate.grade}</div>
                        <div><strong>Issue Date:</strong> {new Date(verifyResult.certificate.issueDate).toLocaleDateString()}</div>
                        <div><strong>Unit:</strong> {verifyResult.certificate.issuingUnit}</div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong>Certifying Officer:</strong> {verifyResult.certificate.issuedBy}
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: '#047857', borderTop: '1px solid #BBF7D0', paddingTop: '0.5rem', fontFamily: 'monospace' }}>
                        DIGITAL SEAL: {verifyResult.digitalSeal} · {verifyResult.verificationAuthority}
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: '6px', padding: '1rem', textAlign: 'center' }}>
                      <XCircle size={28} style={{ color: '#DC2626', margin: '0 auto 0.5rem' }} />
                      <div style={{ color: '#DC2626', fontWeight: 800, fontSize: '0.95rem' }}>
                        UNVERIFIED / RECORD NOT FOUND
                      </div>
                      <p style={{ color: '#7F1D1D', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                        {verifyResult.message || 'No official NCC Directorate record matches the provided query.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--white-border)' }}>
                <button
                  type="button"
                  onClick={() => { setVerifyModal(false); setVerifyResult(null); }}
                  className="btn-secondary btn-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* BULK ATTENDANCE IMPORTER MODAL (GOOGLE SHEETS / CSV) */}
      {attendanceImportModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(6, 19, 37, 0.85)',
            zIndex: 1250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="institutional-modal-card" style={{ maxWidth: '750px', width: '92%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--navy-primary)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', margin: 0 }}>
                  Bulk Attendance Importer (Google Sheets / CSV)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--navy-text-muted)', margin: '0.25rem 0 0 0' }}>
                  Paste rows directly from your 1st Year NCC Attendance spreadsheet to mark parade attendance in batch.
                </p>
              </div>
              <button onClick={() => setAttendanceImportModal(false)} className="btn-secondary btn-sm"><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Select Target Session */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Target Parade Training Session *
                </label>
                <select
                  value={attendanceImportSessionId}
                  onChange={(e) => setAttendanceImportSessionId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--white-border)', borderRadius: '4px', fontSize: '0.88rem' }}
                >
                  <option value="">-- Select Parade Training Session --</option>
                  {attendanceSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({new Date(s.date).toLocaleDateString()} &bull; {s.targetPlatoon || 'All Platoons'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Paste Area */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                    Paste CSV / Sheet Rows (RegimentalNo/RollNo, Status, Remarks)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceImportText(
                        "MAH/SD/24/108474, PRESENT, Foot drill distinction\n25001, PRESENT, Standard turnout\nMAH/SD/24/108476, ABSENT, Unexcused"
                      );
                      setAttendanceImportPreview(parseAttendanceCSV(
                        "MAH/SD/24/108474, PRESENT, Foot drill distinction\n25001, PRESENT, Standard turnout\nMAH/SD/24/108476, ABSENT, Unexcused"
                      ));
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--navy-hover)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Load Sample Spreadsheet Data
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={attendanceImportText}
                  onChange={(e) => {
                    setAttendanceImportText(e.target.value);
                    setAttendanceImportPreview(parseAttendanceCSV(e.target.value));
                  }}
                  placeholder="e.g.&#10;MAH/SD/24/108474, PRESENT, On time&#10;25001, PRESENT, Good turnout&#10;MAH/SD/24/108476, ABSENT, Unexcused"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--white-border)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
              </div>

              {/* Parsed Preview */}
              {attendanceImportPreview.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--navy-primary)' }}>
                      Parsed Preview: {attendanceImportPreview.length} Cadets Detected
                    </strong>
                    <span className="badge-institutional" style={{ fontSize: '0.72rem' }}>READY TO COMMIT</span>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--white-border)', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--navy-primary)', color: '#FFFFFF', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem 0.6rem' }}>IDENTIFIER</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>STATUS</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>REMARKS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceImportPreview.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontWeight: 600 }}>{r.regimentalNumber}</td>
                            <td style={{ padding: '0.4rem 0.6rem' }}>
                              <span
                                className="badge-institutional"
                                style={{
                                  backgroundColor: r.status === 'PRESENT' ? '#D1FAE5' : r.status === 'EXCUSED' ? '#E0F2FE' : '#FEE2E2',
                                  color: r.status === 'PRESENT' ? '#047857' : r.status === 'EXCUSED' ? '#0369A1' : '#DC2626',
                                  fontSize: '0.7rem',
                                  padding: '0.15rem 0.4rem',
                                }}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.4rem 0.6rem', color: 'var(--navy-text-muted)' }}>{r.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setAttendanceImportModal(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importingAttendance || attendanceImportPreview.length === 0 || !attendanceImportSessionId}
                  onClick={handleExecuteAttendanceImport}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Check size={14} />
                  <span>{importingAttendance ? 'Processing...' : `IMPORT ${attendanceImportPreview.length} RECORDS`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BATCH CADET ROSTER IMPORTER MODAL (GOOGLE SHEETS / CSV) */}
      {cadetImportModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(6, 19, 37, 0.85)',
            zIndex: 1250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="institutional-modal-card" style={{ maxWidth: '850px', width: '94%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--navy-primary)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--navy-primary)', margin: 0 }}>
                  Batch Cadet Roster Importer (Google Sheets / Excel)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--navy-text-muted)', margin: '0.25rem 0 0 0' }}>
                  Paste CSV rows with headers: <code>fullName, regimentalNumber, collegeRollNumber, email, phone, year, branch, platoonName</code>
                </p>
              </div>
              <button onClick={() => setCadetImportModal(false)} className="btn-secondary btn-sm"><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                    Paste Enrollment Data from Google Sheets or Excel
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = "Rahul Deshmukh, MAH/SD/25/119001, 25001, rahul.d@aitpune.edu.in, 9876543210, FE (1st Year), Computer Engineering, Senior Division\nAmit Singh, MAH/SD/25/119002, 25002, amit.s@aitpune.edu.in, 9876543211, FE (1st Year), Information Technology, Senior Division\nPooja Nair, MAH/SW/25/119003, 25003, pooja.n@aitpune.edu.in, 9876543212, FE (1st Year), Mechanical Engineering, Senior Wing";
                      setCadetImportText(sample);
                      setCadetImportPreview(parseCadetCSV(sample));
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--navy-hover)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Load Sample Roster Data
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={cadetImportText}
                  onChange={(e) => {
                    setCadetImportText(e.target.value);
                    setCadetImportPreview(parseCadetCSV(e.target.value));
                  }}
                  placeholder="Rahul Deshmukh, MAH/SD/25/119001, 25001, rahul.d@aitpune.edu.in, 9876543210, FE (1st Year), Computer Engineering, Senior Division"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--white-border)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
              </div>

              {/* Parsed Preview */}
              {cadetImportPreview.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--navy-primary)' }}>
                      Parsed Preview: {cadetImportPreview.length} Cadets Detected
                    </strong>
                    <span className="badge-institutional" style={{ fontSize: '0.72rem' }}>VALIDATED ROSTER</span>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--white-border)', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--navy-primary)', color: '#FFFFFF', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem 0.6rem' }}>NAME</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>REGIMENTAL NO</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>ROLL NO</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>BRANCH & YEAR</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>PLATOON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cadetImportPreview.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700 }}>{c.fullName}</td>
                            <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace' }}>{c.regimentalNumber}</td>
                            <td style={{ padding: '0.4rem 0.6rem' }}>{c.collegeRollNumber}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: 'var(--navy-text-muted)' }}>{c.branch} ({c.year})</td>
                            <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{c.platoonName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCadetImportModal(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importingCadets || cadetImportPreview.length === 0}
                  onClick={handleExecuteCadetImport}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Check size={14} />
                  <span>{importingCadets ? 'Importing...' : `IMPORT ${cadetImportPreview.length} CADETS TO ROSTER`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};





