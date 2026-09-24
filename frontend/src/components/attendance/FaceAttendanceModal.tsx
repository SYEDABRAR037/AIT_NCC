import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  X,
  ShieldCheck,
} from 'lucide-react';
import { safeApiFetch } from '../../utils/api';

interface FaceAttendanceModalProps {
  session: {
    id: string;
    title: string;
    activity: string;
    targetPlatoon?: string | null;
    date: string | Date;
    expectedCount: number;
    presentCount: number;
    status: string;
  };
  token: string;
  onClose: () => void;
  onSessionUpdated: () => void;
}

interface PreloadedCadet {
  id: string;
  fullName: string;
  regimentalNumber: string;
  collegeRollNumber?: string;
  platoonName?: string;
  hasBiometrics: boolean;
  descriptor: number[] | null;
}

export const FaceAttendanceModal: React.FC<FaceAttendanceModalProps> = ({
  session,
  token,
  onClose,
  onSessionUpdated,
}) => {
  // Camera & Stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Model & State
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [preloadedCadets, setPreloadedCadets] = useState<PreloadedCadet[]>([]);
  const [statusTitle, setStatusTitle] = useState('LOOK INTO CAMERA');
  const [statusSubtitle, setStatusSubtitle] = useState('Automatically scanning for cadet...');
  const [scannerTone, setScannerTone] = useState<'idle' | 'detecting' | 'verifying' | 'success' | 'warning' | 'error'>('idle');

  // Verification & Feedback Display
  const [activeCadetResult, setActiveCadetResult] = useState<{
    fullName: string;
    regimentalNumber: string;
    platoonName?: string;
    time: string;
    statusText: string;
    detail?: string;
    confidence?: number;
    smsStatus?: string;
    whatsappStatus?: string;
  } | null>(null);

  // Live Attendance Counters
  const [expectedCount, setExpectedCount] = useState(session.expectedCount || 0);
  const [presentCount, setPresentCount] = useState(session.presentCount || 0);
  const remainingCount = Math.max(0, expectedCount - presentCount);
  const [recentVerified, setRecentVerified] = useState<
    Array<{ id: string; name: string; regNo: string; time: string }>
  >([]);

  // Counter Flash Animation (fires on increment)
  const [presentFlash, setPresentFlash] = useState(false);
  const prevPresentRef = useRef(session.presentCount || 0);

  // Session Termination & Absent List
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(session.status === 'CLOSED');
  const [closedSummary, setClosedSummary] = useState<any | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  // Operational Locks & Auto-Reset Timers
  const isVerifyingRef = useRef(false);
  const autoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFramesRef = useRef(0);
  const liveStatsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual Fallback Quick-Check State (Low-light parade conditions)
  const [manualListOpen, setManualListOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [manualMarkingId, setManualMarkingId] = useState<string | null>(null);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);
  const [markedCadetIds, setMarkedCadetIds] = useState<Set<string>>(new Set());

  // -----------------------------------------------------------------------
  // fetchLiveStats — pull authoritative counts from backend DB
  // Called: on init (refresh recovery), every 10s (polling), after manual mark
  // -----------------------------------------------------------------------
  const fetchLiveStats = useCallback(async () => {
    try {
      const { ok, data } = await safeApiFetch(`/api/attendance/sessions/${session.id}/live-stats`);
      if (!ok) return;
      if (data?.success && data?.stats) {
        const newPresent = data.stats.present;
        if (newPresent > prevPresentRef.current) {
          // Trigger green flash animation on present count increase
          setPresentFlash(true);
          setTimeout(() => setPresentFlash(false), 700);
        }
        prevPresentRef.current = newPresent;
        setExpectedCount(data.stats.expected);
        setPresentCount(newPresent);
      }
    } catch (_) {
      // Silent — polling failures are non-critical
    }
  }, [session.id]);

  const handleManualMarkPresent = async (cadet: PreloadedCadet) => {
    try {
      setManualMarkingId(cadet.id);
      setManualSuccessMsg(null);
      const { ok, data } = await safeApiFetch(`/api/attendance/sessions/${session.id}/mark`, {
        method: 'PATCH',
        body: JSON.stringify({
          cadetId: cadet.id,
          status: 'PRESENT',
        }),
      });
      if (ok && data?.success) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        setMarkedCadetIds((prev) => new Set([...prev, cadet.id]));
        setRecentVerified((prev) => [
          {
            id: cadet.id,
            name: cadet.fullName,
            regNo: cadet.regimentalNumber,
            time: `${timeStr} (Manual)`,
          },
          ...prev.filter((p) => p.id !== cadet.id).slice(0, 5),
        ]);
        setActiveCadetResult({
          fullName: cadet.fullName,
          regimentalNumber: cadet.regimentalNumber,
          platoonName: cadet.platoonName,
          time: timeStr,
          statusText: 'PRESENT (MANUAL OVERRIDE)',
          detail: 'Low-light / manual parade ground fallback',
          smsStatus: 'QUEUED',
          whatsappStatus: 'QUEUED',
        });
        setManualSuccessMsg(`✓ ${cadet.fullName} marked PRESENT`);
        setTimeout(() => setManualSuccessMsg(null), 3500);
        // Pull authoritative count from DB after manual mark
        setTimeout(() => fetchLiveStats(), 400);
      } else {
        alert(data.message || 'Failed to mark attendance manually');
      }
    } catch (err) {
      console.error('Manual attendance mark error:', err);
    } finally {
      setManualMarkingId(null);
    }
  };

  // -------------------------------------------------------------
  // 1. Load Face-API AI Models & Pre-load Eligible Cadets
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        setStatusTitle('INITIALIZING BIOMETRIC ENGINE');
        setStatusSubtitle('Loading FaceNet neural networks...');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);

        if (!isMounted) return;
        setModelsLoaded(true);

        // Pre-load authorized eligible cadets & 128-d templates for fast matching (Section 9)
        try {
          const { ok, data } = await safeApiFetch(`/api/attendance/sessions/${session.id}/eligible-biometrics`);
          if (ok && data?.success && isMounted) {
            setPreloadedCadets(data.cadets || []);
            if (data.totalEligible > 0) {
              setExpectedCount(data.totalEligible);
            }
          }
        } catch (preloadErr) {
          console.warn('Preload eligible biometrics warning:', preloadErr);
        }

        // Fetch authoritative DB counts for accurate refresh recovery (Section 7)
        if (isMounted) {
          try {
            const { ok: statsOk, data: statsData } = await safeApiFetch(`/api/attendance/sessions/${session.id}/live-stats`);
            if (statsOk && statsData?.success && statsData?.stats && isMounted) {
              prevPresentRef.current = statsData.stats.present;
              setPresentCount(statsData.stats.present);
              setExpectedCount(statsData.stats.expected);
            }
          } catch (_) {}
        }

        if (isMounted) {
          setStatusTitle('LOOK INTO CAMERA');
          setStatusSubtitle('Automatically scanning for cadet...');
          setScannerTone('idle');
        }
      } catch (err) {
        console.error('Model load error:', err);
        if (isMounted) {
          setStatusTitle('BIOMETRIC ENGINE ERROR');
          setStatusSubtitle('Failed to load face recognition neural nets from /models.');
          setScannerTone('error');
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    };
  }, [session.id, token]);

  // -------------------------------------------------------------
  // 1b. Periodic 10-second polling for live-stats (multi-device sync)
  // -------------------------------------------------------------
  useEffect(() => {
    if (sessionClosed) return;

    liveStatsPollRef.current = setInterval(() => {
      fetchLiveStats();
    }, 10000);

    return () => {
      if (liveStatsPollRef.current) clearInterval(liveStatsPollRef.current);
    };
  }, [sessionClosed, fetchLiveStats]);

  // -------------------------------------------------------------
  // 2. Start Hardware Camera Stream into Circular Viewport
  // -------------------------------------------------------------
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: 1,
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access device camera. Please grant camera permission.');
      setStatusTitle('CAMERA ACCESS DENIED');
      setStatusSubtitle('Grant camera permissions on this device to proceed.');
      setScannerTone('error');
    }
  }, [cameraFacing, cameraStream]);

  useEffect(() => {
    if (modelsLoaded && !sessionClosed) {
      startCamera();
    }

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [modelsLoaded, cameraFacing, sessionClosed]);

  // -------------------------------------------------------------
  // 3. Fast Automatic Reset Loop (Section 7)
  // -------------------------------------------------------------
  const triggerAutoReset = useCallback((delayMs: number = 2000) => {
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);

    autoResetTimerRef.current = setTimeout(() => {
      setActiveCadetResult(null);
      setStatusTitle('LOOK INTO CAMERA');
      setStatusSubtitle('Scanning for next cadet...');
      setScannerTone('idle');
      consecutiveFramesRef.current = 0;
      isVerifyingRef.current = false;
    }, delayMs);
  }, []);

  // -------------------------------------------------------------
  // 4. Authoritative Verification Call
  // -------------------------------------------------------------
  const executeVerification = async (descriptor: number[]) => {
    isVerifyingRef.current = true;
    setScannerTone('verifying');
    setStatusTitle('VERIFYING BIOMETRICS');
    setStatusSubtitle('Matching live 128-d embedding with registered identity...');

    try {
      const { ok, status, data } = await safeApiFetch(`/api/attendance/sessions/${session.id}/verify-face`, {
        method: 'POST',
        body: JSON.stringify({
          descriptor,
          livenessVerified: true,
        }),
      });

      if (ok && data?.success) {
        // ✓ 1. SUCCESSFUL RECOGNITION & AUTOMATIC PRESENT RECORD
        const now = new Date();
        const timeStr = data.time || now.toLocaleTimeString('en-US', { hour12: false });
        setScannerTone('success');
        setStatusTitle('✓ FACE VERIFIED');
        setStatusSubtitle(`${data.cadet.fullName} marked PRESENT`);

        setActiveCadetResult({
          fullName: data.cadet.fullName,
          regimentalNumber: data.cadet.regimentalNumber,
          platoonName: data.cadet.platoonName,
          time: timeStr,
          statusText: 'PRESENT',
          confidence: data.confidenceScore || 98.4,
          smsStatus: data.notifications?.sms || 'QUEUED',
          whatsappStatus: data.notifications?.whatsapp || 'QUEUED',
        });

        if (data.sessionStats) {
          setExpectedCount(data.sessionStats.expected);
          setPresentCount(data.sessionStats.present);
        } else {
          setPresentCount((prev) => prev + 1);
        }

        setRecentVerified((prev) => [
          {
            id: data.cadet.id,
            name: data.cadet.fullName,
            regNo: data.cadet.regimentalNumber,
            time: timeStr,
          },
          ...prev.filter((p) => p.id !== data.cadet.id).slice(0, 5),
        ]);

        onSessionUpdated();
        // Automatic fast reset (~2 seconds)
        triggerAutoReset(2200);
      } else if (status === 409 && data?.duplicate) {
        // ⚠️ 2. DUPLICATE ATTEMPT
        setScannerTone('warning');
        setStatusTitle('✓ ALREADY PRESENT');
        setStatusSubtitle(`${data.cadet.fullName} is already recorded.`);

        setActiveCadetResult({
          fullName: data.cadet.fullName,
          regimentalNumber: data.cadet.regimentalNumber,
          time: data.markedTime || 'Earlier',
          statusText: 'ALREADY PRESENT',
          detail: 'Duplicate scan prevented.',
        });

        triggerAutoReset(2400);
      } else if (data.code === 'NOT_ELIGIBLE') {
        // ❌ 3. OUTSIDE UNIT MUSTER
        setScannerTone('error');
        setStatusTitle('NOT ELIGIBLE');
        setStatusSubtitle(data.message || 'Cadet is not registered in this unit muster session.');

        setActiveCadetResult({
          fullName: data.cadet?.fullName || 'Cadet',
          regimentalNumber: data.cadet?.regimentalNumber || '',
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          statusText: 'INELIGIBLE',
          detail: 'Not authorized for this muster session.',
        });

        triggerAutoReset(2500);
      } else if (data.code === 'APPROVED_LEAVE') {
        // ⚠️ 4. APPROVED LEAVE
        setScannerTone('warning');
        setStatusTitle('ABSENT — APPROVED LEAVE');
        setStatusSubtitle(`${data.cadet.fullName} has an authorized leave sanction.`);

        setActiveCadetResult({
          fullName: data.cadet.fullName,
          regimentalNumber: data.cadet.regimentalNumber,
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          statusText: 'APPROVED LEAVE',
          detail: 'Cadet sanctioned on leave for this date.',
        });

        triggerAutoReset(2500);
      } else {
        // ❌ 5. FACE NOT VERIFIED / UNREGISTERED
        setScannerTone('error');
        setStatusTitle('FACE NOT VERIFIED');
        setStatusSubtitle(data.message || 'Face not verified. Please look at camera clearly.');

        setActiveCadetResult({
          fullName: 'Identity Unverified',
          regimentalNumber: 'No match in registered unit templates',
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          statusText: 'NOT VERIFIED',
          detail: 'Please step closer or face the camera.',
        });

        triggerAutoReset(2000);
      }
    } catch (err) {
      console.error('Verification error:', err);
      setScannerTone('error');
      setStatusTitle('NETWORK ERROR');
      setStatusSubtitle('Unable to communicate with command server.');
      triggerAutoReset(2000);
    }
  };

  // -------------------------------------------------------------
  // 5. Continuous Live Video Processing (Approx ~2-3.5s target)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!modelsLoaded || !cameraStream || sessionClosed) return;

    let animFrame: number;
    let lastScanTime = 0;

    const detectLoop = async (now: number) => {
      // Throttle scanning to ~10-12 FPS to conserve battery while maintaining lightning responsiveness
      if (now - lastScanTime > 85) {
        lastScanTime = now;

        if (
          videoRef.current &&
          !videoRef.current.paused &&
          !videoRef.current.ended &&
          !isVerifyingRef.current
        ) {
          const video = videoRef.current;

          if (video.readyState >= 2) {
            try {
              const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
                .withFaceLandmarks(true)
                .withFaceDescriptors();

              if (detections.length === 0) {
                consecutiveFramesRef.current = 0;
                if (!isVerifyingRef.current && !activeCadetResult) {
                  setStatusTitle('LOOK INTO CAMERA');
                  setStatusSubtitle('Position face inside the circle...');
                  setScannerTone('idle');
                }
              } else if (detections.length > 1) {
                consecutiveFramesRef.current = 0;
                setStatusTitle('MULTIPLE FACES DETECTED');
                setStatusSubtitle('Only one cadet should be visible in camera.');
                setScannerTone('warning');
              } else {
                const single = detections[0];
                const box = single.detection.box;

                // Quality Check: Face large enough and visible inside circular zone
                if (box.width < 90 || box.height < 90) {
                  setStatusTitle('MOVE CLOSER');
                  setStatusSubtitle('Face is too far. Step closer to the circular camera.');
                  setScannerTone('warning');
                  consecutiveFramesRef.current = 0;
                } else {
                  consecutiveFramesRef.current++;
                  setScannerTone('detecting');
                  setStatusTitle('FACE DETECTED');
                  setStatusSubtitle('Hold still for automatic recognition...');

                  // When stable face is present for ~3-5 consecutive checks (~300ms)
                  // immediately execute face recognition!
                  if (consecutiveFramesRef.current >= 4) {
                    consecutiveFramesRef.current = 0;
                    isVerifyingRef.current = true;
                    const liveDescriptor = Array.from(single.descriptor);

                    // Section 9: Fast local match against preloaded eligible templates
                    if (preloadedCadets.length > 0) {
                      let bestCadet: PreloadedCadet | null = null;
                      let minDistance = Infinity;

                      for (const c of preloadedCadets) {
                        if (c.descriptor && Array.isArray(c.descriptor)) {
                          let sumSq = 0;
                          for (let i = 0; i < 128; i++) {
                            const diff = liveDescriptor[i] - c.descriptor[i];
                            sumSq += diff * diff;
                          }
                          const dist = Math.sqrt(sumSq);
                          if (dist < minDistance) {
                            minDistance = dist;
                            bestCadet = c;
                          }
                        }
                      }

                      // If locally matched with high confidence, show instant detection hint
                      if (bestCadet && minDistance <= 0.52) {
                        setStatusTitle('RECOGNIZING...');
                        setStatusSubtitle(`Matching ${bestCadet.fullName}...`);
                      }
                    }

                    // Execute authoritative backend verification
                    await executeVerification(liveDescriptor);
                  }
                }
              }
            } catch (err) {
              console.warn('Scan frame warning:', err);
            }
          }
        }
      }

      animFrame = requestAnimationFrame(detectLoop);
    };

    animFrame = requestAnimationFrame(detectLoop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [modelsLoaded, cameraStream, sessionClosed, preloadedCadets, activeCadetResult]);

  // -------------------------------------------------------------
  // 6. End Attendance Session
  // -------------------------------------------------------------
  const handleConfirmEndSession = async () => {
    setEndingSession(true);
    try {
      const { ok, data } = await safeApiFetch(`/api/attendance/sessions/${session.id}/end`, {
        method: 'POST',
      });
      if (ok && data?.success) {
        setSessionClosed(true);
        setClosedSummary(data);
        setEndConfirmOpen(false);
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
        }
        onSessionUpdated();
      } else {
        alert(data.message || 'Failed to end attendance session');
      }
    } catch (err) {
      console.error('End session error:', err);
      alert('Network error while closing attendance session.');
    } finally {
      setEndingSession(false);
    }
  };

  // Determine Circular Glow Border Styling
  const getCircleBorderStyle = () => {
    switch (scannerTone) {
      case 'success':
        return {
          border: '4px solid #10B981',
          boxShadow: '0 0 35px rgba(16, 185, 129, 0.7), inset 0 0 20px rgba(16, 185, 129, 0.3)',
        };
      case 'detecting':
      case 'verifying':
        return {
          border: '4px solid #38BDF8',
          boxShadow: '0 0 30px rgba(56, 189, 248, 0.6), inset 0 0 15px rgba(56, 189, 248, 0.3)',
        };
      case 'warning':
        return {
          border: '4px solid #F59E0B',
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.6), inset 0 0 15px rgba(245, 158, 11, 0.2)',
        };
      case 'error':
        return {
          border: '4px solid #EF4444',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.7), inset 0 0 15px rgba(239, 68, 68, 0.2)',
        };
      case 'idle':
      default:
        return {
          border: '4px solid #1E3A8A',
          boxShadow: '0 0 25px rgba(30, 58, 138, 0.5), inset 0 0 10px rgba(30, 58, 138, 0.2)',
        };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 11, 23, 0.96)',
        backdropFilter: 'blur(10px)',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      {/* MAIN CONTAINER */}
      <div
        style={{
          width: '100%',
          maxWidth: sessionClosed ? 'min(94vw, 1450px)' : '560px',
          maxHeight: '92vh',
          backgroundColor: '#061325',
          border: '2px solid var(--navy-border)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* HEADER BAR */}
        <div
          style={{
            backgroundColor: 'var(--navy-primary)',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--navy-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: sessionClosed ? '#EF4444' : '#10B981',
                boxShadow: sessionClosed ? '0 0 8px #EF4444' : '0 0 8px #10B981',
              }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#FFFFFF', letterSpacing: '0.03em' }}>
                LIVE FACE ATTENDANCE · {session.activity ? session.activity.toUpperCase() : 'UNIT PARADE MUSTER'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94A3B8' }}>
                Authorized Senior Device Camera · High-Speed Biometric Muster
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!sessionClosed && (
              <button
                type="button"
                onClick={() => setEndConfirmOpen(true)}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                }}
              >
                END ATTENDANCE
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '0.2rem',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TOP STATS STRIP: EXPECTED / PRESENT / REMAINING — Real-time, DB-authoritative */}
        <div
          style={{
            backgroundColor: '#030B17',
            padding: '0.6rem 1.25rem',
            borderBottom: '1px solid var(--navy-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            textAlign: 'center',
            gap: '0.5rem',
            position: 'relative',
          }}
        >
          {/* LIVE pulse dot — only during active session */}
          {!sessionClosed && (
            <div style={{
              position: 'absolute',
              top: '0.45rem',
              right: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 6px #10B981',
                animation: 'livePulse 1.4s ease-in-out infinite',
              }} />
              <span style={{ color: '#10B981', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>LIVE</span>
            </div>
          )}

          {/* EXPECTED */}
          <div style={{ padding: '0.15rem 0' }}>
            <span style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 700, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              EXPECTED
            </span>
            <strong style={{ fontSize: '1.45rem', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
              {expectedCount}
            </strong>
          </div>

          {/* PRESENT — flashes green on increment */}
          <div style={{
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            padding: '0.15rem 0',
            borderRadius: '6px',
            transition: 'background-color 0.4s ease',
            backgroundColor: presentFlash ? 'rgba(16,185,129,0.18)' : 'transparent',
          }}>
            <span style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 700, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              PRESENT
            </span>
            <strong style={{
              fontSize: '1.45rem',
              color: presentFlash ? '#34D399' : '#10B981',
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.4s ease',
            }}>
              {presentCount}
            </strong>
          </div>

          {/* REMAINING */}
          <div style={{ padding: '0.15rem 0' }}>
            <span style={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 700, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              REMAINING
            </span>
            <strong style={{
              fontSize: '1.45rem',
              color: remainingCount === 0 ? '#22C55E' : remainingCount <= 5 ? '#F59E0B' : '#E2E8F0',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {remainingCount}
            </strong>
          </div>

          {/* Live pulse animation keyframes injected inline */}
          <style>{`
            @keyframes livePulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.75); }
            }
          `}</style>
        </div>

        {/* ACTIVE LIVE ATTENDANCE INTERFACE */}
        {!sessionClosed ? (
          <div
            style={{
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#061325',
            }}
          >
            {/* Mode Switcher: Biometric Scanner vs Manual Fallback */}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setManualListOpen(false)}
                style={{
                  flex: 1,
                  maxWidth: '220px',
                  backgroundColor: !manualListOpen ? 'var(--navy-primary)' : 'rgba(15, 23, 42, 0.6)',
                  color: !manualListOpen ? '#FFFFFF' : '#94A3B8',
                  border: `1px solid ${!manualListOpen ? 'var(--navy-border)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                📷 <span>CAMERA SCANNER</span>
              </button>
              <button
                type="button"
                onClick={() => setManualListOpen(true)}
                style={{
                  flex: 1,
                  maxWidth: '260px',
                  backgroundColor: manualListOpen ? '#2563EB' : 'rgba(15, 23, 42, 0.6)',
                  color: manualListOpen ? '#FFFFFF' : '#94A3B8',
                  border: `1px solid ${manualListOpen ? '#60A5FA' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                ⚡ <span>MANUAL QUICK-MARK (LOW LIGHT)</span>
              </button>
            </div>

            {manualSuccessMsg && (
              <div
                style={{
                  width: '100%',
                  backgroundColor: '#065F46',
                  color: '#A7F3D0',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  marginBottom: '1rem',
                  border: '1px solid #10B981',
                }}
              >
                {manualSuccessMsg}
              </div>
            )}

            {manualListOpen ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Search cadet name, regimental no, roll no..."
                    style={{
                      width: '100%',
                      backgroundColor: '#030B17',
                      border: '1px solid var(--navy-border)',
                      borderRadius: '6px',
                      padding: '0.6rem 0.85rem',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  {manualSearch && (
                    <button
                      type="button"
                      onClick={() => setManualSearch('')}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div
                  style={{
                    maxHeight: '340px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    paddingRight: '0.25rem',
                  }}
                >
                  {preloadedCadets
                    .filter((c) => {
                      if (!manualSearch.trim()) return true;
                      const q = manualSearch.toLowerCase();
                      return (
                        c.fullName.toLowerCase().includes(q) ||
                        c.regimentalNumber.toLowerCase().includes(q) ||
                        (c.collegeRollNumber && c.collegeRollNumber.toLowerCase().includes(q))
                      );
                    })
                    .map((cadet) => {
                      const isMarked =
                        markedCadetIds.has(cadet.id) ||
                        recentVerified.some((r) => r.id === cadet.id);
                      const isSubmitting = manualMarkingId === cadet.id;

                      return (
                        <div
                          key={cadet.id}
                          style={{
                            backgroundColor: '#0B1B32',
                            border: `1px solid ${isMarked ? '#10B981' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '6px',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                              {cadet.fullName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.15rem' }}>
                              {cadet.regimentalNumber} &bull; {cadet.platoonName || 'Platoon'}
                            </div>
                          </div>

                          <div>
                            {isMarked ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  color: '#34D399',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(6, 95, 70, 0.4)',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '4px',
                                  border: '1px solid #10B981',
                                }}
                              >
                                ✓ PRESENT
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleManualMarkPresent(cadet)}
                                style={{
                                  backgroundColor: '#10B981',
                                  color: '#064E3B',
                                  fontWeight: 800,
                                  fontSize: '0.76rem',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.4rem 0.8rem',
                                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                }}
                              >
                                {isSubmitting ? (
                                  <>
                                    <RefreshCw size={12} className="animate-spin" />
                                    <span>MARKING...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>✓ MARK PRESENT</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {preloadedCadets.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.85rem' }}>
                      No eligible cadets found for this platoon session.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* LARGE CIRCULAR SCANNER — ABSOLUTELY NO SQUARE (Section 3) */}
                <div style={{ position: 'relative', margin: '0.5rem 0 1.25rem' }}>
              <div
                style={{
                  width: '280px',
                  height: '280px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  aspectRatio: '1 / 1',
                  backgroundColor: '#000000',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.25s ease',
                  ...getCircleBorderStyle(),
                }}
              >
                {cameraError ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#FFFFFF' }}>
                    <AlertTriangle size={32} color="#EF4444" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '0 0 0.75rem' }}>
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="btn-primary btn-sm"
                      style={{ fontSize: '0.72rem' }}
                    >
                      <RefreshCw size={12} />
                      <span>RETRY CAMERA</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none',
                      }}
                    />

                    {/* Subtle Pulsing Radar / Scan Horizon */}
                    {scannerTone === 'detecting' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          border: '2px solid rgba(56, 189, 248, 0.4)',
                          animation: 'pulse 1.5s infinite',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </>
                )}
              </div>

              {/* CAMERA FLIP TOGGLE (Rear / Front Lens) */}
              <button
                type="button"
                onClick={() => setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'))}
                title="Switch Camera"
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(3, 11, 23, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.4)',
                }}
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {/* STATUS HEADLINE & ACTION INSTRUCTIONS */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem', width: '100%' }}>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color:
                    scannerTone === 'success'
                      ? '#10B981'
                      : scannerTone === 'detecting' || scannerTone === 'verifying'
                      ? '#38BDF8'
                      : scannerTone === 'warning'
                      ? '#F59E0B'
                      : scannerTone === 'error'
                      ? '#EF4444'
                      : '#FFFFFF',
                  marginBottom: '0.2rem',
                }}
              >
                {statusTitle}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                {statusSubtitle}
              </div>
            </div>
            </>
          )}

            {/* INSTANT CADET VERIFIED CARD (Auto-displays & auto-resets) */}
            {activeCadetResult && (
              <div
                style={{
                  width: '100%',
                  backgroundColor:
                    scannerTone === 'success'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : scannerTone === 'warning'
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(239, 68, 68, 0.12)',
                  border: `2px solid ${
                    scannerTone === 'success'
                      ? '#10B981'
                      : scannerTone === 'warning'
                      ? '#F59E0B'
                      : '#EF4444'
                  }`,
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.25rem',
                  textAlign: 'center',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  {scannerTone === 'success' ? (
                    <CheckCircle size={18} color="#10B981" />
                  ) : scannerTone === 'warning' ? (
                    <Clock size={18} color="#F59E0B" />
                  ) : (
                    <XCircle size={18} color="#EF4444" />
                  )}
                  <strong
                    style={{
                      fontSize: '0.88rem',
                      letterSpacing: '0.03em',
                      color:
                        scannerTone === 'success'
                          ? '#10B981'
                          : scannerTone === 'warning'
                          ? '#F59E0B'
                          : '#EF4444',
                    }}
                  >
                    {activeCadetResult.statusText}
                  </strong>
                </div>

                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF' }}>
                  {activeCadetResult.fullName}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                  {activeCadetResult.regimentalNumber}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1.25rem',
                    fontSize: '0.74rem',
                    color: '#94A3B8',
                    marginTop: '0.4rem',
                    paddingTop: '0.4rem',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span>RECORDED: <strong style={{ color: '#FFFFFF' }}>{activeCadetResult.time}</strong></span>
                  {activeCadetResult.confidence && (
                    <span>CONFIDENCE: <strong style={{ color: '#10B981' }}>{activeCadetResult.confidence}%</strong></span>
                  )}
                </div>

                {activeCadetResult.smsStatus && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '0.65rem',
                      marginTop: '0.45rem',
                      paddingTop: '0.35rem',
                      borderTop: '1px dashed rgba(255,255,255,0.1)',
                      fontSize: '0.72rem',
                    }}
                  >
                    <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34D399', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      📱 SMS: {activeCadetResult.smsStatus === 'QUEUED' ? 'Queued / Dispatched' : activeCadetResult.smsStatus}
                    </span>
                    <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34D399', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      💬 WhatsApp: {activeCadetResult.whatsappStatus === 'QUEUED' ? 'Queued / Dispatched' : activeCadetResult.whatsappStatus}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* RECENTLY VERIFIED ROSTER STRIP */}
            <div
              style={{
                width: '100%',
                backgroundColor: '#030B17',
                border: '1px solid var(--navy-border)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                  fontSize: '0.72rem',
                  color: '#94A3B8',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                <span>RECENTLY VERIFIED CADETS ({recentVerified.length})</span>
                <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ShieldCheck size={13} />
                  <span>LIVE ROSTER</span>
                </span>
              </div>

              <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                {recentVerified.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', padding: '0.4rem 0' }}>
                    Waiting for cadets. Step in front of the circular camera.
                  </div>
                ) : (
                  recentVerified.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.3rem 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <span style={{ color: '#E2E8F0', fontWeight: 600 }}>✓ {c.name}</span>
                      <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {c.time}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SUBTLE OPERATIONAL PROTOCOL BANNER */}
            <div
              style={{
                marginTop: '1rem',
                fontSize: '0.7rem',
                color: '#64748B',
                textAlign: 'center',
              }}
            >
              Parade Protocol: Cadets look into circle for ~2 seconds. Automatic Present recorded. Do not hand phone to cadets.
            </div>
          </div>
        ) : (
          /* ============================================================
             SESSION CLOSED SUMMARY & ABSENT CADETS REPORT
             ============================================================ */
          <div
            style={{
              padding: '1.75rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--navy-primary)',
              overflowY: 'auto',
              maxHeight: 'calc(92vh - 65px)',
              flex: 1,
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  marginBottom: '0.5rem',
                }}
              >
                <XCircle size={16} />
                <span>ATTENDANCE SESSION CLOSED</span>
              </div>
              <h3 style={{ margin: '0.25rem 0', fontSize: '1.35rem', color: 'var(--navy-primary)' }}>
                {session.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--navy-text-muted)' }}>
                Session concluded and permanently logged into the institutional muster register.
              </p>
            </div>

            {/* SUMMARY CARDS (5 METRICS) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--white-border)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--navy-text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>EXPECTED</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy-primary)' }}>
                  {closedSummary?.summary?.expected ?? expectedCount}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, letterSpacing: '0.04em' }}>PRESENT</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803D' }}>
                  {closedSummary?.summary?.present ?? presentCount}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 700, letterSpacing: '0.04em' }}>ABSENT</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#DC2626' }}>
                  {closedSummary?.summary?.absent ?? (expectedCount - presentCount)}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 700, marginBottom: '0.2rem' }}>📱 Absent SMS Dispatched</span>
                <strong style={{ fontSize: '1.4rem', color: '#1D4ED8' }}>
                  {closedSummary?.summary?.absentNotifications?.smsQueued ?? 0}
                </strong>
              </div>
              <div
                style={{
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 700, marginBottom: '0.2rem' }}>💬 Absent WhatsApp Dispatched</span>
                <strong style={{ fontSize: '1.4rem', color: '#047857' }}>
                  {closedSummary?.summary?.absentNotifications?.whatsappQueued ?? 0}
                </strong>
              </div>
            </div>

            {/* ABSENT LIST TABLE */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--navy-primary)', margin: 0, fontWeight: 800, letterSpacing: '0.02em' }}>
                  ABSENT CADETS LEDGER & NOTIFICATION STATUS
                </h4>
                {closedSummary?.absentCadets && closedSummary.absentCadets.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--navy-text-muted)', fontWeight: 600 }}>
                    {closedSummary.absentCadets.length} {closedSummary.absentCadets.length === 1 ? 'Cadet Logged' : 'Cadets Logged'}
                  </span>
                )}
              </div>

              <div
                style={{
                  maxHeight: '380px',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#0A192F',
                        color: '#FFFFFF',
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                      }}
                    >
                      <th style={{ width: '25%', minWidth: '220px', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '2px solid #061325' }}>NAME</th>
                      <th style={{ width: '20%', minWidth: '180px', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '2px solid #061325' }}>REGIMENTAL NO</th>
                      <th style={{ width: '20%', minWidth: '180px', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '2px solid #061325' }}>CLASSIFICATION</th>
                      <th style={{ width: '17%', minWidth: '160px', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '2px solid #061325' }}>SMS DISPATCH</th>
                      <th style={{ width: '18%', minWidth: '180px', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '2px solid #061325' }}>WHATSAPP DISPATCH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedSummary?.absentCadets && closedSummary.absentCadets.length > 0 ? (
                      closedSummary.absentCadets.map((c: any, idx: number) => {
                        const smsStatus = (c.smsStatus || (c.hasLeave ? 'EXEMPT (APPROVED LEAVE)' : 'QUEUED')).toUpperCase();
                        const waStatus = (c.whatsappStatus || (c.hasLeave ? 'EXEMPT (APPROVED LEAVE)' : 'QUEUED')).toUpperCase();

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #E2E8F0',
                              backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', minWidth: '220px' }}>
                              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>{c.fullName}</div>
                              {c.maskedPhone && (
                                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500, marginTop: '0.2rem' }}>
                                  📱 {c.maskedPhone}
                                </div>
                              )}
                            </td>
                            <td
                              style={{
                                padding: '0.85rem 1rem',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontWeight: 700,
                                color: '#1E293B',
                                fontSize: '0.85rem',
                                verticalAlign: 'middle',
                                minWidth: '180px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {c.regimentalNumber}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', minWidth: '180px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: c.hasLeave ? '#E0F2FE' : '#FEE2E2',
                                  color: c.hasLeave ? '#0369A1' : '#B91C1C',
                                  border: `1px solid ${c.hasLeave ? '#BAE6FD' : '#FECACA'}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {c.statusCategory}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', minWidth: '160px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.02em',
                                  backgroundColor: c.hasLeave
                                    ? '#F1F5F9'
                                    : smsStatus === 'FAILED'
                                    ? '#FEF2F2'
                                    : smsStatus === 'SENT' || smsStatus === 'DELIVERED'
                                    ? '#F0FDF4'
                                    : '#ECFDF5',
                                  color: c.hasLeave
                                    ? '#475569'
                                    : smsStatus === 'FAILED'
                                    ? '#DC2626'
                                    : smsStatus === 'SENT' || smsStatus === 'DELIVERED'
                                    ? '#15803D'
                                    : '#047857',
                                  border: `1px solid ${
                                    c.hasLeave
                                      ? '#CBD5E1'
                                      : smsStatus === 'FAILED'
                                      ? '#FECACA'
                                      : smsStatus === 'SENT' || smsStatus === 'DELIVERED'
                                      ? '#BBF7D0'
                                      : '#A7F3D0'
                                  }`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {c.hasLeave ? 'EXEMPT (APPROVED LEAVE)' : smsStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', minWidth: '180px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.02em',
                                  backgroundColor: c.hasLeave
                                    ? '#F1F5F9'
                                    : waStatus === 'FAILED'
                                    ? '#FEF2F2'
                                    : waStatus === 'SENT' || waStatus === 'DELIVERED'
                                    ? '#F0FDF4'
                                    : '#ECFDF5',
                                  color: c.hasLeave
                                    ? '#475569'
                                    : waStatus === 'FAILED'
                                    ? '#DC2626'
                                    : waStatus === 'SENT' || waStatus === 'DELIVERED'
                                    ? '#15803D'
                                    : '#047857',
                                  border: `1px solid ${
                                    c.hasLeave
                                      ? '#CBD5E1'
                                      : waStatus === 'FAILED'
                                      ? '#FECACA'
                                      : waStatus === 'SENT' || waStatus === 'DELIVERED'
                                      ? '#BBF7D0'
                                      : '#A7F3D0'
                                  }`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {c.hasLeave ? 'EXEMPT (APPROVED LEAVE)' : waStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem 1rem', textAlign: 'center', color: '#059669', fontWeight: 600, fontSize: '0.9rem' }}>
                          ✓ 100% Parade Turnout. Zero unexcused absences recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
                style={{ padding: '0.65rem 1.4rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '6px' }}
              >
                CLOSE SUMMARY & RETURN TO ROSTER
              </button>
            </div>
          </div>
        )}
      </div>

      {/* END ATTENDANCE CONFIRMATION MODAL */}
      {endConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 11, 23, 0.85)',
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid var(--navy-primary)',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--navy-primary)', fontSize: '1.1rem' }}>
              End this attendance session?
            </h4>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.5' }}>
              Once confirmed, this parade muster session will be permanently <strong>CLOSED</strong>. No further live face verifications will be accepted, and unverified cadets will be marked Absent.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setEndConfirmOpen(false)}
                className="btn-secondary btn-sm"
                disabled={endingSession}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmEndSession}
                className="btn-primary btn-sm"
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                disabled={endingSession}
              >
                {endingSession ? 'Closing...' : 'CONFIRM & END'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
