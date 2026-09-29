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
  Eye,
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
import { CadetLifecycleDialog, CadetLifecycleSubmission, CadetLifecycleAction } from './CadetLifecycleDialog';
import { RequestCenterView } from './RequestCenterView';
import { ApprovalCenterView } from './ApprovalCenterView';
import { TimelineView } from './TimelineView';
import { CampsActivitiesView } from './CampsActivitiesView';
import { DutyRosterView } from './DutyRosterView';
import { PendingActionsView } from './PendingActionsView';
import { RankPromotionDialog } from './RankPromotionDialog';
import { InquiryDeskView } from './InquiryDeskView';
import { safeApiFetch } from '../../utils/api';
import { MediaManagementView } from './MediaManagementView';
import { DigitalIdView } from '../digitalId/DigitalIdView';


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
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditFilters, setAuditFilters] = useState({ q: '', actor: '', action: '', entity: '', from: '', to: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPlatoon, setFilterPlatoon] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterRank, setFilterRank] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFaceEnrollment, setFilterFaceEnrollment] = useState('');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryTotal, setDirectoryTotal] = useState(0);
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
  const [cadetStatusFilter, setCadetStatusFilter] = useState('ACTIVE');
  const [totalActiveCadets, setTotalActiveCadets] = useState<number | null>(null);
  const [selectedCadetForProfile, setSelectedCadetForProfile] = useState<any | null>(null);
  const [cadetLifecycleTarget, setCadetLifecycleTarget] = useState<{ cadet: any; action: CadetLifecycleAction } | null>(null);
  const [cadetLifecycleSubmitting, setCadetLifecycleSubmitting] = useState(false);
  const [rankTarget, setRankTarget] = useState<any | null>(null);
  const [rankSubmitting, setRankSubmitting] = useState(false);

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
  const [pendingAction, setPendingAction] = useState<{ userId: string; userName: string; type: 'role' | 'status' | 'platoon' | 'senior'; value: string } | null>(null);

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
  const [notificationFilter, setNotificationFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [notificationPreferences, setNotificationPreferences] = useState({ emailEnabled: true, pushEnabled: true });
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

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
      const params = new URLSearchParams({ page: String(auditPage), pageSize: '25' });
      Object.entries(auditFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const res = await fetch(`/api/admin/audit-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.success) { setAdminAuditLogs(data.logs); setAuditTotalPages(Math.max(1, data.totalPages || 1)); }
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
      if (filterYear) params.append('year', filterYear);
      if (filterRank) params.append('rank', filterRank);
      if (filterTeam) params.append('team', filterTeam);
      if (filterStatus) params.append('status', filterStatus);
      if (filterFaceEnrollment) params.append('faceEnrolled', filterFaceEnrollment);
      params.append('page', String(directoryPage));
      params.append('pageSize', '50');

      const { ok, data } = await safeApiFetch(`/api/admin/users?${params.toString()}`);
      if (ok && data?.success) {
        setUsersList(data.users || []);
        setDirectoryTotal(data.total || 0);
        if (typeof data.totalActiveCadets === 'number') {
          setTotalActiveCadets(data.totalActiveCadets);
        }
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const exportCadetDirectoryCsv = async () => {
    const params = new URLSearchParams({ export: 'csv' });
    if (searchQuery) params.set('search', searchQuery);
    if (filterRole) params.set('role', filterRole);
    if (filterPlatoon) params.set('platoon', filterPlatoon);
    if (filterYear) params.set('year', filterYear);
    if (filterRank) params.set('rank', filterRank);
    if (filterTeam) params.set('team', filterTeam);
    if (filterStatus) params.set('status', filterStatus);
    if (filterFaceEnrollment) params.set('faceEnrolled', filterFaceEnrollment);
    const { ok, data } = await safeApiFetch(`/api/admin/users?${params.toString()}`);
    if (!ok || !data?.success) { alert(data?.message || 'Could not export cadet list'); return; }
    const columns = ['Name', 'Regimental Number', 'College Roll Number', 'Email', 'Year', 'Branch', 'Wing/Platoon', 'Team', 'Rank', 'Status'];
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = (data.users || []).map((u: any) => [u.fullName, u.regimentalNumber, u.collegeRollNumber, u.email, u.year, u.branch, u.platoonName, u.team, u.rank, u.status]);
    const blob = new Blob([[columns, ...rows].map((row) => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ncc-cadet-list-${filterYear || 'all-years'}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  // Fetch Senior Assigned Cadets
  const fetchSeniorCadets = async () => {
    if (!token) return;
    try {
      const { ok, data } = await safeApiFetch('/api/hierarchy/senior/cadets');
      if (ok && data?.success) {
        setAssignedCadets(data.assignedCadets || []);
      }
    } catch (err) {
      console.error('Fetch senior cadets error:', err);
    }
  };

  // Fetch Platoon Cadets
  const fetchPlatoonCadets = async (statusFilter = cadetStatusFilter) => {
    if (!token) return;
    try {
      const { ok, data } = await safeApiFetch(`/api/hierarchy/platoon-senior/cadets?status=${encodeURIComponent(statusFilter)}`);
      if (ok && data?.success) {
        setPlatoonCadets(data.cadets || []);
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
      const { ok, data } = await safeApiFetch('/api/reviews/pending');
      if (ok && data?.success && Array.isArray(data.applications)) {
        setPendingReviews(data.applications);
        return;
      }
    } catch (err) {
      console.error('Fetch pending reviews error:', err);
    }
  };

  // Assign Cadet to Senior Mentor
  const handleAssignSenior = async (cadetId: string, seniorId: string) => {
    try {
      const { ok, data } = await safeApiFetch('/api/admin/assignments/senior', {
        method: 'POST',
        body: JSON.stringify({ cadetId, seniorId }),
      });
      if (ok && data?.success) {
        fetchAdminUsers();
        fetchSeniorCadets();
      } else {
        alert(data?.message || 'Assignment failed');
      }
    } catch (err) {
      console.error('Assign senior error:', err);
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
    try {
      const { ok, data } = await safeApiFetch('/api/attendance/sessions');
      if (ok && data?.success) {
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
    try {
      const { ok, data } = await safeApiFetch(`/api/attendance/sessions/${sessionId}`);
      if (ok && data?.success) {
        setSelectedAttendanceSession(data.session);
      }
    } catch (err) {
      console.error('Fetch session attendance error:', err);
    }
  };

  const fetchMyAttendance = async () => {
    try {
      const { ok, data } = await safeApiFetch('/api/attendance/my');
      if (ok && data?.success) {
        setMyAttendanceData({ stats: data.stats, records: data.records || [] });
      }
    } catch (err) {
      console.error('Fetch my attendance error:', err);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const { ok, data } = await safeApiFetch('/api/attendance/summary');
      if (ok && data?.success) {
        setAttendanceSummaryList(data.summary || []);
      }
    } catch (err) {
      console.error('Fetch attendance summary error:', err);
    }
  };

  const handleMarkCadetAttendance = async (sessionId: string, cadetId: string, status: string) => {
    try {
      const { ok, data } = await safeApiFetch(`/api/attendance/sessions/${sessionId}/mark`, {
        method: 'PATCH',
        body: JSON.stringify({ cadetId, status }),
      });
      if (ok && data?.success) {
        fetchSessionDetails(sessionId);
        fetchAttendanceSessions();
      } else {
        alert(data?.message || 'Failed to mark attendance');
      }
    } catch (err) {
      console.error('Mark attendance error:', err);
    }
  };

  const handleCreateAttendanceSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { ok, data } = await safeApiFetch('/api/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify({
          ...attendanceForm,
          startTime: attendanceForm.timing || '06:00',
        }),
      });

      if (ok && data?.success) {
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
        alert(data?.message || 'Failed to create attendance session');
      }
    } catch (err: any) {
      console.error('Create attendance session error:', err);
      alert(err.message || 'Error creating attendance session');
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
      const wasUnread = notifications.some((item) => item.id === id && !item.isRead);
      const response = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!token) return;
    const res = await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { setNotifications((items) => items.map((item) => ({ ...item, isRead: true }))); setUnreadCount(0); }
  };

  const saveNotificationPreferences = async (patch: Partial<typeof notificationPreferences>) => {
    if (!token) return;
    const next = { ...notificationPreferences, ...patch };
    const res = await fetch('/api/notifications/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(next) });
    if (res.ok) setNotificationPreferences(next);
  };

  const disableBrowserPush = async () => {
    if (!token || !('serviceWorker' in navigator)) { await saveNotificationPreferences({ pushEnabled: false }); return; }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/notifications/push/subscription', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      await subscription.unsubscribe();
    }
    await saveNotificationPreferences({ pushEnabled: false });
  };

  const enableBrowserPush = async () => {
    if (!token || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { alert('Browser push is unavailable on this device.'); return; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const keyResponse = await fetch('/api/notifications/push/public-key', { headers: { Authorization: `Bearer ${token}` } });
    const keyData = await keyResponse.json();
    if (!keyResponse.ok || !keyData.publicKey) { alert(keyData.message || 'Browser push is not configured.'); return; }
    const applicationServerKey = Uint8Array.from(atob(keyData.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    const response = await fetch('/api/notifications/push/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
    if (!response.ok) { await subscription.unsubscribe(); alert('Could not save this device subscription.'); return; }
    await saveNotificationPreferences({ pushEnabled: true });
  };

  useEffect(() => {
    if (globalQuery.trim().length < 2 || !token) { setGlobalResults([]); return; }
    const timer = window.setTimeout(async () => {
      try { const res = await fetch(`/api/search?q=${encodeURIComponent(globalQuery.trim())}`, { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); if (res.ok) setGlobalResults(data.results || []); } catch { setGlobalResults([]); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [globalQuery, token]);

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
      const { ok, data } = await safeApiFetch('/api/attendance/bulk-import', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: attendanceImportSessionId,
          records: attendanceImportPreview,
        }),
      });
      if (ok && data?.success) {
        alert(data.message);
        setAttendanceImportModal(false);
        setAttendanceImportText('');
        setAttendanceImportPreview([]);
        fetchAttendanceSessions();
        fetchAttendanceSummary();
      } else {
        alert(data?.message || 'Import failed.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      alert(err.message || 'Error during attendance import');
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
    if (role === 'ADMIN_ANO' && activeTab === 'audit') fetchAdminAuditLogs();
  }, [role, activeTab, auditPage, auditFilters, token]);

  useEffect(() => {
    fetchNotifications();
    const notificationTimer = window.setInterval(fetchNotifications, 15000);
    if (token) fetch('/api/notifications/preferences', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((d) => { if (d.success) setNotificationPreferences({ emailEnabled: d.preferences.emailEnabled, pushEnabled: d.preferences.pushEnabled }); }).catch(() => undefined);
    return () => window.clearInterval(notificationTimer);
  }, [token]);

  useEffect(() => {
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
  }, [role, token, filterRole, filterPlatoon, filterYear, filterRank, filterTeam, filterStatus, filterFaceEnrollment, directoryPage]);

  // Real-time synchronization across officer panels (Phase 15)
  useEffect(() => {
    const handleDataUpdated = () => {
      fetchAdminUsers();
      fetchSeniorCadets();
      fetchPlatoonCadets();
      fetchPendingReviews();
    };
    window.addEventListener('ncc:data-updated', handleDataUpdated);
    return () => window.removeEventListener('ncc:data-updated', handleDataUpdated);
  }, []);

  // Admin Actions
  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { ok, data } = await safeApiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      if (ok && data?.success) {
        fetchAdminUsers();
      } else {
        alert(data?.message || 'Action rejected');
      }
    } catch (err) {
      console.error('Role update error:', err);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    const selectedCadet = [...usersList, ...platoonCadets].find((cadet) => cadet.id === userId && cadet.role === 'CADET');
    if (selectedCadet
      && (['INACTIVE', 'PASSED_OUT'].includes(newStatus)
        || ['INACTIVE', 'PASSED_OUT'].includes(selectedCadet.status))) {
      alert('Use the audited cadet lifecycle dialog to deactivate or reactivate a cadet.');
      return;
    }
    try {
      const { ok, data } = await safeApiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (ok && data?.success) {
        fetchAdminUsers();
        fetchSeniorCadets();
        fetchPlatoonCadets();
      } else {
        alert(data?.message || 'Status update failed');
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const submitCadetLifecycle = async (values: CadetLifecycleSubmission): Promise<string | null> => {
    if (!cadetLifecycleTarget) return 'No cadet was selected';
    setCadetLifecycleSubmitting(true);
    try {
      const { ok, data } = await safeApiFetch(`/api/hierarchy/cadets/${encodeURIComponent(cadetLifecycleTarget.cadet.id)}/lifecycle`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      if (!ok || !data?.success) return data?.message || 'Cadet status update failed';
      if (role === 'PLATOON_SENIOR') await fetchPlatoonCadets(cadetStatusFilter);
      if (role === 'ADMIN_ANO') await fetchAdminUsers();
      return null;
    } catch (error) {
      console.error('Cadet lifecycle update error:', error);
      return 'Unable to update cadet status. Please try again.';
    } finally {
      setCadetLifecycleSubmitting(false);
    }
  };

  const submitCadetRank = async (values: { rank: string; appointmentDate: string; remarks: string }): Promise<string | null> => {
    if (!rankTarget) return 'No cadet was selected';
    setRankSubmitting(true);
    try {
      const { ok, data } = await safeApiFetch(`/api/ranks/cadets/${encodeURIComponent(rankTarget.id)}`, {
        method: 'POST', body: JSON.stringify(values),
      });
      if (!ok || !data?.success) return data?.message || 'Unable to update cadet rank';
      await fetchAdminUsers();
      return null;
    } catch (error) {
      console.error('Rank update error:', error);
      return 'Unable to update cadet rank. Please try again.';
    } finally {
      setRankSubmitting(false);
    }
  };

  const handleTransferPlatoon = async (userId: string, platoonName: string) => {
    try {
      const { ok, data } = await safeApiFetch(`/api/admin/users/${userId}/platoon`, {
        method: 'PATCH',
        body: JSON.stringify({ platoonName }),
      });
      if (ok && data?.success) {
        fetchAdminUsers();
        fetchPlatoonCadets();
      } else {
        alert(data?.message || 'Transfer failed');
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
    else if (type === 'senior') await handleAssignSenior(userId, value);
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
            { id: 'overview', name: 'Overview' },
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
            { id: 'media', name: 'Photo Archives & Rank Holders' },
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
            { id: 'cadets', name: 'My Platoon Cadets' },
            { id: 'camps', name: 'Camps & Nominations' },
            { id: 'duties', name: 'Duty & Ceremonial Detail' },
            { id: 'timeline', name: 'Activity Timeline' },
            { id: 'certificates', name: 'My Certificates' },
            { id: 'media', name: 'Photo Archives' },
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
            { id: 'assigned', name: 'My Cadets' },
            { id: 'camps', name: 'Camps & Activities' },
            { id: 'duties', name: 'Duty & Ceremonial Detail' },
            { id: 'timeline', name: 'Activity Timeline' },
            { id: 'certificates', name: 'My Certificates' },
            { id: 'media', name: 'Photo Archives' },
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
            { id: 'digital-id', name: 'Digital NCC ID' },
            { id: 'requests', name: 'NCC Request Center' },
            { id: 'inquiries', name: 'My Official Inquiries' },
            { id: 'timeline', name: 'Activity Timeline' },
            { id: 'camps', name: 'Camps & Activities' },
            { id: 'duties', name: 'My Assigned Duties' },
            { id: 'attendance', name: 'Attendance' },
            { id: 'certificates', name: 'Certificates' },
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
            <div style={{ fontSize: '0.75rem', color: 'var(--color-info-border)' }}>{meta.subtitle}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <input aria-label="Global Search" value={globalQuery} onChange={(event) => { setGlobalQuery(event.target.value); setGlobalSearchOpen(true); }} onFocus={() => setGlobalSearchOpen(true)} placeholder="Search" style={{ width: 190, padding: '0.45rem 0.6rem', borderRadius: 4 }} />
            {globalSearchOpen && globalQuery.trim().length >= 2 && <div style={{ position: 'absolute', top: '120%', right: 0, width: 320, maxHeight: 320, overflowY: 'auto', background: 'white', color: '#10233e', zIndex: 1300, boxShadow: '0 8px 24px #0003', borderRadius: 6 }}>
              {globalResults.length ? globalResults.map((result) => <button key={`${result.type}-${result.id}`} onClick={() => { if (result.type === 'Camp') setActiveTab('camps'); else if (result.type === 'Duty') setActiveTab('duties'); else if (result.type === 'Certificate') setActiveTab('certificates'); else if (result.type === 'Leave') setActiveTab('leave'); else if (result.type === 'Notice') setActiveTab('notices'); else if (result.type === 'Cadet' || result.type === 'Senior' || result.type === 'Platoon Senior') setSelectedCadetForProfile({ id: result.id, fullName: result.title, rank: result.description.split(' · ')[0], regimentalNumber: result.description.split(' · ')[1], platoonName: result.description.split(' · ')[2] }); setGlobalSearchOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, border: 0, borderBottom: '1px solid #e7eaf0', background: 'white', cursor: 'pointer' }}><b>{result.title}</b><small style={{ display: 'block' }}>{result.type} · {result.description}</small></button>) : <div style={{ padding: 12 }}>No matching records</div>}
            </div>}
          </div>
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
                color: 'var(--color-background)',
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
                    backgroundColor: 'var(--color-error)',
                    color: 'var(--color-background)',
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
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-primary)',
                  border: '2px solid var(--navy-primary)',
                  borderRadius: '6px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                  zIndex: 1200,
                  maxHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--navy-primary)', color: 'var(--color-background)', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em' }}>NOTIFICATIONS</span>
                  <button onClick={() => void markAllNotificationsRead()} style={{ background: 'transparent', border: 0, color: 'white', cursor: 'pointer', fontSize: 12 }}>Mark all read ({unreadCount})</button>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap' }}>
                  <button onClick={() => setNotificationFilter('ALL')}>All</button><button onClick={() => setNotificationFilter('UNREAD')}>Unread</button>
                  <button onClick={() => void saveNotificationPreferences({ emailEnabled: !notificationPreferences.emailEnabled })}>Email {notificationPreferences.emailEnabled ? 'On' : 'Off'}</button>
                  <button onClick={() => notificationPreferences.pushEnabled ? void disableBrowserPush() : void enableBrowserPush()}>Push {notificationPreferences.pushEnabled ? 'On' : 'Enable'}</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
                  {(notificationFilter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications).length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                      No notifications recorded
                    </div>
                  ) : (
                    (notificationFilter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkNotificationRead(n.id)}
                        style={{
                          padding: '0.65rem 1rem',
                          borderBottom: '1px solid var(--color-surface)',
                          backgroundColor: n.isRead ? 'var(--color-background)' : 'var(--color-success-soft)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: n.isUrgent ? 'var(--color-error)' : 'var(--navy-primary)' }}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span style={{ width: '7px', height: '7px', backgroundColor: 'var(--color-success)', borderRadius: '50%', display: 'inline-block', flexShrink: 0, marginTop: '4px' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-disabled)', marginTop: '0.3rem' }}>
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(n.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="badge-dark" style={{ background: 'var(--color-primary)' }}>
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
          <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-disabled)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
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
                color: activeTab === item.id ? 'var(--white-pure)' : 'var(--color-border)',
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

        </aside>

        {/* Content Area */}
        <main id="role-main-content" tabIndex={-1} style={{ flex: 1, padding: '2rem', backgroundColor: 'var(--white-surface)', overflowX: 'auto' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {activeTab === 'overview' && <PendingActionsView onOpen={setActiveTab} />}
            {activeTab === 'digital-id' && role === 'CADET' && <DigitalIdView token={token} />}
            {activeTab === 'media' && ['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR'].includes(role) && <MediaManagementView role={role} />}
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Overview</h2>
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

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Pending Review</span>
                      <Clock size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {pendingReviews.length}
                    </div>
                    <button
                      onClick={() => setActiveTab('approvals')}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--navy-primary)', textDecoration: 'underline', cursor: 'pointer', marginTop: '0.25rem' }}
                    >
                      Process queue &rarr;
                    </button>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Training Camps</span>
                      <Flag size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                      {adminCamps.length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      Annual & attachment camps
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Scheduled Events</span>
                      <Calendar size={20} style={{ color: 'var(--color-accent)' }} />
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
                      <h3 style={{ color: 'var(--white-pure)', fontSize: '1.2rem', marginBottom: '0.25rem' }}>Quick Actions</h3>
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>CADET DIRECTORY &amp; ROLES</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span className="badge-institutional" style={{ background: 'var(--color-info-soft)', color: 'var(--navy-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                        Total Active Cadets: {totalActiveCadets !== null ? totalActiveCadets : usersList.filter(u => u.status === 'ACTIVE' && u.role === 'CADET').length}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                        Institutional Command Scope &bull; Personnel Directory &bull; Mentor Assignments
                      </span>
                    </div>
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
                      onChange={(e) => { setDirectoryPage(1); setSearchQuery(e.target.value); }}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAdminUsers()}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--white-border)', borderRadius: '4px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <select
                    value={filterRole}
                    onChange={(e) => { setDirectoryPage(1); setFilterRole(e.target.value); }}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                  >
                    <option value="">All Cadets</option>
                    <option value="CADET">Enrolled Cadets</option>
                    <option value="SENIOR">Senior Cadets</option>
                    <option value="PLATOON_SENIOR">Platoon Seniors</option>
                    <option value="ADMIN_ANO">Admin / ANO</option>
                  </select>

                  <select
                    value={filterPlatoon}
                    onChange={(e) => { setDirectoryPage(1); setFilterPlatoon(e.target.value); }}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                  >
                    <option value="">All Wings / Contingents</option>
                    <option value="Senior Division">Senior Division (SD)</option>
                    <option value="Senior Wing">Senior Wing (SW)</option>
                  </select>
                  <select value={filterYear} onChange={(e) => { setDirectoryPage(1); setFilterYear(e.target.value); }} aria-label="Filter cadets by year" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}>
                    <option value="">All Years</option>
                    <option value="FE">1st Year (FE)</option>
                    <option value="SE">2nd Year (SE)</option>
                    <option value="TE">3rd Year (TE)</option>
                  </select>
                  <select value={filterRank} onChange={(e) => { setDirectoryPage(1); setFilterRank(e.target.value); }} aria-label="Filter cadets by rank" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}>
                    <option value="">All Ranks</option>
                    {['CDT', 'LCPL', 'CPL', 'SGT', 'CQMH', 'CSM', 'JUO', 'SUO'].map((rank) => <option key={rank} value={rank}>{rank}</option>)}
                  </select>
                  <input aria-label="Filter cadets by team" placeholder="Team" value={filterTeam} onChange={(e) => { setDirectoryPage(1); setFilterTeam(e.target.value); }} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem', maxWidth: '130px' }} />
                  <select value={filterStatus} onChange={(e) => { setDirectoryPage(1); setFilterStatus(e.target.value); }} aria-label="Filter cadets by status" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}>
                    <option value="">All Statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="PASSED_OUT">Passed Out</option><option value="UNDER_REVIEW">Under Review</option><option value="HOLD">On Hold</option>
                  </select>
                  <select value={filterFaceEnrollment} onChange={(e) => { setDirectoryPage(1); setFilterFaceEnrollment(e.target.value); }} aria-label="Filter by face enrollment" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}>
                    <option value="">All Face Enrollment</option><option value="true">Enrolled</option><option value="false">Not Enrolled</option>
                  </select>
                  <button type="button" className="btn-secondary btn-sm" onClick={exportCadetDirectoryCsv} style={{ padding: '0.5rem 0.75rem' }}>Export All Filtered CSV</button>
                </div>

                {/* Personnel Table */}
                <div className="cadet-directory-scroll" role="region" aria-label="Cadet directory table" tabIndex={0}>
                  <table className="cadet-directory-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Cadet / Officer</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Regimental No</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Wing / Platoon</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Senior Mentor</th>
                        <th style={{ padding: '0.75rem 1rem' }}>NCC Rank</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--navy-text-muted)' }}>
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
                            <div
                              style={{ cursor: 'pointer', color: 'var(--navy-primary)' }}
                              onClick={() => setSelectedCadetForProfile(u)}
                            >
                              {u.fullName}
                            </div>
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
                            {u.role === 'CADET' ? (
                              <select
                                value={pendingAction && pendingAction.userId === u.id && pendingAction.type === 'senior' ? pendingAction.value : (u.mentorAssignment?.senior?.id || '')}
                                onChange={(e) => setPendingAction({ userId: u.id, userName: u.fullName, type: 'senior', value: e.target.value })}
                                style={{ padding: '0.3rem', fontSize: '0.8rem', borderRadius: '3px', border: '1px solid var(--white-border)', cursor: 'pointer', maxWidth: '160px' }}
                              >
                                <option value="">Unassigned</option>
                                {usersList
                                  .filter((s: any) => s.role === 'SENIOR' || s.role === 'PLATOON_SENIOR')
                                  .map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                      {s.fullName} ({s.role === 'SENIOR' ? 'Senior' : 'Platoon Sr.'})
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)' }}>Commander</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--navy-primary)', whiteSpace: 'nowrap' }}>
                            {u.role === 'CADET' ? (u.rank || 'CDT') : '—'}
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
                                border: pendingAction && pendingAction.userId === u.id && pendingAction.type === 'status' ? '2px solid var(--color-primary)' : '1px solid var(--white-border)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: u.status === 'ACTIVE' || u.status === 'APPROVED' ? 'var(--color-success)'
                                  : u.status === 'REJECTED' || u.status === 'INACTIVE' ? 'var(--color-error)'
                                  : u.status === 'UNDER_REVIEW' ? 'var(--color-primary)'
                                  : 'inherit',
                              }}
                            >
                              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                              <option value="APPROVED">APPROVED</option>
                              <option value="ACTIVE" disabled={u.role === 'CADET' && ['INACTIVE', 'PASSED_OUT'].includes(u.status)}>ACTIVE</option>
                              <option value="HOLD">HOLD</option>
                              <option value="REJECTED">REJECTED</option>
                              <option value="INACTIVE" disabled={u.role === 'CADET'}>INACTIVE (use lifecycle action)</option>
                              <option value="PASSED_OUT" disabled={u.role === 'CADET'}>PASSED_OUT (use lifecycle action)</option>
                            </select>
                            {/* Inline confirm for dropdown changes */}
                            {pendingAction && pendingAction.userId === u.id && (
                              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600 }}>Apply change?</span>
                                <button
                                  onClick={executePendingAction}
                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', backgroundColor: 'var(--color-success)', color: 'var(--color-background)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setPendingAction(null)}
                                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', backgroundColor: 'var(--color-text-secondary)', color: 'var(--color-background)', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                >
                                  No
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                              <button
                                className="btn-secondary btn-sm"
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  borderColor: 'var(--navy-primary)',
                                  color: 'var(--navy-primary)',
                                }}
                                onClick={() => setSelectedCadetForProfile(u)}
                              >
                                <Eye size={12} /> View Profile
                              </button>
                              {/* Quick Approve for pending cadets */}
                              {(u.status === 'UNDER_REVIEW' || u.status === 'REJECTED') && (
                                <button
                                  className="btn-primary btn-sm"
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: 'var(--color-success)',
                                    borderColor: 'var(--color-success)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                  onClick={() => handleUpdateStatus(u.id, 'APPROVED')}
                                >
                                  <CheckCircle size={11} /> Approve
                                </button>
                              )}
                              {/* Cadet lifecycle changes use the reason/date/audit workflow. */}
                              {u.role === 'CADET' && u.id !== user?.id && (
                                ['INACTIVE', 'PASSED_OUT'].includes(u.status) ? (
                                  <button
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.6rem',
                                      fontSize: '0.75rem',
                                      backgroundColor: 'var(--color-success)',
                                      borderColor: 'var(--color-success)',
                                      color: 'var(--color-background)',
                                    }}
                                    onClick={() => setCadetLifecycleTarget({ cadet: u, action: 'REACTIVATE' })}
                                  >
                                    Reactivate
                                  </button>
                                ) : (
                                  <button
                                    className="btn-secondary btn-sm"
                                    style={{
                                      padding: '0.25rem 0.6rem',
                                      fontSize: '0.75rem',
                                      borderColor: 'var(--color-error)',
                                      color: 'var(--color-error)',
                                    }}
                                    onClick={() => setCadetLifecycleTarget({ cadet: u, action: 'DEACTIVATE' })}
                                  >
                                    Deactivate
                                  </button>
                                )
                              )}
                              {u.role === 'CADET' && (
                                <button className="btn-secondary btn-sm" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setRankTarget(u)}>
                                  Update Rank
                                </button>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.75rem 0' }}>
                  <span style={{ color: 'var(--navy-text-muted)', fontSize: '0.85rem' }}>Showing {usersList.length ? (directoryPage - 1) * 50 + 1 : 0}–{Math.min(directoryPage * 50, directoryTotal)} of {directoryTotal} matching cadets</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary btn-sm" disabled={directoryPage <= 1} onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))}>Previous</button>
                    <button className="btn-secondary btn-sm" disabled={directoryPage * 50 >= directoryTotal} onClick={() => setDirectoryPage((page) => page + 1)}>Next</button>
                  </div>
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
                  </div>
                ) : (
                  <div className="grid-2">
                    {adminEvents.map((evt) => (
                      <div key={evt.id} className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)' }}>{evt.title}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge-institutional">{evt.isPublic ? 'PUBLIC' : 'INTERNAL'}</span>
                            <button
                              onClick={() => handleDeleteEvent(evt.id, evt.title)}
                              title="Delete Event"
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '2px' }}
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
                          <div><strong>Status:</strong> <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{evt.status}</span></div>
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
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {adminNotices.map((notice) => (
                      <div key={notice.id} className="institutional-card" style={{ borderLeft: notice.isUrgent ? '4px solid var(--color-error)' : '4px solid var(--navy-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-primary)' }}>{notice.title}</h3>
                            {notice.isUrgent && (
                              <span className="badge-institutional" style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
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
                              style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '2px' }}
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Audit Logs</h2>
                  </div>
                  <button onClick={fetchAdminAuditLogs} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} /> <span>REFRESH</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(['q', 'actor', 'action', 'entity', 'from', 'to'] as const).map((field) => <input key={field} aria-label={`Audit ${field}`} type={field === 'from' || field === 'to' ? 'date' : 'search'} placeholder={field === 'q' ? 'Search details / target' : field[0].toUpperCase() + field.slice(1)} value={auditFilters[field]} onChange={(event) => { setAuditFilters((old) => ({ ...old, [field]: event.target.value })); setAuditPage(1); }} style={{ padding: '0.5rem', minWidth: 130 }} />)}
                </div>
                <div style={{ backgroundColor: 'var(--white-pure)', borderRadius: '4px', border: '1px solid var(--white-border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)' }}>
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
                            No audit logs yet.
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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 12 }}>
                  <button disabled={auditPage <= 1} onClick={() => setAuditPage((page) => Math.max(1, page - 1))}>Previous</button>
                  <span>Page {auditPage} of {auditTotalPages}</span>
                  <button disabled={auditPage >= auditTotalPages} onClick={() => setAuditPage((page) => Math.min(auditTotalPages, page + 1))}>Next</button>
                </div>
              </div>
            )}

            {/* ADMIN / ANO: INSTITUTIONAL LEAVE SANCTION COMMAND */}
            {role === 'ADMIN_ANO' && activeTab === 'leave' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                      Leave Requests
                    </h2>
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Awaiting ANO Sanction</span>
                      <Clock size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {leaveApplications.filter((l) => l.status === 'ANO_REVIEW').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Stage 3 pending final action</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>In Prior Tiers</span>
                      <FileText size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                      {leaveApplications.filter((l) => ['SUBMITTED', 'SENIOR_REVIEW', 'PLATOON_SENIOR_REVIEW', 'PENDING'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Under senior/platoon review</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Sanctioned & Approved</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {leaveApplications.filter((l) => l.status === 'APPROVED').length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Officially granted leaves</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Rejected / Returned</span>
                      <XCircle size={20} style={{ color: 'var(--color-error)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-error)' }}>
                      {leaveApplications.filter((l) => ['REJECTED', 'RETURNED'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Disallowed or revised</div>
                  </div>
                </div>

                {leaveApplications.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <CheckCircle size={36} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
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
                              isApproved ? 'var(--color-success)' :
                              isRejected ? 'var(--color-error)' :
                              isReturned ? 'var(--color-primary)' :
                              isCancelled ? 'var(--color-disabled)' : 'var(--color-accent)'
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
                                    backgroundColor: isApproved ? 'var(--color-success-soft)' : isRejected ? 'var(--color-error-soft)' : isReturned ? 'var(--color-warning-soft)' : 'var(--color-info-soft)',
                                    color: isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : isReturned ? 'var(--color-primary)' : 'var(--color-accent)',
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
                                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                                >
                                  Return
                                </button>
                                <button
                                  onClick={() => setLeaveRemarkModal({ leave, action: 'REJECT' })}
                                  className="btn-secondary btn-sm"
                                  style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <XCircle size={13} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Multi-tier Stage Progression Bar */}
                          <div style={{ background: 'var(--color-surface)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Multi-tier Workflow:</span>
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>1. Cadet Submission ✓</span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: ['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? 'var(--color-success)' : 'var(--color-primary)',
                              fontWeight: 600,
                            }}>
                              2. Senior Endorsement {['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? 'var(--color-success)' : leave.status === 'PLATOON_SENIOR_REVIEW' ? 'var(--color-primary)' : 'var(--color-disabled)',
                              fontWeight: 600,
                            }}>
                              3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: isApproved ? 'var(--color-success)' : isAnoPending ? 'var(--color-primary)' : 'var(--color-disabled)',
                              fontWeight: 600,
                            }}>
                              4. ANO Final Sanction {isApproved ? '✓' : ''}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', marginBottom: '0.5rem' }}>
                            <strong>Reason:</strong> {leave.reason}
                            {leave.remarks && (
                              <div style={{ marginTop: '0.25rem', color: 'var(--color-text)' }}>
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Certificates</h2>
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>'A' / 'B' / 'C' Exams</span>
                      <ShieldCheck size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {allCertificates.filter((c) => c.certificateType.includes('Certificate')).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Directorate certified</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Camp Commendations</span>
                      <Flag size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                      {allCertificates.filter((c) => c.certificateType.includes('Camp') || c.certificateType.includes('Commendation')).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Field camp certifications</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Cryptographic Hash</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.35rem' }}>SHA-256</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Integrity checks enabled</div>
                  </div>
                </div>

                {/* Certificates Table */}
                <div className="institutional-card" style={{ borderTop: '4px solid var(--navy-primary)' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', marginBottom: '1rem' }}>
                    Certificates
                  </h3>
                  {allCertificates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--navy-text-muted)' }}>
                      <Award size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                      <p>No certificates issued yet.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
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
                                    backgroundColor: cert.grade === 'A' ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                                    color: cert.grade === 'A' ? 'var(--color-success)' : 'var(--color-primary)',
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
                                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Senior Overview</h2>
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Pending Reviews</span>
                      <AlertTriangle size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{pendingReviews.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Applications awaiting action</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Leave Requests</span>
                      <FileText size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                      {leaveApplications.filter(l => ['SUBMITTED', 'SENIOR_REVIEW', 'PENDING'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Pending senior endorsement</div>
                  </div>
                </div>
              </div>
            )}


            {role === 'SENIOR' && activeTab === 'assigned' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>MY CADETS</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span className="badge-institutional" style={{ background: 'var(--color-info-soft)', color: 'var(--navy-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                        Total Cadets: {assignedCadets.length}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={fetchSeniorCadets}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH CADETS</span>
                  </button>
                </div>

                {assignedCadets.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4>No cadets are currently assigned to your squad.</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>Command / ANO will assign enrolled active cadets under your mentorship.</p>
                  </div>
                ) : (
                  <div className="grid-2">
                    {assignedCadets.map((c) => (
                      <div
                        key={c.id}
                        className="institutional-card"
                        style={{ borderLeft: '4px solid var(--navy-primary)', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                        onClick={() => setSelectedCadetForProfile(c)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--navy-primary)', margin: 0 }}>{c.fullName}</h4>
                          <span className="badge-institutional" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                            {c.status || 'ACTIVE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                          <div><strong>Regimental:</strong> {c.regimentalNumber}</div>
                          <div><strong>Roll:</strong> {c.collegeRollNumber}</div>
                          <div><strong>Branch:</strong> {c.branch} ({c.year})</div>
                          <div><strong>Platoon:</strong> {c.platoonName || 'Senior Division'}</div>
                          <div><strong>Team:</strong> {c.team || 'Team Alpha'}</div>
                          {c.email && <div><strong>Email:</strong> {c.email}</div>}
                        </div>
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={(e) => { e.stopPropagation(); setSelectedCadetForProfile(c); }}
                          >
                            <Eye size={12} />
                            <span>VIEW PROFILE</span>
                          </button>
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
                    <CheckCircle size={36} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
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
                              isApproved ? 'var(--color-success)' :
                              isRejected ? 'var(--color-error)' :
                              isReturned ? 'var(--color-primary)' : 'var(--color-accent)'
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
                                backgroundColor: isApproved ? 'var(--color-success-soft)' : isRejected ? 'var(--color-error-soft)' : isReturned ? 'var(--color-warning-soft)' : 'var(--color-info-soft)',
                                color: isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : isReturned ? 'var(--color-primary)' : 'var(--color-accent)',
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
                          <div style={{ background: 'var(--color-surface)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Workflow Stage:</span>
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>1. Cadet Applied ✓</span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: isForwarded ? 'var(--color-success)' : isPendingSenior ? 'var(--color-primary)' : 'var(--color-disabled)',
                              fontWeight: 600,
                            }}>
                              2. Senior Endorsement {isForwarded ? '✓' : ''}
                            </span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? 'var(--color-success)' : leave.status === 'PLATOON_SENIOR_REVIEW' ? 'var(--color-primary)' : 'var(--color-disabled)',
                              fontWeight: 600,
                            }}>
                              3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: isApproved ? 'var(--color-success)' : leave.status === 'ANO_REVIEW' ? 'var(--color-primary)' : 'var(--color-disabled)',
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
                                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                              >
                                Return
                              </button>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'REJECT' })}
                                className="btn-secondary btn-sm"
                                style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Average Turnout</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {attendanceSummaryList.length > 0
                        ? Math.round(attendanceSummaryList.reduce((acc, c) => acc + (c.stats?.percentage || 0), 0) / attendanceSummaryList.length)
                        : 0}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Squad parade turnout rate</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Exam Eligible</span>
                      <Shield size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                      {attendanceSummaryList.length > 0
                        ? `${attendanceSummaryList.filter((c) => (c.stats?.percentage || 0) >= 75).length} / ${attendanceSummaryList.length}`
                        : '0 / 0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Met &ge; 75% parade criterion</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Low Attendance Warning</span>
                      <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-error)' }}>
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
                            Present: <strong style={{ color: 'var(--color-success)' }}>{session.presentCount || 0}</strong> · Absent: <strong style={{ color: 'var(--color-error)' }}>{session.absentCount || 0}</strong>
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
                          <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
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
                                    backgroundColor: record.status === 'PRESENT' ? 'var(--color-success-soft)' : record.status === 'ABSENT' ? 'var(--color-error-soft)' : 'var(--color-warning-soft)',
                                    color: record.status === 'PRESENT' ? 'var(--color-success)' : record.status === 'ABSENT' ? 'var(--color-error)' : 'var(--color-primary)',
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
                                      backgroundColor: record.status === 'ABSENT' ? 'var(--color-error)' : 'var(--white-pure)',
                                      color: record.status === 'ABSENT' ? 'var(--white-pure)' : 'var(--color-error)',
                                      borderColor: 'var(--color-error)',
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
                                      backgroundColor: record.status === 'EXCUSED' ? 'var(--color-primary)' : 'var(--white-pure)',
                                      color: record.status === 'EXCUSED' ? 'var(--white-pure)' : 'var(--color-primary)',
                                      borderColor: 'var(--color-primary)',
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
                              No attendance records yet.
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
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-success)' }}>
                                {cadet.stats?.present || 0}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--white-surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--white-border)' }}>
                                    <div
                                      style={{
                                        width: `${cadet.stats?.percentage || 0}%`,
                                        height: '100%',
                                        backgroundColor: (cadet.stats?.percentage || 0) >= 75 ? 'var(--color-success)' : (cadet.stats?.percentage || 0) >= 60 ? 'var(--color-primary)' : 'var(--color-error)',
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
                                  <span className="badge-institutional" style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                                    ELIGIBLE
                                  </span>
                                ) : (
                                  <span className="badge-institutional" style={{ backgroundColor: 'var(--color-error-soft)', color: 'var(--color-error)' }}>
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Platoon Overview</h2>
                  </div>
                  <button onClick={() => { fetchPlatoonCadets(); fetchPendingReviews(); fetchLeaveApplications(); }} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RefreshCw size={14} /><span>REFRESH</span>
                  </button>
                </div>
                <div className="grid-3" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Unit Cadet Strength</span>
                      <Users size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{platoonCadets.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Active enrolled cadets</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Applications</span>
                      <AlertTriangle size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{pendingReviews.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Awaiting platoon review</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Leave Pending</span>
                      <FileText size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                      {leaveApplications.filter(l => ['PLATOON_SENIOR_REVIEW', 'SUBMITTED', 'SENIOR_REVIEW', 'PENDING'].includes(l.status)).length}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Platoon leave requests</div>
                  </div>
                </div>
              </div>
            )}


            {role === 'PLATOON_SENIOR' && activeTab === 'cadets' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>MY PLATOON CADETS</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span className="badge-institutional" style={{ background: 'var(--color-info-soft)', color: 'var(--navy-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                        Total Cadets: {platoonCadets.length}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)' }}>
                      </span>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--navy-primary)', fontSize: '0.85rem', fontWeight: 650 }}>
                    Status
                    <select
                      value={cadetStatusFilter}
                      onChange={(event) => {
                        const nextFilter = event.target.value;
                        setCadetStatusFilter(nextFilter);
                        fetchPlatoonCadets(nextFilter);
                      }}
                      aria-label="Filter cadets by status"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="PASSED_OUT">Passed Out</option>
                      <option value="ALL">All</option>
                    </select>
                  </label>
                  <button
                    onClick={() => fetchPlatoonCadets()}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH CADETS</span>
                  </button>
                </div>

                {platoonCadets.length === 0 ? (
                  <div className="institutional-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 1rem' }} />
                    <h4>{cadetStatusFilter === 'ACTIVE' ? 'No active cadets found in your platoon roster' : 'No cadets found for this status'}</h4>
                    <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.88rem' }}>
                      {cadetStatusFilter === 'ACTIVE'
                        ? 'Active cadets belonging to your authorized platoon will appear here.'
                        : 'Try another status filter to view cadets in your authorized platoon.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid-2">
                    {platoonCadets.map((c) => (
                      <div
                        key={c.id}
                        className="institutional-card"
                        style={{ borderLeft: '4px solid var(--navy-hover)', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                        onClick={() => setSelectedCadetForProfile(c)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--navy-primary)', margin: 0 }}>{c.fullName}</h4>
                          <span className="badge-institutional" style={{
                            background: c.status === 'ACTIVE' || c.status === 'APPROVED' ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                            color: c.status === 'ACTIVE' || c.status === 'APPROVED' ? 'var(--color-success)' : 'var(--color-primary)',
                          }}>
                            {c.status || 'ACTIVE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                          <div><strong>Regimental:</strong> {c.regimentalNumber}</div>
                          <div><strong>Roll:</strong> {c.collegeRollNumber}</div>
                          <div><strong>Branch:</strong> {c.branch} ({c.year})</div>
                          <div><strong>Platoon:</strong> {c.platoonName || 'Senior Division'}</div>
                          <div><strong>Team:</strong> {c.team || 'Team Alpha'}</div>
                          {c.email && <div><strong>Email:</strong> {c.email}</div>}
                          {c.statusDetails && (
                            <div style={{ marginTop: '0.35rem', color: 'var(--navy-text-muted)' }}>
                              <div><strong>Effective:</strong> {new Date(c.statusDetails.effectiveDate).toLocaleDateString()}</div>
                              <div><strong>Reason:</strong> {c.statusDetails.reason}</div>
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--white-border)', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={(e) => { e.stopPropagation(); setSelectedCadetForProfile(c); }}
                          >
                            <Eye size={12} />
                            <span>VIEW PROFILE</span>
                          </button>
                          {['ACTIVE', 'APPROVED'].includes(c.status) && (
                            <button
                              className="btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setCadetLifecycleTarget({ cadet: c, action: 'DEACTIVATE' });
                              }}
                            >
                              DEACTIVATE
                            </button>
                          )}
                          {['INACTIVE', 'PASSED_OUT'].includes(c.status) && (
                            <button
                              className="btn-primary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setCadetLifecycleTarget({ cadet: c, action: 'REACTIVATE' });
                              }}
                            >
                              REACTIVATE
                            </button>
                          )}
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
                    <CheckCircle size={36} style={{ color: 'var(--color-success)', margin: '0 auto 1rem' }} />
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
                              isApproved ? 'var(--color-success)' :
                              isRejected ? 'var(--color-error)' :
                              isReturned ? 'var(--color-primary)' : 'var(--color-accent)'
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
                                backgroundColor: isApproved ? 'var(--color-success-soft)' : isRejected ? 'var(--color-error-soft)' : isReturned ? 'var(--color-warning-soft)' : 'var(--color-info-soft)',
                                color: isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : isReturned ? 'var(--color-primary)' : 'var(--color-accent)',
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
                          <div style={{ background: 'var(--color-surface)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--color-border)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--navy-primary)' }}>Workflow Stage:</span>
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>1. Cadet Applied ✓</span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: ['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? 'var(--color-success)' : 'var(--color-primary)',
                              fontWeight: 600,
                            }}>
                              2. Senior Endorsement {['PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: ['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? 'var(--color-success)' : leave.status === 'PLATOON_SENIOR_REVIEW' ? 'var(--color-primary)' : 'var(--color-disabled)',
                              fontWeight: 600,
                            }}>
                              3. Platoon Senior Review {['ANO_REVIEW', 'APPROVED'].includes(leave.status) ? '✓' : ''}
                            </span>
                            <span style={{ color: 'var(--color-disabled)' }}>➔</span>
                            <span style={{
                              color: isApproved ? 'var(--color-success)' : isAnoPending ? 'var(--color-primary)' : 'var(--color-disabled)',
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
                                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                              >
                                Return
                              </button>
                              <button
                                onClick={() => setLeaveRemarkModal({ leave, action: 'REJECT' })}
                                className="btn-secondary btn-sm"
                                style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Average Turnout</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {attendanceSummaryList.length > 0
                        ? Math.round(attendanceSummaryList.reduce((acc, c) => acc + (c.stats?.percentage || 0), 0) / attendanceSummaryList.length)
                        : 0}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Platoon parade turnout rate</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Exam Eligible</span>
                      <Shield size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                      {attendanceSummaryList.length > 0
                        ? `${attendanceSummaryList.filter((c) => (c.stats?.percentage || 0) >= 75).length} / ${attendanceSummaryList.length}`
                        : '0 / 0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Met &ge; 75% parade criterion</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Low Attendance Warning</span>
                      <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-error)' }}>
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
                            Present: <strong style={{ color: 'var(--color-success)' }}>{session.presentCount || 0}</strong> · Absent: <strong style={{ color: 'var(--color-error)' }}>{session.absentCount || 0}</strong>
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
                          <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
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
                                    backgroundColor: record.status === 'PRESENT' ? 'var(--color-success-soft)' : record.status === 'ABSENT' ? 'var(--color-error-soft)' : 'var(--color-warning-soft)',
                                    color: record.status === 'PRESENT' ? 'var(--color-success)' : record.status === 'ABSENT' ? 'var(--color-error)' : 'var(--color-primary)',
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
                                      backgroundColor: record.status === 'ABSENT' ? 'var(--color-error)' : 'var(--white-pure)',
                                      color: record.status === 'ABSENT' ? 'var(--white-pure)' : 'var(--color-error)',
                                      borderColor: 'var(--color-error)',
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
                                      backgroundColor: record.status === 'EXCUSED' ? 'var(--color-primary)' : 'var(--white-pure)',
                                      color: record.status === 'EXCUSED' ? 'var(--white-pure)' : 'var(--color-primary)',
                                      borderColor: 'var(--color-primary)',
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
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-success)' }}>
                                {cadet.stats?.present || 0}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--white-surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--white-border)' }}>
                                    <div
                                      style={{
                                        width: `${cadet.stats?.percentage || 0}%`,
                                        height: '100%',
                                        backgroundColor: (cadet.stats?.percentage || 0) >= 75 ? 'var(--color-success)' : (cadet.stats?.percentage || 0) >= 60 ? 'var(--color-primary)' : 'var(--color-error)',
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
                                  <span className="badge-institutional" style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                                    ELIGIBLE
                                  </span>
                                ) : (
                                  <span className="badge-institutional" style={{ backgroundColor: 'var(--color-error-soft)', color: 'var(--color-error)' }}>
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
                      Manage leave, notices, and your profile.
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Approved</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>{myLeaves.filter(l => l.status === 'APPROVED').length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Sanctioned leaves</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Pending</span>
                      <Clock size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{myLeaves.filter(l => l.status === 'PENDING').length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Awaiting sanction</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Unit Notices</span>
                      <Bell size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent)' }}>{cadetNotices.length}</div>
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
                <div className="institutional-card" style={{ backgroundColor: user?.status === 'APPROVED' || user?.status === 'ACTIVE' ? 'var(--color-success-soft)' : 'var(--navy-badge-bg)', border: `1px solid ${user?.status === 'APPROVED' || user?.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--navy-badge-border)'}` }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Shield size={20} style={{ color: user?.status === 'APPROVED' || user?.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--navy-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>ACCOUNT STATUS: {user?.status}</div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.6' }}>
                        {user?.status === 'APPROVED' || user?.status === 'ACTIVE'
                          ? 'Your account is active.'
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
                      No leave requests yet.
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
                              isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : isCancelled ? 'var(--color-text-secondary)' : 'var(--color-primary)'
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
                                  backgroundColor: isApproved ? 'var(--color-success-soft)' : isRejected ? 'var(--color-error-soft)' : isCancelled ? 'var(--color-surface)' : 'var(--color-warning-soft)',
                                  color: isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : isCancelled ? 'var(--color-text-secondary)' : 'var(--color-primary)',
                                  borderColor: isApproved ? 'var(--color-success)' : isRejected ? 'var(--color-error)' : isCancelled ? 'var(--color-border)' : 'var(--color-gold)',
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
                                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-border)', fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
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
                      <div key={notice.id} className="institutional-card" style={{ borderLeft: `4px solid ${notice.isUrgent ? 'var(--color-error)' : 'var(--navy-primary)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                            {notice.isUrgent && <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--color-error)' }} />}
                            {notice.title}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {notice.isUrgent && <span className="badge-institutional" style={{ backgroundColor: 'var(--color-error-soft)', color: 'var(--color-error)' }}>URGENT</span>}
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>My Attendance</h2>
                  </div>
                  <button
                    onClick={() => fetchMyAttendance()}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={14} /> <span>REFRESH</span>
                  </button>
                </div>

                {/* 4 Attendance Overview Cards */}
                <div className="grid-4" style={{ marginBottom: '2rem' }}>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Overall Attendance</span>
                      <Shield size={20} style={{ color: 'var(--navy-primary)' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: myAttendanceData.stats.percentage >= 75 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {myAttendanceData.stats.percentage}%
                    </div>
                    <div style={{ marginTop: '0.5rem', height: '6px', backgroundColor: 'var(--white-surface)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--white-border)' }}>
                      <div
                        style={{
                          width: `${myAttendanceData.stats.percentage}%`,
                          height: '100%',
                          backgroundColor: myAttendanceData.stats.percentage >= 75 ? 'var(--color-success)' : 'var(--color-error)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Parades Attended</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                      {myAttendanceData.stats.present} / {myAttendanceData.stats.total}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Full physical presence verified</div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-error)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Absences Recorded</span>
                      <XCircle size={20} style={{ color: 'var(--color-error)' }} />
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-error)' }}>
                      {myAttendanceData.stats.absent}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>
                      {myAttendanceData.stats.excused > 0 ? `${myAttendanceData.stats.excused} sanctioned on leave` : 'Unsanctioned absences'}
                    </div>
                  </div>

                  <div className="institutional-card" style={{ borderLeft: `4px solid ${myAttendanceData.stats.percentage >= 75 ? 'var(--color-success)' : 'var(--color-error)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Exam Clearance</span>
                      <Award size={20} style={{ color: myAttendanceData.stats.percentage >= 75 ? 'var(--color-success)' : 'var(--color-error)' }} />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: myAttendanceData.stats.percentage >= 75 ? 'var(--color-success)' : 'var(--color-error)', marginTop: '0.25rem' }}>
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
                          <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', textAlign: 'left' }}>
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
                                    backgroundColor: record.status === 'PRESENT' ? 'var(--color-success-soft)' : record.status === 'ABSENT' ? 'var(--color-error-soft)' : 'var(--color-warning-soft)',
                                    color: record.status === 'PRESENT' ? 'var(--color-success)' : record.status === 'ABSENT' ? 'var(--color-error)' : 'var(--color-primary)',
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
                    <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)' }}>Certificates</h2>
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
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Highest Grade</span>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '0.35rem' }}>
                      {cadetCertificates.find((c) => c.grade === 'A') ? "GRADE 'A' (DISTINCTION)" : cadetCertificates.length > 0 ? "GRADE 'B'" : "NO RECORDS"}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Examination qualification grade</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Validity Status</span>
                      <ShieldCheck size={20} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent)', marginTop: '0.35rem' }}>
                      {cadetCertificates.length > 0 && cadetCertificates.every((c) => c.status === 'VALID') ? 'OFFICIALLY VALID' : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Directorial Directorate Record</div>
                  </div>
                  <div className="institutional-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Security Hash</span>
                      <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.35rem' }}>SHA-256 DIGEST</div>
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
                                backgroundColor: cert.grade === 'A' ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                                color: cert.grade === 'A' ? 'var(--color-success)' : 'var(--color-primary)',
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
                                backgroundColor: cert.status === 'VALID' ? 'var(--color-info-soft)' : 'var(--color-error-soft)',
                                color: cert.status === 'VALID' ? 'var(--color-accent)' : 'var(--color-error)',
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
                            <ShieldCheck size={14} style={{ color: 'var(--color-success)' }} />
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    VISIBILITY *
                  </label>
                  <select
                    value={eventForm.isPublic ? 'true' : 'false'}
                    onChange={(e) => setEventForm({ ...eventForm, isPublic: e.target.value === 'true' })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    <strong style={{ color: 'var(--color-error)' }}>Mark as URGENT Directive</strong>
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>TO DATE *</label>
                  <input type="date" required value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>REASON FOR LEAVE *</label>
                <textarea rows={3} required placeholder="State the specific reason for leave. For medical leave, mention doctor's advice..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
              border: `2px solid ${leaveRemarkModal.action === 'APPROVE' ? 'var(--color-success)' : leaveRemarkModal.action === 'REJECT' ? 'var(--color-error)' : 'var(--navy-primary)'}`,
              borderRadius: '6px',
              width: '100%', maxWidth: '480px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              backgroundColor: leaveRemarkModal.action === 'APPROVE' ? 'var(--color-success)' : leaveRemarkModal.action === 'REJECT' ? 'var(--color-error)' : 'var(--navy-primary)',
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button type="button" onClick={() => { setLeaveRemarkModal(null); setLeaveRemarks(''); }} className="btn-secondary btn-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handleLeaveAction}
                  className="btn-primary btn-sm"
                  style={{ backgroundColor: leaveRemarkModal.action === 'REJECT' ? 'var(--color-error)' : leaveRemarkModal.action === 'HOLD' ? 'var(--color-primary)' : undefined, borderColor: leaveRemarkModal.action === 'REJECT' ? 'var(--color-error)' : leaveRemarkModal.action === 'HOLD' ? 'var(--color-primary)' : undefined }}
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: 'var(--color-disabled)' }}>
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>TARGET MUSTER</label>
                  <select
                    value={attendanceForm.targetPlatoon}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, targetPlatoon: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    color: 'var(--color-background)',
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
            backgroundColor: 'rgba(7, 26, 51, 0.88)',
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
              backgroundColor: 'var(--color-background)',
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
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-primary)',
                border: '12px double var(--color-secondary)',
                margin: '1rem',
                position: 'relative',
              }}
            >
              {/* Inner Decorative Border */}
              <div style={{ border: '2px solid var(--color-secondary)', padding: '2rem 2.25rem', position: 'relative' }}>
                {/* Header Dual Crests */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <img
                    src="/assets/logos/ncc_logo.png"
                    alt="National Cadet Corps"
                    style={{ width: '68px', height: '80px', objectFit: 'contain' }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                      NATIONAL CADET CORPS (NCC)
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--color-secondary)', marginTop: '0.25rem' }}>
                      2 MAHARASHTRA BATTALION NCC, PUNE
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
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
                <div style={{ height: '3px', backgroundColor: 'var(--color-secondary)', margin: '1rem auto 1.5rem', width: '80%' }} />

                {/* Certificate Main Title */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    CERTIFICATE OF MERIT & QUALIFICATION
                  </div>
                  <h1 style={{ fontSize: '1.7rem', color: 'var(--color-primary)', fontFamily: 'var(--font-display)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {selectedCertificate.title}
                  </h1>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                    SERIAL NO: <strong>{selectedCertificate.certificateNo}</strong>
                  </div>
                </div>

                {/* Certificate Text Body */}
                <div style={{ fontSize: '0.95rem', lineHeight: '2', textAlign: 'justify', marginBottom: '2rem', color: 'var(--color-text)' }}>
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
                      backgroundColor: 'var(--color-surface)',
                      border: '2px solid var(--color-secondary)',
                      padding: '0.65rem 2.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginRight: '0.5rem' }}>
                      ASSESSMENT GRADE:
                    </span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-secondary)' }}>
                      GRADE '{selectedCertificate.grade}' (DISTINCTION)
                    </span>
                  </div>
                </div>

                {selectedCertificate.campName && (
                  <div style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                    Camp Credential: <strong>{selectedCertificate.campName}</strong>
                  </div>
                )}

                {selectedCertificate.remarks && (
                  <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: '2rem' }}>
                    "{selectedCertificate.remarks}"
                  </div>
                )}

                {/* Signatures & Seal Block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem', paddingTop: '1.5rem' }}>
                  {/* Left Signature */}
                  <div style={{ textAlign: 'center', minWidth: '180px' }}>
                    <div style={{ fontFamily: 'cursive', fontSize: '1.1rem', color: 'var(--color-secondary)', marginBottom: '0.25rem' }}>
                      R.K. Sharma
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--color-secondary)', width: '100%', marginBottom: '0.35rem' }} />
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)' }}>Lt. Col. R.K. Sharma</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Associate NCC Officer (ANO)</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>AIT NCC Detachment</div>
                  </div>

                  {/* Center Official Seal Stamp */}
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: '85px',
                        height: '85px',
                        border: '3px double var(--color-secondary)',
                        borderRadius: '50%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-secondary)',
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
                    <div style={{ fontFamily: 'cursive', fontSize: '1.1rem', color: 'var(--color-secondary)', marginBottom: '0.25rem' }}>
                      A.K. Deshmukh
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--color-secondary)', width: '100%', marginBottom: '0.35rem' }} />
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary)' }}>Col. A.K. Deshmukh</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Commanding Officer</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>2 Maharashtra Bn NCC, Pune</div>
                  </div>
                </div>

                {/* Cryptographic Verification Footer */}
                <div style={{ marginTop: '2rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    Date of Issue: <strong>{new Date(selectedCertificate.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={13} style={{ color: 'var(--color-success)' }} />
                    <span>Cryptographic Digest:</span>
                    <code style={{ fontSize: '0.68rem', backgroundColor: 'var(--color-surface)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
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
            backgroundColor: 'rgba(7, 26, 51, 0.75)',
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>CAMP CREDENTIAL / REFERENCE (OPTIONAL)</label>
                <input
                  type="text"
                  value={certificateForm.campName}
                  onChange={(e) => setCertificateForm({ ...certificateForm, campName: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>COMMENDATION & DRILL REMARKS</label>
                <textarea
                  rows={2}
                  value={certificateForm.remarks}
                  onChange={(e) => setCertificateForm({ ...certificateForm, remarks: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.88rem' }}
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
            backgroundColor: 'rgba(7, 26, 51, 0.88)',
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
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', fontSize: '0.85rem', fontFamily: 'monospace' }}
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
                    <div style={{ backgroundColor: 'var(--color-success-soft)', border: '2px solid var(--color-success)', borderRadius: '6px', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
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
                      <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--color-success)', borderTop: '1px solid var(--color-success-border)', paddingTop: '0.5rem', fontFamily: 'monospace' }}>
                        DIGITAL SEAL: {verifyResult.digitalSeal} · {verifyResult.verificationAuthority}
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'var(--color-error-soft)', border: '2px solid var(--color-error-border)', borderRadius: '6px', padding: '1rem', textAlign: 'center' }}>
                      <XCircle size={28} style={{ color: 'var(--color-error)', margin: '0 auto 0.5rem' }} />
                      <div style={{ color: 'var(--color-error)', fontWeight: 800, fontSize: '0.95rem' }}>
                        UNVERIFIED / RECORD NOT FOUND
                      </div>
                      <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
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
            backgroundColor: 'rgba(7, 26, 51, 0.85)',
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
                        <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--color-background)', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem 0.6rem' }}>IDENTIFIER</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>STATUS</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>REMARKS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceImportPreview.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--color-surface)' }}>
                            <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontWeight: 600 }}>{r.regimentalNumber}</td>
                            <td style={{ padding: '0.4rem 0.6rem' }}>
                              <span
                                className="badge-institutional"
                                style={{
                                  backgroundColor: r.status === 'PRESENT' ? 'var(--color-success-soft)' : r.status === 'EXCUSED' ? 'var(--color-info-soft)' : 'var(--color-error-soft)',
                                  color: r.status === 'PRESENT' ? 'var(--color-success)' : r.status === 'EXCUSED' ? 'var(--color-accent)' : 'var(--color-error)',
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
            backgroundColor: 'rgba(7, 26, 51, 0.85)',
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
                        <tr className="table-header-navy" style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--color-background)', textAlign: 'left' }}>
                          <th style={{ padding: '0.4rem 0.6rem' }}>NAME</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>REGIMENTAL NO</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>ROLL NO</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>BRANCH & YEAR</th>
                          <th style={{ padding: '0.4rem 0.6rem' }}>PLATOON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cadetImportPreview.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--color-surface)' }}>
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
      {cadetLifecycleTarget && (
        <CadetLifecycleDialog
          cadet={cadetLifecycleTarget.cadet}
          action={cadetLifecycleTarget.action}
          submitting={cadetLifecycleSubmitting}
          onClose={() => setCadetLifecycleTarget(null)}
          onSubmit={submitCadetLifecycle}
        />
      )}
      {rankTarget && (
        <RankPromotionDialog cadet={rankTarget} saving={rankSubmitting} onClose={() => setRankTarget(null)} onSubmit={submitCadetRank} />
      )}
      {/* VERIFIED CADET PROFILE MODAL (Phase 12) */}
      {selectedCadetForProfile && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(7, 26, 51, 0.85)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedCadetForProfile(null)}
        >
          <div
            className="institutional-modal-card"
            style={{
              maxWidth: '960px',
              width: '95%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              backgroundColor: 'var(--color-background)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                backgroundColor: 'var(--navy-primary)',
                color: 'var(--color-background)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Shield size={20} />
                <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.04em' }}>
                  CADET DOSSIER &amp; PROFILE RECORD
                </span>
              </div>
              <button
                onClick={() => setSelectedCadetForProfile(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-background)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }}>
              <CadetProfileView user={selectedCadetForProfile} token={token} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
