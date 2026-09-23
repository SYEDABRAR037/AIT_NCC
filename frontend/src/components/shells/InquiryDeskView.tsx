import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  Clock,
  AlertCircle,
  ArrowLeft,
  User,
  Shield,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface InquiryDeskViewProps {
  role?: string;
  token?: string | null;
}

export const InquiryDeskView: React.FC<InquiryDeskViewProps> = ({ role: propRole, token: propToken }) => {
  const { user, token: ctxToken } = useAuth();
  const token = propToken || ctxToken || localStorage.getItem('token');
  const role = propRole || user?.role || 'CADET';

  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('UNDER_REVIEW');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch inquiries list
  const fetchInquiries = async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await fetch(`/api/requests/inquiries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInquiries(data.inquiries || []);
        // Auto-select first item on wide screens if none selected
        if (!selectedInquiryId && data.inquiries && data.inquiries.length > 0 && window.innerWidth > 768) {
          setSelectedInquiryId(data.inquiries[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch inquiries error:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch single thread
  const fetchThread = async (id: string) => {
    if (!token || !id) return;
    setLoadingThread(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/requests/inquiry/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedThread(data.inquiry);
      }
    } catch (err) {
      console.error('Fetch thread error:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, [token, statusFilter]);

  // Refetch thread when selected ID changes
  useEffect(() => {
    if (selectedInquiryId) {
      fetchThread(selectedInquiryId);
    } else {
      setSelectedThread(null);
    }
  }, [selectedInquiryId]);

  // Send reply handler
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedInquiryId || !replyMessage.trim()) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      const res = await fetch(`/api/requests/inquiry/${selectedInquiryId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setReplyMessage('');
        // Refresh thread & list
        await fetchThread(selectedInquiryId);
        fetchInquiries();
      } else {
        setReplyError(data.message || 'Failed to submit reply');
      }
    } catch (err) {
      console.error('Submit reply error:', err);
      setReplyError('Network error while posting reply.');
    } finally {
      setSendingReply(false);
    }
  };

  // Update Status handler
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedInquiryId) return;

    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/requests/inquiry/${selectedInquiryId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          remarks: statusRemarks.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusModalOpen(false);
        setStatusRemarks('');
        await fetchThread(selectedInquiryId);
        fetchInquiries();
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Update status error:', err);
      alert('Error updating status on server');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return { label: 'SUBMITTED', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' };
      case 'UNDER_REVIEW':
        return { label: 'UNDER REVIEW', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' };
      case 'REPLIED':
        return { label: 'REPLIED', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
      case 'FORWARDED':
        return { label: 'FORWARDED', bg: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE' };
      case 'RESOLVED':
        return { label: 'RESOLVED', bg: '#F0FDF4', color: '#166534', border: '#86EFAC' };
      case 'CLOSED':
        return { label: 'CLOSED', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
      default:
        return { label: status, bg: '#F8FAFC', color: '#334155', border: '#E2E8F0' };
    }
  };

  const isOfficer = role === 'SENIOR' || role === 'PLATOON_SENIOR' || role === 'ADMIN_ANO';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--navy-border)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <MessageSquare size={22} style={{ color: 'var(--navy-primary)' }} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--navy-primary)', margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
              {role === 'CADET' ? 'MY OFFICIAL INQUIRIES' : 'OFFICIAL INQUIRIES & COMMUNICATIONS DESK'}
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
            {role === 'CADET'
              ? 'Authoritative communication ledger with assigned mentors and command officers.'
              : role === 'SENIOR'
              ? 'Cadet inquiries from your assigned squads. Review, reply, or forward to Platoon Senior.'
              : role === 'PLATOON_SENIOR'
              ? 'Cadet inquiries from your platoon contingent. Review, reply, or escalate to Admin/ANO.'
              : 'Institutional command inquiry ledger. Oversight across all platoons, response dispatch, and resolution.'}
          </p>
        </div>

        <button
          onClick={() => {
            fetchInquiries();
            if (selectedInquiryId) fetchThread(selectedInquiryId);
          }}
          className="btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} className={loadingList ? 'spin' : ''} />
          <span>REFRESH LEDGER</span>
        </button>
      </div>

      {/* Main Container: Two-Column Split Pane */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth <= 768 && selectedInquiryId ? '1fr' : '360px 1fr',
          gap: '1.25rem',
          minHeight: '620px',
          alignItems: 'start',
        }}
      >
        {/* LEFT PANE: Inquiries List (Hidden on mobile if inquiry is selected) */}
        {(!selectedInquiryId || window.innerWidth > 768) && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--navy-border)',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              maxHeight: '750px',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search by ID, name, reg no, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchInquiries()}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2rem',
                  fontSize: '0.82rem',
                  border: '1px solid var(--white-border)',
                  borderRadius: '4px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'REPLIED', 'RESOLVED', 'CLOSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: '3px',
                    border: '1px solid',
                    borderColor: statusFilter === st ? 'var(--navy-primary)' : 'var(--white-border)',
                    backgroundColor: statusFilter === st ? 'var(--navy-primary)' : '#F8FAFC',
                    color: statusFilter === st ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Inquiries List View */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              {loadingList && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748B', fontSize: '0.85rem' }}>
                  Loading inquiry ledger...
                </div>
              )}

              {!loadingList && inquiries.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                  <AlertCircle size={28} style={{ color: '#94A3B8', margin: '0 auto 0.5rem auto' }} />
                  <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                    NO OFFICIAL INQUIRIES
                  </strong>
                  <span style={{ fontSize: '0.78rem' }}>No cadet inquiries found in this view.</span>
                </div>
              )}

              {!loadingList &&
                inquiries.map((inq) => {
                  const badge = getStatusBadge(inq.status);
                  const isSelected = selectedInquiryId === inq.id;
                  const replyCount = inq._count?.replies || 0;

                  return (
                    <div
                      key={inq.id}
                      onClick={() => setSelectedInquiryId(inq.id)}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '6px',
                        border: isSelected ? '2px solid var(--navy-primary)' : '1px solid var(--white-border)',
                        backgroundColor: isSelected ? '#F0F9FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.75rem', color: 'var(--navy-primary)' }}>
                          {inq.requestNumber}
                        </span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '3px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', lineHeight: '1.3' }}>
                        {inq.title}
                      </div>

                      {role !== 'CADET' && inq.cadet && (
                        <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User size={12} style={{ color: 'var(--navy-hover)' }} />
                          <span>{inq.cadet.fullName}</span>
                          <span style={{ color: '#94A3B8' }}>&bull; {inq.cadet.regimentalNumber}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem' }}>
                        <span>{new Date(inq.createdAt).toLocaleDateString()}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: replyCount > 0 ? '#047857' : '#94A3B8', fontWeight: 600 }}>
                          <MessageSquare size={11} />
                          {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* RIGHT PANE: Selected Thread Conversation View */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--navy-border)',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minHeight: '620px',
          }}
        >
          {/* Mobile Back Button */}
          {selectedInquiryId && window.innerWidth <= 768 && (
            <button
              onClick={() => setSelectedInquiryId(null)}
              className="btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Inquiries</span>
            </button>
          )}

          {!selectedInquiryId && (
            <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#64748B' }}>
              <MessageSquare size={36} style={{ color: '#CBD5E1', margin: '0 auto 1rem auto' }} />
              <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                SELECT AN OFFICIAL INQUIRY
              </strong>
              <p style={{ fontSize: '0.85rem', maxWidth: '380px', margin: '0 auto' }}>
                Choose an inquiry from the ledger to view the complete communications thread, cadet credentials, and officer responses.
              </p>
            </div>
          )}

          {loadingThread && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748B' }}>
              Loading conversation thread...
            </div>
          )}

          {!loadingThread && selectedThread && (
            <>
              {/* Thread Header Strip */}
              <div
                style={{
                  borderBottom: '1px solid var(--navy-border)',
                  paddingBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy-primary)', backgroundColor: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {selectedThread.requestNumber}
                    </span>
                    {(() => {
                      const badge = getStatusBadge(selectedThread.status);
                      return (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--navy-primary)', margin: '0 0 0.4rem 0', fontWeight: 700 }}>
                    {selectedThread.title}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>
                      <strong>Cadet:</strong> {selectedThread.cadet?.fullName || 'Cadet'} ({selectedThread.cadet?.regimentalNumber || 'N/A'})
                    </span>
                    <span>
                      <strong>Platoon:</strong> {selectedThread.cadet?.platoonName || 'Alpha'}
                    </span>
                    <span>
                      <strong>Logged:</strong> {new Date(selectedThread.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Officer Status Management Controls */}
                {isOfficer && (
                  <button
                    onClick={() => {
                      setNewStatus(selectedThread.status);
                      setStatusModalOpen(true);
                    }}
                    className="btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Shield size={14} />
                    <span>UPDATE STATUS / ESCALATE</span>
                  </button>
                )}
              </div>

              {/* Conversation Messages Stream */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  overflowY: 'auto',
                  maxHeight: '480px',
                  paddingRight: '0.35rem',
                }}
              >
                {/* 1. Original Cadet Inquiry Message */}
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderLeft: '4px solid var(--navy-primary)',
                    borderRadius: '6px',
                    padding: '1rem 1.15rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--navy-primary)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        CDT
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--navy-primary)', display: 'block' }}>
                          {selectedThread.cadet?.fullName}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {selectedThread.cadet?.regimentalNumber} &bull; {selectedThread.cadet?.email}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} />
                      {new Date(selectedThread.createdAt).toLocaleDateString()} {new Date(selectedThread.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: '#1E293B', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {selectedThread.description}
                  </div>
                </div>

                {/* 2. Chronological Replies Stream */}
                {selectedThread.replies &&
                  selectedThread.replies.map((rep: any) => {
                    const isSenderCadet = rep.senderRole === 'CADET';

                    return (
                      <div
                        key={rep.id}
                        style={{
                          backgroundColor: isSenderCadet ? '#F8FAFC' : '#F0FDF4',
                          borderLeft: isSenderCadet ? '4px solid #94A3B8' : '4px solid #10B981',
                          borderRadius: '6px',
                          padding: '1rem 1.15rem',
                          marginLeft: isSenderCadet ? '0' : '1.5rem',
                          border: isSenderCadet ? '1px solid #E2E8F0' : '1px solid #BBF7D0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: isSenderCadet ? '#E2E8F0' : 'var(--navy-primary)',
                                color: isSenderCadet ? '#334155' : '#FFFFFF',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                              }}
                            >
                              {rep.senderRole.replace('_', ' ')}
                            </div>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--navy-primary)' }}>
                              {rep.senderName || rep.sender?.fullName || 'Officer'}
                            </strong>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={12} />
                            {new Date(rep.createdAt).toLocaleDateString()} {new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.9rem', color: '#1E293B', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                          {rep.message}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Reply Box / Action Desk */}
              {selectedThread.status !== 'CLOSED' ? (
                <form onSubmit={handleSendReply} style={{ marginTop: 'auto', borderTop: '1px solid var(--white-border)', paddingTop: '1rem' }}>
                  {replyError && (
                    <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '0.5rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      {replyError}
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    <textarea
                      rows={3}
                      required
                      placeholder={
                        isOfficer
                          ? 'Write official response to cadet (saved permanently to command ledger)...'
                          : 'Write follow-up message to officer...'
                      }
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      maxLength={5000}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid var(--navy-border)',
                        outline: 'none',
                        fontSize: '0.88rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      {replyMessage.length}/5000 characters &bull; Dispatches in-app notification
                    </span>

                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="btn-primary btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        opacity: sendingReply || !replyMessage.trim() ? 0.6 : 1,
                        cursor: sendingReply || !replyMessage.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Send size={13} />
                      <span>{sendingReply ? 'POSTING REPLY...' : isOfficer ? 'SEND OFFICIAL REPLY' : 'SEND FOLLOW-UP'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '4px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    color: '#475569',
                    fontSize: '0.82rem',
                    marginTop: 'auto',
                  }}
                >
                  <Lock size={16} />
                  <span>This official inquiry thread is marked as <strong>CLOSED</strong>. Communication history is preserved for audit.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Officer Status Management Modal */}
      {statusModalOpen && selectedThread && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} style={{ color: 'var(--navy-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--navy-primary)' }}>Update Inquiry Status</h3>
              </div>
              <button
                onClick={() => setStatusModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  NEW STATUS
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                >
                  <option value="UNDER_REVIEW">UNDER REVIEW (In Progress)</option>
                  <option value="REPLIED">REPLIED (Awaiting Cadet Action)</option>
                  {role === 'SENIOR' && <option value="FORWARDED">FORWARD TO PLATOON SENIOR</option>}
                  {role === 'PLATOON_SENIOR' && <option value="FORWARDED">FORWARD TO ADMIN / ANO</option>}
                  <option value="RESOLVED">RESOLVED (Satisfactorily Addressed)</option>
                  <option value="CLOSED">CLOSED (Archived Ledger)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                  DECISION REMARKS / REASON
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter administrative reason or routing instructions..."
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
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
                >
                  {updatingStatus ? 'UPDATING...' : 'CONFIRM STATUS UPDATE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
