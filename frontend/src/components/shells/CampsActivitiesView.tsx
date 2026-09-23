import React, { useState, useEffect } from 'react';
import {
  Flag,
  MapPin,
  Users,
  Plus,
  AlertTriangle,
  ChevronRight,
  Search,
  X,
  RefreshCw,
  Send,
  Trash2,
  CheckCircle,
  Shield,
  Check,
} from 'lucide-react';

interface CampParticipant {
  id: string;
  campId: string;
  cadetId: string;
  status: 'APPLIED' | 'RECOMMENDED' | 'SELECTED' | 'CONFIRMED' | 'PARTICIPATED' | 'COMPLETED' | 'REJECTED';
  remarks?: string;
  appliedAt: string;
  cadet?: {
    id: string;
    fullName: string;
    regimentalNumber?: string;
    platoonName?: string;
  };
  user?: {
    id: string;
    name: string;
    regimentalNumber?: string;
  };
}

interface CampItem {
  id: string;
  name: string;
  campType: string;
  location: string;
  startDate: string;
  endDate: string;
  description?: string;
  eligibility?: string;
  instructions?: string;
  reportingTime?: string;
  requiredDocuments?: string;
  assignedOfficers?: string;
  capacity?: number;
  maxCadets?: number;
  status?: string;
  participants?: CampParticipant[];
  _count?: {
    participants: number;
  };
}

interface CampsActivitiesViewProps {
  userRole?: string;
}

