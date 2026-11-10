import React, { useState, useRef } from 'react';
import { X, UserPlus, Shield, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import { useAuth } from '../../context/AuthContext';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { OTPVerification } from '../common/OTPVerification';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose }) => {
  const { registerCadet, requestRegistrationOtp, verifyRegistrationOtp, resendAuthOtp } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    regimentalNumber: '',
    collegeRollNumber: '',
    email: '',
    phone: '',
    year: 'FE (1st Year)',
    branch: 'Computer Engineering',
    enrollmentDetails: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    password: '',
    confirmPassword: '',
  });

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [faceSnapshot, setFaceSnapshot] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [pendingFaceDescriptor, setPendingFaceDescriptor] = useState<number[] | null>(null);
  const [pendingFaceQuality, setPendingFaceQuality] = useState<number | null>(null);
  const [faceQuality, setFaceQuality] = useState<number | null>(null);
  const [faceConsent, setFaceConsent] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceModelReady, setFaceModelReady] = useState(false);
  const [facePersisted, setFacePersisted] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<string>('Face recognition enrollment uses the configured local face model.');
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<string>('Position your face inside the frame.');
  const [detectionTone, setDetectionTone] = useState<'idle' | 'warning' | 'success'>('idle');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailProofId, setEmailProofId] = useState('');
  const [mobileProofId, setMobileProofId] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState(false);
  const [activeOtp, setActiveOtp] = useState<{ channel: 'email' | 'mobile'; id: string; destination: string; expiresAt: string; serverNow: string } | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSeconds, setOtpSeconds] = useState(0);

  const resetFormState = () => {
    setFormData({
      fullName: '',
      regimentalNumber: '',
      collegeRollNumber: '',
      email: '',
      phone: '',
      year: 'FE (1st Year)',
      branch: 'Computer Engineering',
      enrollmentDetails: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      password: '',
      confirmPassword: '',
    });
    setProfilePhoto(null);
    setPhotoStatus(null);
    setFaceSnapshot(null);
    setFaceDescriptor(null);
    setPendingFaceDescriptor(null);
    setPendingFaceQuality(null);
    setFaceQuality(null);
    setFaceConsent(false);
    setFaceDetected(false);
    setFaceModelReady(false);
    setFacePersisted(false);
    setBiometricStatus('Face recognition enrollment uses the configured local face model.');
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmailProofId(''); setMobileProofId(''); setVerifiedEmail(false); setVerifiedMobile(false); setActiveOtp(null);
  };

  const handleCloseModal = () => {
    stopCamera();
    resetFormState();
    onClose();
  };

  const dialogRef = useAccessibleDialog<HTMLDivElement>(isOpen, handleCloseModal);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, onClose]);

  const stopCamera = () => {
    cameraRequestRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
  };

  const startFaceCamera = async () => {
    if (!faceConsent) {
      setErrorMsg('Please confirm consent before using the camera for biometric capture.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Camera access is not available in this browser.');
      setBiometricStatus('Camera access is not available in this browser.');
      return;
    }
    const requestId = ++cameraRequestRef.current;
    setCameraLoading(true);
    setErrorMsg(null);
    setDetectionTone('idle');
    setFaceDetected(false);
    setFaceModelReady(false);
    setFaceDetectionStatus('Loading face detection model...');

    try {
      setBiometricStatus('Loading the configured face recognition model...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      if (requestId !== cameraRequestRef.current) return;
      setFaceModelReady(true);
      setFaceDetectionStatus('Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
      const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
        const deadline = Date.now() + 5000;
        const findVideo = () => {
          if (requestId !== cameraRequestRef.current) { reject(new Error('CAMERA_CANCELLED')); return; }
          if (videoRef.current) { resolve(videoRef.current); return; }
          if (Date.now() >= deadline) { reject(new Error('VIDEO_ELEMENT_UNAVAILABLE')); return; }
          window.requestAnimationFrame(findVideo);
        };
        window.requestAnimationFrame(findVideo);
      });
      video.srcObject = stream;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('VIDEO_METADATA_TIMEOUT')), 8000);
          video.addEventListener('loadedmetadata', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
          video.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('VIDEO_METADATA_FAILED')); }, { once: true });
        });
      }
      await video.play();
      const frameDeadline = Date.now() + 5000;
      while ((video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) && Date.now() < frameDeadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (!video.videoWidth || !video.videoHeight) throw new Error('VIDEO_FRAME_UNAVAILABLE');
      if (requestId !== cameraRequestRef.current) return;
      setBiometricStatus('Camera active. Capture is available after one clear face is detected.');
      setFaceDetectionStatus('Center your face in the frame with even lighting.');
    } catch (err: any) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access is required for biometric enrollment. Please allow camera access and try again.');
        setBiometricStatus('Camera access is required for biometric enrollment. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('No camera was found on this device.');
        setBiometricStatus('No camera was found on this device.');
      } else {
        setErrorMsg('Camera or face model could not be initialized. Check camera availability and try again.');
        setBiometricStatus('Camera or face model could not be initialized. Check camera availability and try again.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  // Detection only enables the explicit capture action; it never captures automatically.
  React.useEffect(() => {
    if (!cameraActive) return;

    let animFrame: number;
    let lastScanTime = 0;
    let scanning = false;
    let stopped = false;

    const detectLoop = async (now: number) => {
      if (stopped) return;
      const video = videoRef.current;
      if (now - lastScanTime > 250 && !scanning && video && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        lastScanTime = now;
        scanning = true;
        try {
          const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }));
          if (detections.length === 0) {
            setFaceDetected(false);
            setDetectionTone('idle');
            setFaceDetectionStatus('No face detected. Center your face and improve lighting.');
          } else if (detections.length > 1) {
            setFaceDetected(false);
            setDetectionTone('warning');
            setFaceDetectionStatus('Only one person should be visible.');
          } else {
            const { box, score } = detections[0];
            const wellFramed = box.width >= video.videoWidth * 0.18 && box.height >= video.videoHeight * 0.18 && score >= 0.5;
            setFaceDetected(wellFramed);
            setDetectionTone(wellFramed ? 'success' : 'warning');
            setFaceDetectionStatus(wellFramed ? 'One face detected. Capture when ready.' : 'Move closer and use even lighting.');
          }
        } catch {
          setFaceDetected(false);
          setDetectionTone('warning');
          setFaceDetectionStatus('Face detection is unavailable. Check the model files and retry.');
        } finally {
          scanning = false;
        }
      }
      animFrame = requestAnimationFrame(detectLoop);
    };

    animFrame = requestAnimationFrame(detectLoop);

    return () => {
      stopped = true;
      cancelAnimationFrame(animFrame);
    };
  }, [cameraActive]);

  const captureFacePreview = async () => {
    const video = videoRef.current;
    if (!video || !faceConsent || !faceDetected || !faceModelReady || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setErrorMsg('Wait until one clear face is detected before capturing.');
      return;
    }
    setErrorMsg(null);
    setFaceDetectionStatus('Capturing and validating the current camera frame...');
    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();
      if (detections.length !== 1) throw new Error(detections.length === 0 ? 'NO_FACE' : 'MULTIPLE_FACES');
      const face = detections[0];
      const descriptor = Array.from(face.descriptor);
      if (descriptor.length !== 128 || !descriptor.every(Number.isFinite) || descriptor.every((value) => value === 0)) {
        throw new Error('INVALID_DESCRIPTOR');
      }
      const { box } = face.detection;
      if (box.width < video.videoWidth * 0.18 || box.height < video.videoHeight * 0.18 || face.detection.score < 0.5) {
        throw new Error('LOW_QUALITY');
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context || canvas.width < 160 || canvas.height < 160) throw new Error('INVALID_FRAME');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setFaceSnapshot(canvas.toDataURL('image/jpeg', 0.88));
      setPendingFaceDescriptor(descriptor);
      setPendingFaceQuality(Math.max(0, Math.min(1, face.detection.score)));
      setFaceDetectionStatus('Preview ready. Retake it or confirm this capture.');
      setBiometricStatus('Face captured locally; it is not saved until the application is submitted.');
      stopCamera();
    } catch (error: any) {
      const message = error?.message === 'NO_FACE' ? 'No face was found in the captured frame.'
        : error?.message === 'MULTIPLE_FACES' ? 'Only one face may be in the captured frame.'
          : error?.message === 'LOW_QUALITY' ? 'Face image quality is too low. Move closer and improve lighting.'
            : 'The camera frame could not be validated. Try again.';
      setErrorMsg(message);
      setFaceDetectionStatus(message);
      setDetectionTone('warning');
    }
  };

  const confirmFacePreview = () => {
    if (!faceConsent || !pendingFaceDescriptor || pendingFaceDescriptor.length !== 128 || !faceSnapshot) {
      setErrorMsg('Capture and validate a face before confirming it.');
      return;
    }
    setFaceDescriptor(pendingFaceDescriptor);
    setFaceQuality(pendingFaceQuality);
    setPendingFaceDescriptor(null);
    setFacePersisted(false);
    setBiometricStatus('Capture confirmed. The template will be saved when you submit the application.');
    setErrorMsg(null);
  };
  // DEF-FIX: Moved above early return — Rules of Hooks require all hooks unconditionally.
  React.useEffect(() => {
    if (!activeOtp) return;
    const update = () => {
      const ttl = Math.max(0, Math.ceil((new Date(activeOtp.expiresAt).getTime() - new Date(activeOtp.serverNow).getTime()) / 1000));
      setOtpSeconds(ttl);
    };
    update();
    const timer = window.setInterval(() => setOtpSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    const cooldownTimer = window.setInterval(() => setOtpCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => { window.clearInterval(timer); window.clearInterval(cooldownTimer); };
  }, [activeOtp?.expiresAt, activeOtp?.serverNow]);

  // All hooks above — early return safe here (Rules of Hooks satisfied)
  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((old) => ({ ...old, [name]: value }));
    if (name === 'email') { setVerifiedEmail(false); setEmailProofId(''); if (activeOtp?.channel === 'email') setActiveOtp(null); }
    if (name === 'phone') { setVerifiedMobile(false); setMobileProofId(''); if (activeOtp?.channel === 'mobile') setActiveOtp(null); }
  };

  const requestOtp = async (channel: 'email' | 'mobile') => {
    setOtpError(null); setOtpLoading(true);
    try {
      const result = await requestRegistrationOtp(channel, channel === 'email' ? formData.email : formData.phone, formData.fullName);
      if (!result.success) { setOtpError(result.message || 'Unable to send OTP. Please try again.'); return; }
      setActiveOtp({ channel, id: result.challengeId, destination: result.destination, expiresAt: result.expiresAt, serverNow: result.serverNow });
      setOtpCooldown(30);
    } catch { setOtpError('Could not reach the verification service. Check your connection and try again.'); }
    finally { setOtpLoading(false); }
  };

  const verifyOtp = async (otp: string) => {
    if (!activeOtp) return;
    setOtpError(null); setOtpLoading(true);
    try {
      const result = await verifyRegistrationOtp(activeOtp.channel, activeOtp.id, otp);
      if (!result.success) { setOtpError(result.message || 'Code verification failed.'); return; }
      if (activeOtp.channel === 'email') { setEmailProofId(activeOtp.id); setVerifiedEmail(true); }
      else { setMobileProofId(activeOtp.id); setVerifiedMobile(true); }
      setActiveOtp(null);
    } catch { setOtpError('Unable to verify code. Please try again.'); }
    finally { setOtpLoading(false); }
  };

  const resendOtp = async () => {
    if (!activeOtp) return false;
    setOtpError(null); setOtpLoading(true);
    try {
      const result = await resendAuthOtp(activeOtp.id, formData.fullName);
      if (!result.success) { setOtpError(result.message || 'Could not confirm OTP delivery. Please try again.'); return false; }
      setActiveOtp({ ...activeOtp, expiresAt: result.expiresAt, serverNow: result.serverNow });
      setOtpCooldown(30); return true;
    } catch { setOtpError('Could not reach the verification service. Check your connection and try again.'); return false; }
    finally { setOtpLoading(false); }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setProfilePhoto(result);
        setPhotoStatus('Profile photo saved successfully.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Password and Confirm Password must match.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (!faceDescriptor) {
      setErrorMsg('Confirm a valid face capture before submitting your application.');
      return;
    }

    if (!verifiedMobile || !verifiedEmail || !mobileProofId || !emailProofId) {
      setErrorMsg('Verify your mobile number and email before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        mobileChallengeId: mobileProofId,
        emailChallengeId: emailProofId,
        profilePhotoUrl: profilePhoto,
        profilePhoto,
        photoSnapshot: undefined,
        faceDescriptor: faceDescriptor || undefined,
        qualityScore: faceQuality ?? undefined,
      };
      const res = await registerCadet(payload);
      if (res.success) {
        if (res.biometricEnrolled === true) {
          setFacePersisted(true);
          setBiometricStatus('Biometric template saved with your application.');
          setSuccessMsg(res.message || 'Registration submitted. Your application is under review.');
        } else {
          setErrorMsg('The application response did not confirm biometric template persistence. Please contact NCC administration.');
        }
      } else {
        setErrorMsg(res.message || 'Registration failed. Please check the entered fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-modal-title"
      tabIndex={-1}
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--white-pure)',
          border: '2px solid var(--navy-primary)',
          borderRadius: '6px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--navy-primary)',
            color: 'var(--white-pure)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Shield size={20} />
            <h3 id="register-modal-title" style={{ color: 'var(--white-pure)', fontSize: '1.15rem' }}>CADET ENROLLMENT REGISTRATION</h3>
          </div>
          <button
            onClick={handleCloseModal}
            style={{ background: 'none', border: 'none', color: 'var(--white-pure)', cursor: 'pointer' }}
            aria-label="Close Registration"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
          {/* Success Banner */}
          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              style={{
                backgroundColor: 'var(--color-success-soft)',
                border: '1px solid var(--color-success)',
                color: 'var(--color-success)',
                padding: '1rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  CADET APPLICATION FILED
                </strong>
                <span>{successMsg}</span>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-success)' }}>
                  Your account status is currently <strong>UNDER_REVIEW</strong>. After approval by either your Senior or Platoon Senior, Admin/ANO will complete the final review.
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                backgroundColor: 'var(--color-error-soft)',
                border: '1px solid var(--color-error)',
                color: 'var(--color-error)',
                padding: '0.85rem 1rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div
            style={{
              backgroundColor: 'var(--navy-badge-bg)',
              border: '1px solid var(--navy-badge-border)',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              fontSize: '0.82rem',
              color: 'var(--navy-primary)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              Real PostgreSQL duplicate validation is active on Email, Regimental Number, and College Roll Number.
            </span>
          </div>

          <form onSubmit={handleSubmit} aria-busy={submitting} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-1">
                  FULL NAME (AS PER COLLEGE ID) *
                </label>
                <input id="register-field-1"
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Vikramaditya Rathore"
                  value={formData.fullName}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-2">
                  REGIMENTAL NUMBER *
                </label>
                <input id="register-field-2"
                  type="text"
                  name="regimentalNumber"
                  required
                  placeholder="e.g. MH26SDA109999"
                  value={formData.regimentalNumber}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-3">
                  COLLEGE ROLL NUMBER *
                </label>
                <input id="register-field-3"
                  type="text"
                  name="collegeRollNumber"
                  required
                  placeholder="e.g. 261099"
                  value={formData.collegeRollNumber}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>
            </div>

            {/* Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-4">
                  OFFICIAL EMAIL *
                </label>
                <input id="register-field-4"
                  type="email"
                  name="email"
                  required
                  placeholder="cadet@aitpune.edu.in"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
                <button type="button" disabled={!formData.email || otpLoading || verifiedEmail} onClick={() => requestOtp('email')} className="btn-secondary" style={{ marginTop: '0.45rem' }}>
                  {verifiedEmail ? '✓ Email Verified' : 'Verify Email'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-5">
                  MOBILE NUMBER *
                </label>
                <input id="register-field-5"
                  type="tel"
                  name="phone"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
                <button type="button" disabled={!formData.phone || otpLoading || verifiedMobile} onClick={() => requestOtp('mobile')} className="btn-secondary" style={{ marginTop: '0.45rem' }}>
                  {verifiedMobile ? '✓ Mobile Verified' : 'Verify Mobile'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-6">
                  DATE OF JOINING
                </label>
                <input id="register-field-6"
                  type="date"
                  name="dateOfJoining"
                  value={formData.dateOfJoining}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>
            </div>

            {activeOtp && (
              <OTPVerification
                key={`${activeOtp.id}-${activeOtp.expiresAt}`}
                destination={activeOtp.destination}
                embedded
                heading={`Verify ${activeOtp.channel === 'email' ? 'Email' : 'Mobile'}`}
                instruction={`Enter the 6-digit code sent to ${activeOtp.destination}.`}
                expiresInSeconds={otpSeconds}
                verifyDisabled={otpSeconds <= 0}
                onVerify={verifyOtp}
                onResend={resendOtp}
                loading={otpLoading}
                error={otpError}
                cooldown={otpCooldown}
              />
            )}
            {otpError && !activeOtp && <p role="alert" style={{ color: 'var(--color-error)' }}>{otpError}</p>}
            <p aria-live="polite" style={{ margin: 0, fontSize: '0.85rem', color: verifiedEmail && verifiedMobile ? 'var(--color-success)' : 'var(--color-muted)' }}>
              {verifiedMobile ? '✓ Mobile verified' : 'Mobile verification required.'} {' '}
              {verifiedEmail ? '✓ Email verified' : 'Email verification required.'}
            </p>

            {/* Academic & Branch Allocation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-7">
                  ACADEMIC YEAR *
                </label>
                <select id="register-field-7"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                >
                  <option value="FE (1st Year)">FE (1st Year)</option>
                  <option value="SE (2nd Year)">SE (2nd Year)</option>
                  <option value="TE (3rd Year)">TE (3rd Year)</option>
                  <option value="BE (4th Year)">BE (4th Year)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-8">
                  ENGINEERING BRANCH *
                </label>
                <select id="register-field-8"
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                >
                  <option value="Computer Engineering">Computer Engineering</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Telecommunication">Electronics & Telecommunication</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Robotics & Automation">Robotics & Automation</option>
                </select>
              </div>
            </div>

            {/* Profile Photo Upload */}
            <div>
              <label htmlFor="register-field-9" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                CADET UNIFORM / PROFILE PHOTO
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '4px',
                    border: '1px dashed var(--navy-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundColor: 'var(--white-surface)',
                  }}
                >
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile photo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Camera size={24} style={{ color: 'var(--navy-text-muted)' }} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <input
                    id="register-field-9"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ fontSize: '0.85rem' }}
                  />
                  {photoStatus && (
                    <span role="status" aria-live="polite" style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600 }}>
                      ✓ {photoStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Enrollment Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-10">
                NCC ENROLLMENT DETAILS & PRIOR CERTIFICATES (A / B / C)
              </label>
              <textarea id="register-field-10"
                name="enrollmentDetails"
                rows={2}
                placeholder="Mention previous NCC experience, schooling certificates (NCC A Certificate), sports honours, or blood group..."
                value={formData.enrollmentDetails}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-11">
                  ACCOUNT PASSWORD *
                </label>
                <input id="register-field-11"
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }} htmlFor="register-field-12">
                  CONFIRM PASSWORD *
                </label>
                <input id="register-field-12"
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="••••••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)' }}
                />
              </div>
            </div>

            {/* Biometric Section */}
            <div
              style={{
                backgroundColor: faceDescriptor ? 'rgba(22, 128, 60, 0.08)' : 'var(--white-surface)',
                border: `1px solid ${faceDescriptor ? 'var(--color-success)' : 'var(--white-border)'}`,
                borderRadius: '6px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={18} style={{ color: faceDescriptor ? 'var(--color-success)' : 'var(--navy-primary)' }} />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--navy-primary)' }}>
                    Face Recognition Enrollment (128-value descriptor)
                  </strong>
                </div>
                {faceDescriptor ? (
                  <span style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', border: '1px solid var(--color-success)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {facePersisted ? 'FACE REGISTERED' : 'CAPTURE CONFIRMED'}
                  </span>
                ) : (
                  <span style={{ backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-primary)', border: '1px solid var(--color-gold)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    FACE NOT REGISTERED
                  </span>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.85rem', fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--navy-text-muted)' }}>
                <input
                  type="checkbox"
                  checked={faceConsent}
                  onChange={(event) => {
                    const consented = event.target.checked;
                    setFaceConsent(consented);
                    if (!consented) {
                      stopCamera();
                      setFaceSnapshot(null);
                      setFaceDescriptor(null);
                      setPendingFaceDescriptor(null);
                      setPendingFaceQuality(null);
                      setFaceQuality(null);
                      setFacePersisted(false);
                    }
                  }}
                  style={{ marginTop: '0.15rem' }}
                />
                <span>I consent to camera capture and processing of my face descriptor for this NCC application. The image is previewed in this form; only the descriptor is submitted with the application.</span>
              </label>

              {cameraActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '200px',
                      height: '200px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: detectionTone === 'success' ? '3px solid var(--color-success)' : detectionTone === 'warning' ? '3px solid var(--color-gold)' : '3px solid var(--color-accent)',
                      backgroundColor: '#000000',
                      boxShadow: detectionTone === 'success' ? '0 0 18px rgba(22, 128, 60, 0.5)' : '0 0 15px rgba(21, 94, 239, 0.4)',
                    }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor:
                        detectionTone === 'success' ? 'var(--color-success-soft)' : detectionTone === 'warning' ? 'var(--color-warning-soft)' : 'var(--color-surface)',
                      color:
                        detectionTone === 'success' ? 'var(--color-success)' : detectionTone === 'warning' ? 'var(--color-primary)' : 'var(--navy-primary)',
                      border: `1px solid ${
                        detectionTone === 'success' ? 'var(--color-success-border)' : detectionTone === 'warning' ? 'var(--color-gold)' : 'var(--color-border)'
                      }`,
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          detectionTone === 'success' ? 'var(--color-success)' : detectionTone === 'warning' ? 'var(--color-gold)' : 'var(--color-accent)',
                      }}
                    />
                    <span role="status" aria-live="polite">{faceDetectionStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" disabled={!faceDetected || !faceModelReady} onClick={captureFacePreview} className="btn-primary btn-sm">
                      Capture Face
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : pendingFaceDescriptor && faceSnapshot ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <img src={faceSnapshot} alt="Captured face preview" style={{ width: 180, height: 180, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-success)' }} />
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--navy-text-muted)' }}>Review the capture. The image is not submitted; the validated descriptor is saved only after application submission.</p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary btn-sm" disabled={!faceConsent || cameraLoading} onClick={() => { setFaceSnapshot(null); setPendingFaceDescriptor(null); setPendingFaceQuality(null); startFaceCamera(); }}>Retake</button>
                    <button type="button" className="btn-primary btn-sm" onClick={confirmFacePreview}>Confirm Face Capture</button>
                  </div>
                </div>
              ) : faceDescriptor && faceSnapshot ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <img src={faceSnapshot} alt="Confirmed face capture" style={{ width: 180, height: 180, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-success)' }} />
                  <p role="status" aria-live="polite" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-success)', fontWeight: 600 }}>{biometricStatus}</p>
                  {!facePersisted && <button type="button" className="btn-secondary btn-sm" disabled={!faceConsent || cameraLoading} onClick={() => { setFaceDescriptor(null); setFaceQuality(null); setFaceSnapshot(null); startFaceCamera(); }}>Retake Face</button>}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.5', margin: '0 0 0.75rem' }}>
                    The configured face detection and recognition models run in the browser. One clear face must be detected before capture is enabled. Camera frames and descriptors are not written to logs.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={cameraLoading || !faceConsent}
                      onClick={() => {
                        setFaceDescriptor(null);
                        setPendingFaceDescriptor(null);
                        setPendingFaceQuality(null);
                        setFaceQuality(null);
                        setFaceSnapshot(null);
                        setFacePersisted(false);
                        startFaceCamera();
                      }}
                      className="btn-primary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        backgroundColor: 'var(--navy-primary)',
                        borderColor: 'var(--navy-primary)',
                      }}
                    >
                      <Camera size={14} />
                      <span>
                        {cameraLoading
                          ? 'Starting Camera...'
                          : 'START CAMERA'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !faceDescriptor || !verifiedMobile || !verifiedEmail}
                className="btn-primary"
                style={{
                  opacity: !faceDescriptor || !verifiedMobile || !verifiedEmail ? 0.65 : 1,
                  cursor: !faceDescriptor || !verifiedMobile || !verifiedEmail ? 'not-allowed' : 'pointer',
                }}
                title={!faceDescriptor ? 'Biometric face registration is required' : !verifiedMobile || !verifiedEmail ? 'Verify your mobile number and email before submitting' : ''}
              >
                <UserPlus size={16} />
                <span>{submitting ? 'VALIDATING WITH DATABASE...' : 'SUBMIT APPLICATION'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