export const CampsActivitiesView: React.FC<CampsActivitiesViewProps> = ({ userRole = 'CADET' }) => {
  const [camps, setCamps] = useState<CampItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<CampItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Cadet apply state
  const [applyRemarks, setApplyRemarks] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyTargetCamp, setApplyTargetCamp] = useState<CampItem | null>(null);

  // Admin create camp state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCamp, setNewCamp] = useState({
    name: '',
    campType: 'CATC',
    location: '',
    startDate: '',
    endDate: '',
    description: '',
    eligibility: '75% Drill attendance, B/C Certificate Cadet',
    instructions: 'Rigorous 10-day field craft, firing & night marching drills',
    reportingTime: '0600 hrs in proper uniform',
    requiredDocuments: 'Medical fitness certificate, College NOC, Indemnity bond',
    assignedOfficers: 'Lt. Col. Sanjeev Sharma (ANO), Subedar Major R. K. Singh (DI)',
    capacity: 50,
  });
  const [creating, setCreating] = useState(false);

  // Officer action state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetParticipant, setTargetParticipant] = useState<CampParticipant | null>(null);
  const [newStatus, setNewStatus] = useState<string>('RECOMMENDED');
  const [officerRemarks, setOfficerRemarks] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const isOfficer = ['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO'].includes(userRole);
  const isAdmin = userRole === 'ADMIN_ANO';

  const fetchCamps = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/camps', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load camp operations');
      }

      const data = await res.json();
      const loadedCamps: CampItem[] = Array.isArray(data) ? data : data.camps || [];
      setCamps(loadedCamps);

      // Refresh currently selected camp if open
      if (selectedCamp) {
        const updated = loadedCamps.find((c) => c.id === selectedCamp.id);
        if (updated) setSelectedCamp(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading camps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyTargetCamp) return;
    setApplying(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/camps/${applyTargetCamp.id}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remarks: applyRemarks }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit nomination');
      }

      alert(data.message || 'Nomination application submitted successfully!');
      setApplyModalOpen(false);
      setApplyRemarks('');
      fetchCamps();
    } catch (err: any) {
      alert(err.message || 'Error submitting application');
    } finally {
      setApplying(false);
    }
  };

  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/camps', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCamp),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create camp');
      }

      alert(data.message || 'Camp operation commissioned successfully!');
      setCreateModalOpen(false);
      setNewCamp({
        name: '',
        campType: 'CATC',
        location: '',
        startDate: '',
        endDate: '',
        description: '',
        eligibility: '75% Drill attendance, B/C Certificate Cadet',
        instructions: 'Rigorous 10-day field craft, firing & night marching drills',
        reportingTime: '0600 hrs in proper uniform',
        requiredDocuments: 'Medical fitness certificate, College NOC, Indemnity bond',
        assignedOfficers: 'Lt. Col. Sanjeev Sharma (ANO), Subedar Major R. K. Singh (DI)',
        capacity: 50,
      });
      fetchCamps();
    } catch (err: any) {
      alert(err.message || 'Error creating camp');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCamp = async (campId: string, _campName?: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/camps/${campId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete camp');
      }

      alert('Camp decommissioned successfully.');
      if (selectedCamp?.id === campId) {
        setSelectedCamp(null);
      }
      fetchCamps();
    } catch (err: any) {
      alert(err.message || 'Error deleting camp');
    }
  };

  const handleUpdateParticipantStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCamp || !targetParticipant) return;
    const cadetIdentifier = targetParticipant.cadetId || targetParticipant.cadet?.id || (targetParticipant as any).userId;
    if (!cadetIdentifier) {
      alert('Unable to identify cadet participant record.');
      return;
    }

    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/camps/${selectedCamp.id}/participants/${cadetIdentifier}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          remarks: officerRemarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to update status');
      }

      alert(`Participant status updated to ${newStatus} successfully.`);
      setStatusModalOpen(false);
      setOfficerRemarks('');
      fetchCamps();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'APPLIED':
        return { backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' };
      case 'RECOMMENDED':
        return { backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' };
      case 'SELECTED':
        return { backgroundColor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' };
      case 'CONFIRMED':
        return { backgroundColor: '#D1FAE5', color: '#047857', border: '1px solid #A7F3D0' };
      case 'PARTICIPATED':
        return { backgroundColor: '#CCFBF1', color: '#0F766E', border: '1px solid #99F6E4' };
      case 'COMPLETED':
        return { backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' };
      case 'REJECTED':
        return { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' };
      default:
        return { backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' };
    }
  };

  const filteredCamps = camps.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.campType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || c.campType.toUpperCase() === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalNominations = camps.reduce((sum, c) => sum + (c.participants?.length || 0), 0);
  const catcCamps = camps.filter((c) => c.campType === 'CATC').length;
  const nationalCamps = camps.filter((c) => ['NIC', 'RDC', 'TSC', 'BLC', 'AAC', 'EBSB'].includes(c.campType)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. INSTITUTIONAL COMMAND HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="badge-institutional" style={{ fontSize: '0.72rem', fontWeight: 800 }}>
              OFFICIAL BATTALION EXPEDITIONS & CAMPS
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
              CATC · NIC · RDC · TSC · BLC · AAC
            </span>
          </div>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--navy-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.35rem' }}>
            <Flag size={22} style={{ color: 'var(--navy-primary)' }} />
            <span>Camps & Institutional Activities Command</span>
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--navy-text-muted)', margin: 0, maxWidth: '750px' }}>
            Manage nationwide camp applications, multi-tier participant nominations, eligibility audits, and completion records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={15} /> <span>COMMISSION NEW CAMP</span>
            </button>
          )}
          <button
            onClick={fetchCamps}
            disabled={loading}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* 2. STAT CARDS */}
      <div className="grid-4">
        <div className="institutional-card" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Active Camps</span>
            <Flag size={20} style={{ color: 'var(--navy-primary)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy-primary)' }}>{camps.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Scheduled training cadres</div>
        </div>

        <div className="institutional-card" style={{ borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Cadet Nominations</span>
            <Users size={20} style={{ color: '#2563EB' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563EB' }}>{totalNominations}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>Applied & nominated cadets</div>
        </div>

        <div className="institutional-card" style={{ borderLeft: '4px solid #047857' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Annual Training</span>
            <CheckCircle size={20} style={{ color: '#047857' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>{catcCamps}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>CATC mandatory cadres</div>
        </div>

        <div className="institutional-card" style={{ borderLeft: '4px solid #D97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>National Expeditions</span>
            <Shield size={20} style={{ color: '#D97706' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D97706' }}>{nationalCamps}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', marginTop: '0.25rem' }}>NIC / RDC / TSC cadres</div>
        </div>
      </div>

      {/* 3. SEARCH & TYPE FILTER STRIP */}
      <div
        className="institutional-card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--navy-text-muted)' }} />
          <input
            type="text"
            placeholder="Search camps by name, type, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              borderRadius: '4px',
              border: '1px solid var(--white-border)',
              outline: 'none',
              fontSize: '0.85rem',
              color: 'var(--navy-primary)',
              backgroundColor: 'var(--white-surface)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy-text-muted)', marginRight: '0.25rem' }}>TYPE:</span>
          {['ALL', 'CATC', 'NIC', 'TSC', 'RDC', 'AAC'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '4px',
                border: typeFilter === type ? '1px solid var(--navy-primary)' : '1px solid var(--white-border)',
                backgroundColor: typeFilter === type ? 'var(--navy-primary)' : 'var(--white-pure)',
                color: typeFilter === type ? 'var(--white-pure)' : 'var(--navy-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {type}
            </button>
          ))}
          <span style={{ fontSize: '0.8rem', color: 'var(--navy-text-muted)', marginLeft: '0.5rem', fontWeight: 600 }}>
            ({filteredCamps.length} active)
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '4px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 4. CAMPS CONTENT LAYOUT */}
      {loading ? (
        <div className="institutional-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--navy-primary)' }} />
          <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.9rem' }}>Loading military camp rosters...</p>
        </div>
      ) : filteredCamps.length === 0 ? (
        <div className="institutional-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Flag size={36} style={{ color: 'var(--navy-border)', margin: '0 auto 0.75rem' }} />
          <h4 style={{ color: 'var(--navy-primary)', fontSize: '1.1rem', margin: '0 0 0.35rem' }}>No Camps Available</h4>
          <p style={{ color: 'var(--navy-text-muted)', fontSize: '0.85rem', margin: 0 }}>
            There are currently no active or planned camps matching your criteria.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedCamp ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Camp Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredCamps.map((camp) => {
              const start = new Date(camp.startDate);
              const end = new Date(camp.endDate);
              const isSelected = selectedCamp?.id === camp.id;
              const participantCount = camp.participants?.length || camp._count?.participants || 0;
              const campCapacity = camp.capacity || camp.maxCadets || 50;

              return (
                <div
                  key={camp.id}
                  className="institutional-card"
                  style={{
                    borderLeft: isSelected ? '5px solid var(--navy-primary)' : '4px solid var(--navy-border)',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    backgroundColor: isSelected ? 'var(--navy-badge-bg)' : 'var(--white-pure)',
                    padding: '1.25rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="badge-institutional" style={{ fontWeight: 800 }}>
                          {camp.campType}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={14} style={{ color: 'var(--navy-primary)' }} />
                          {camp.location}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.2rem', color: 'var(--navy-primary)', margin: 0 }}>
                        {camp.name}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteCamp(camp.id, camp.name)}
                          title="Decommission Camp"
                          style={{
                            background: '#FEE2E2',
                            border: '1px solid #FECACA',
                            color: '#DC2626',
                            borderRadius: '4px',
                            padding: '0.35rem 0.55rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedCamp(isSelected ? null : camp)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <span>{isSelected ? 'Close Details' : 'View Roster & Orders'}</span>
                        <ChevronRight size={14} style={{ transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
                      </button>
                      <button
                        onClick={() => {
                          setApplyTargetCamp(camp);
                          setApplyModalOpen(true);
                        }}
                        className="btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                      >
                        <Send size={13} />
                        <span>Apply</span>
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--navy-text-muted)', lineHeight: '1.5', margin: '0 0 1rem' }}>
                    {camp.description || 'Official institutional training cadre covering firing, obstacle course, tactical night navigation, and team discipline.'}
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--white-surface)',
                      borderRadius: '4px',
                      border: '1px solid var(--white-border)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Dates</span>
                      <strong style={{ color: 'var(--navy-primary)' }}>
                        {start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </strong>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Reporting</span>
                      <strong style={{ color: 'var(--navy-primary)' }}>{camp.reportingTime || '0600 hrs'}</strong>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Capacity</span>
                      <strong style={{ color: '#047857' }}>
                        {participantCount} / {campCapacity} Cadets
                      </strong>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy-text-muted)', textTransform: 'uppercase' }}>Officer In-Charge</span>
                      <strong style={{ color: 'var(--navy-primary)' }}>{camp.assignedOfficers || 'Assigned ANO / DI'}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Detail Pane when camp selected */}
          {selectedCamp && (
            <div
              className="institutional-card"
              style={{
                borderTop: '4px solid var(--navy-primary)',
                position: 'sticky',
                top: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxHeight: 'calc(100vh - 3rem)',
                overflowY: 'auto',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--white-border)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flag size={18} style={{ color: 'var(--navy-primary)' }} />
                  <h4 style={{ fontSize: '1rem', color: 'var(--navy-primary)', margin: 0 }}>Camp Standing Orders</h4>
                </div>
                <button
                  onClick={() => setSelectedCamp(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--navy-text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--navy-primary)', margin: '0 0 0.25rem' }}>{selectedCamp.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
                  {selectedCamp.campType} · {selectedCamp.location}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '4px', backgroundColor: 'var(--white-surface)', border: '1px solid var(--white-border)' }}>
                  <strong style={{ display: 'block', fontSize: '0.72rem', color: 'var(--navy-primary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Eligibility Criteria
                  </strong>
                  <p style={{ margin: 0, color: 'var(--navy-text)' }}>
                    {selectedCamp.eligibility || 'Open to all enrolled active cadets with clean drill record.'}
                  </p>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: '4px', backgroundColor: 'var(--white-surface)', border: '1px solid var(--white-border)' }}>
                  <strong style={{ display: 'block', fontSize: '0.72rem', color: '#B45309', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Required Documents & NOC
                  </strong>
                  <p style={{ margin: 0, color: 'var(--navy-text)' }}>
                    {selectedCamp.requiredDocuments || 'Indemnity bond, Medical fitness certificate, College NOC.'}
                  </p>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: '4px', backgroundColor: 'var(--white-surface)', border: '1px solid var(--white-border)' }}>
                  <strong style={{ display: 'block', fontSize: '0.72rem', color: 'var(--navy-primary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Turnout & Assembly Instructions
                  </strong>
                  <p style={{ margin: 0, color: 'var(--navy-text)' }}>
                    {selectedCamp.instructions || 'Standard combat kit, PT dress, DMS drill boots with ankle support.'}
                  </p>
                </div>
              </div>

              {/* Participant Roster Table */}
              <div style={{ borderTop: '1px solid var(--white-border)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h5 style={{ fontSize: '0.85rem', color: 'var(--navy-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={15} />
                    <span>Enrolled Cadets ({selectedCamp.participants?.length || 0})</span>
                  </h5>
                </div>

                {!selectedCamp.participants || selectedCamp.participants.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', fontStyle: 'italic', margin: 0 }}>
                    No cadets have registered nomination yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                    {selectedCamp.participants.map((p) => {
                      const cadetName = p.cadet?.fullName || p.user?.name || 'Cadet';
                      const cadetReg = p.cadet?.regimentalNumber || p.user?.regimentalNumber || 'N/A';
                      const badgeStyle = getStatusBadgeStyle(p.status);

                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '4px',
                            backgroundColor: 'var(--white-surface)',
                            border: '1px solid var(--white-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-primary)' }}>
                              {cadetName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)' }}>
                              {cadetReg} {p.cadet?.platoonName ? `· ${p.cadet.platoonName}` : ''}
                            </div>
                            {p.remarks && (
                              <div style={{ fontSize: '0.72rem', color: '#B45309', marginTop: '0.2rem' }}>
                                <em>"{p.remarks}"</em>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.5rem',
                                borderRadius: '3px',
                                ...badgeStyle,
                              }}
                            >
                              {p.status}
                            </span>

                            {isOfficer && (
                              <button
                                onClick={() => {
                                  setTargetParticipant(p);
                                  setNewStatus(p.status);
                                  setStatusModalOpen(true);
                                }}
                                className="btn-secondary btn-sm"
                                style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                              >
                                Update
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. CADET APPLY MODAL */}
      {applyModalOpen && applyTargetCamp && (
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
          onClick={() => setApplyModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)', margin: 0 }}>Apply for Camp Nomination</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>{applyTargetCamp.name}</p>
              </div>
              <button
                onClick={() => setApplyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleApply} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '4px', backgroundColor: 'var(--white-surface)', border: '1px solid var(--white-border)', fontSize: '0.82rem', lineHeight: '1.5' }}>
                <div><strong>Eligibility:</strong> {applyTargetCamp.eligibility || 'Active Enrolled Cadet'}</div>
                <div><strong>Reporting:</strong> {applyTargetCamp.reportingTime || '0600 hrs'}</div>
                <div><strong>Required Documents:</strong> {applyTargetCamp.requiredDocuments || 'Medical Fitness'}</div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Nomination Statement / Readiness *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State your drill turnout, physical endurance readiness, and commitment to represent the institution..."
                  value={applyRemarks}
                  onChange={(e) => setApplyRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    outline: 'none',
                    fontSize: '0.85rem',
                    color: 'var(--navy-primary)',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Send size={13} />
                  <span>{applying ? 'Submitting...' : 'Confirm Nomination Application'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. OFFICER PARTICIPANT STATUS MODAL */}
      {statusModalOpen && targetParticipant && selectedCamp && (
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
          onClick={() => setStatusModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--white-pure)',
              border: '2px solid var(--navy-primary)',
              borderRadius: '6px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)', margin: 0 }}>Review Camp Participant</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                  {targetParticipant.cadet?.fullName || targetParticipant.user?.name} ({targetParticipant.cadet?.regimentalNumber || targetParticipant.user?.regimentalNumber})
                </p>
              </div>
              <button
                onClick={() => setStatusModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateParticipantStatus} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Sanction Standing Status *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    outline: 'none',
                    fontSize: '0.88rem',
                    color: 'var(--navy-primary)',
                  }}
                >
                  <option value="RECOMMENDED">RECOMMENDED (Platoon Senior / Senior Nomination)</option>
                  <option value="SELECTED">SELECTED (Battalion Level Quota Allocation)</option>
                  <option value="CONFIRMED">CONFIRMED (Final Reporting Nominal Roll)</option>
                  <option value="PARTICIPATED">PARTICIPATED (In Physical Attendance on Ground)</option>
                  <option value="COMPLETED">COMPLETED (Honorably Completed / Camp Certificate Issued)</option>
                  <option value="REJECTED">REJECTED (Quota Exceeded or Ineligible)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Officer Remarks / Merit Evaluation
                </label>
                <textarea
                  rows={3}
                  placeholder="Turnout record, physical fitness evaluation, discipline notes..."
                  value={officerRemarks}
                  onChange={(e) => setOfficerRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--white-border)',
                    outline: 'none',
                    fontSize: '0.85rem',
                    color: 'var(--navy-primary)',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Check size={14} />
                  <span>{updatingStatus ? 'Updating...' : 'Sanction Participant Status'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ADMIN COMMISSION NEW CAMP MODAL */}
      {createModalOpen && (
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
          onClick={() => setCreateModalOpen(false)}
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
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ backgroundColor: 'var(--navy-primary)', color: 'var(--white-pure)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--white-pure)', margin: 0 }}>Commission New Camp Operation</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>Creates camp and syncs automatically to master calendar</p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCamp} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Camp Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Combined Annual Training Camp (CATC 2026)"
                  value={newCamp.name}
                  onChange={(e) => setNewCamp({ ...newCamp, name: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Camp Type *
                  </label>
                  <select
                    value={newCamp.campType}
                    onChange={(e) => setNewCamp({ ...newCamp, campType: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  >
                    <option value="CATC">CATC (Annual Training)</option>
                    <option value="NIC">NIC (National Integration)</option>
                    <option value="RDC">RDC (Republic Day Camp)</option>
                    <option value="TSC">TSC (Thal Sainik Camp)</option>
                    <option value="BLC">BLC (Basic Leadership)</option>
                    <option value="AAC">AAC (Army Attachment)</option>
                    <option value="EBSB">EBSB (Ek Bharat Shreshtha Bharat)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Location / Military Base *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., AIT Grounds & Barracks, Pune"
                    value={newCamp.location}
                    onChange={(e) => setNewCamp({ ...newCamp, location: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newCamp.startDate}
                    onChange={(e) => setNewCamp({ ...newCamp, startDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newCamp.endDate}
                    onChange={(e) => setNewCamp({ ...newCamp, endDate: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Reporting Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 0600 hrs Main Gate"
                    value={newCamp.reportingTime}
                    onChange={(e) => setNewCamp({ ...newCamp, reportingTime: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                    Max Cadet Capacity
                  </label>
                  <input
                    type="number"
                    value={newCamp.capacity}
                    onChange={(e) => setNewCamp({ ...newCamp, capacity: parseInt(e.target.value) || 50 })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Eligibility Specifications
                </label>
                <input
                  type="text"
                  value={newCamp.eligibility}
                  onChange={(e) => setNewCamp({ ...newCamp, eligibility: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Required Documents
                </label>
                <input
                  type="text"
                  value={newCamp.requiredDocuments}
                  onChange={(e) => setNewCamp({ ...newCamp, requiredDocuments: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  Assigned Officers In-Charge
                </label>
                <input
                  type="text"
                  value={newCamp.assignedOfficers}
                  onChange={(e) => setNewCamp({ ...newCamp, assignedOfficers: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--white-border)' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} />
                  <span>{creating ? 'Commissioning...' : 'Commission Camp Operation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampsActivitiesView;
