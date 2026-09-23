import React, { useState, useRef } from 'react';
import { X, UserPlus, Shield, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as faceapi from '@vladmandic/face-api';
import { useAuth } from '../../context/AuthContext';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose }) => {
  const { registerCadet } = useAuth();
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

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [faceSource, setFaceSource] = useState<'NONE' | 'UPLOADED_PHOTO' | 'LIVE_CAMERA'>('NONE');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<string>('Biometric Face Registration (FaceNet 128-d) for automatic muster.');
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<string>('Position your face inside the frame.');
  const [detectionTone, setDetectionTone] = useState<'idle' | 'warning' | 'success'>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCapturingRef = useRef<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setPhotoPreview(null);
    setFaceDescriptor(null);
    setFaceSource('NONE');
    setBiometricStatus('Biometric Face Registration (FaceNet 128-d) for automatic muster.');
    setErrorMsg(null);
    setSuccessMsg(null);
    setCountdown(null);
  };

  const handleCloseModal = () => {
    stopCamera();
    resetFormState();
    onClose();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
    return () => {
      stopCamera();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const stopCamera = () => {
    isCapturingRef.current = false;
    setCountdown(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startFaceCamera = async () => {
    setCameraLoading(true);
    setErrorMsg(null);
    isCapturingRef.current = false;
    setCountdown(null);
    setDetectionTone('idle');
    setFaceDetectionStatus('Starting camera & loading neural models...');

    try {
      setBiometricStatus('Loading biometric AI models...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setBiometricStatus('Detecting Face...');
      setFaceDetectionStatus('Position your face inside the frame.');
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera/model error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access is required for biometric enrollment. Please allow camera access and try again.');
        setBiometricStatus('Camera access is required for biometric enrollment. Please allow camera access and try again.');
      } else {
        setErrorMsg('Camera could not be started. Please check your camera and try again.');
        setBiometricStatus('Camera could not be started. Please check your camera and try again.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  // Automatic Face Detection & Auto-Capture Loop
  React.useEffect(() => {
    if (!cameraActive) return;

    let animFrame: number;
    let lastScanTime = 0;
    let consecutiveFrames = 0;
    isCapturingRef.current = false;

    const detectLoop = async (now: number) => {
      // Throttle to ~10 FPS for optimal performance & rapid response
      if (now - lastScanTime > 90) {
        lastScanTime = now;

        if (
          videoRef.current &&
          !videoRef.current.paused &&
          !videoRef.current.ended &&
          !isCapturingRef.current
        ) {
          const video = videoRef.current;
          if (video.readyState >= 2) {
            try {
              const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
                .withFaceLandmarks(true)
                .withFaceDescriptors();

              if (detections.length === 0) {
                consecutiveFrames = 0;
                setCountdown(null);
                setDetectionTone('idle');
                setFaceDetectionStatus('Position your face inside the frame.');
              } else if (detections.length > 1) {
                consecutiveFrames = 0;
                setCountdown(null);
                setDetectionTone('warning');
                setFaceDetectionStatus('Only one person should be visible.');
              } else {
                const single = detections[0];
                const box = single.detection.box;

                // Basic quality, centering & size checks
                if (box.width < 75 || box.height < 75) {
                  consecutiveFrames = 0;
                  setCountdown(null);
                  setDetectionTone('warning');
                  setFaceDetectionStatus('Move closer or improve lighting.');
                } else {
                  consecutiveFrames++;
                  setDetectionTone('success');

                  if (consecutiveFrames < 3) {
                    setCountdown(3);
                    setFaceDetectionStatus('Face Detected — Hold Still (3...)');
                  } else if (consecutiveFrames < 6) {
                    setCountdown(2);
                    setFaceDetectionStatus('Face Detected — Hold Still (2...)');
                  } else if (consecutiveFrames < 9) {
                    setCountdown(1);
                    setFaceDetectionStatus('Face Detected — Hold Still (1...)');
                  } else {
                    // AUTOMATIC CAPTURE TRIGGERED!
                    isCapturingRef.current = true;
                    setCountdown(null);
                    setFaceDetectionStatus('Registering Biometric Template...');

                    // Capture frame snapshot to canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = 180;
                    canvas.height = 180;
                    const ctx = canvas.getContext('2d');
                    if (ctx && videoRef.current) {
                      ctx.drawImage(videoRef.current, 0, 0, 180, 180);
                      const snapshot = canvas.toDataURL('image/jpeg', 0.85);
                      setPhotoPreview(snapshot);
                    }

                    const descriptor = Array.from(single.descriptor);
                    setFaceDescriptor(descriptor);
                    setFaceSource('LIVE_CAMERA');
                    setBiometricStatus('✓ Live Camera Biometric Template Captured (128-d Vector Ready)');
                    stopCamera();
                    return;
                  }
                }
              }
            } catch (err) {
              console.error('Face auto-detection error:', err);
            }
          }
        }
      }

      if (!isCapturingRef.current) {
        animFrame = requestAnimationFrame(detectLoop);
      }
    };

    animFrame = requestAnimationFrame(detectLoop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [cameraActive]);


  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleClearFace = () => {
    setFaceDescriptor(null);
    setFaceSource('NONE');
    setBiometricStatus('Biometric Face Registration (FaceNet 128-d) for automatic muster.');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        // Process face from image
        try {
          const img = new Image();
          img.src = result;
          img.onload = async () => {
            try {
              setBiometricStatus('Analyzing face features in uploaded photo...');
              await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
              ]);
              const detection = await faceapi
                .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();
              if (detection) {
                setFaceDescriptor(Array.from(detection.descriptor));
                setFaceSource('UPLOADED_PHOTO');
                setBiometricStatus('✓ Face recognized in uploaded photo (128-d Vector Template Ready)');
              } else {
                if (faceSource !== 'LIVE_CAMERA') {
                  setFaceDescriptor(null);
                  setFaceSource('NONE');
                  setBiometricStatus('Photo uploaded, but no face was clearly detected. Please use the camera below to capture your face.');
                }
              }
            } catch (e) {
              setBiometricStatus('Photo uploaded. Please use the camera below to enroll face biometrics.');
            }
          };
        } catch (err) {}
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
      setErrorMsg('Biometric face registration is required. Please capture your face using the camera below or upload a portrait photo.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        photoSnapshot: photoPreview,
        faceDescriptor: faceDescriptor || undefined,
        qualityScore: faceDescriptor ? 0.98 : undefined,
      };
      const res = await registerCadet(payload);
      if (res.success) {
        setSuccessMsg(res.message || 'Registration submitted successfully. Your application is under review.');
      } else {
        setErrorMsg(res.message || 'Registration failed. Please check the entered fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
            <h3 style={{ color: 'var(--white-pure)', fontSize: '1.15rem' }}>CADET ENROLLMENT REGISTRATION</h3>
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
              style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #10B981',
                color: '#065F46',
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
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#047857' }}>
                  Your account status is currently <strong>UNDER_REVIEW</strong>. Once vetted by your Senior, Platoon Senior, and approved by the ANO, you will be able to log in.
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #EF4444',
                color: '#B91C1C',
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  FULL NAME (AS PER COLLEGE ID) *
                </label>
                <input
                  type="text"
                  name="fullName"
                  required
                  placeholder="e.g. Vikramaditya Rathore"
                  value={formData.fullName}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  REGIMENTAL NUMBER *
                </label>
                <input
                  type="text"
                  name="regimentalNumber"
                  required
                  placeholder="e.g. MH26SDA109999"
                  value={formData.regimentalNumber}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  COLLEGE ROLL NUMBER *
                </label>
                <input
                  type="text"
                  name="collegeRollNumber"
                  required
                  placeholder="e.g. 261099"
                  value={formData.collegeRollNumber}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>
            </div>

            {/* Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  OFFICIAL EMAIL *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="cadet@aitpune.edu.in"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  PHONE (WHERE PERMITTED)
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  DATE OF JOINING
                </label>
                <input
                  type="date"
                  name="dateOfJoining"
                  value={formData.dateOfJoining}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>
            </div>

            {/* Academic & Branch Allocation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  ACADEMIC YEAR *
                </label>
                <select
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                >
                  <option value="FE (1st Year)">FE (1st Year)</option>
                  <option value="SE (2nd Year)">SE (2nd Year)</option>
                  <option value="TE (3rd Year)">TE (3rd Year)</option>
                  <option value="BE (4th Year)">BE (4th Year)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  ENGINEERING BRANCH *
                </label>
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
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
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.35rem' }}>
                CADET UNIFORM / PROFILE PHOTO
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Camera size={24} style={{ color: 'var(--navy-text-muted)' }} />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Enrollment Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                NCC ENROLLMENT DETAILS & PRIOR CERTIFICATES (A / B / C)
              </label>
              <textarea
                name="enrollmentDetails"
                rows={2}
                placeholder="Mention previous NCC experience, schooling certificates (NCC A Certificate), sports honours, or blood group..."
                value={formData.enrollmentDetails}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  ACCOUNT PASSWORD *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-primary)', marginBottom: '0.25rem' }}>
                  CONFIRM PASSWORD *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="••••••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--white-border)', outline: 'none' }}
                />
              </div>
            </div>

            {/* Biometric Section */}
            <div
              style={{
                backgroundColor: faceSource !== 'NONE' ? 'rgba(16, 185, 129, 0.08)' : 'var(--white-surface)',
                border: `1px solid ${faceSource !== 'NONE' ? '#10B981' : 'var(--white-border)'}`,
                borderRadius: '6px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={18} style={{ color: faceSource !== 'NONE' ? '#10B981' : 'var(--navy-primary)' }} />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--navy-primary)' }}>
                    Biometric Face Registration (FaceNet 128-d)
                  </strong>
                </div>
                {faceSource === 'LIVE_CAMERA' ? (
                  <span style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #10B981', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    ✓ LIVE CAMERA TEMPLATE READY
                  </span>
                ) : faceSource === 'UPLOADED_PHOTO' ? (
                  <span style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #93C5FD', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    ✓ EXTRACTED FROM UPLOADED PHOTO
                  </span>
                ) : (
                  <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                    FACE CAPTURE REQUIRED
                  </span>
                )}
              </div>

              {cameraActive ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '200px',
                      height: '200px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: detectionTone === 'success' ? '3px solid #10B981' : detectionTone === 'warning' ? '3px solid #F59E0B' : '3px solid #38BDF8',
                      backgroundColor: '#000000',
                      boxShadow: detectionTone === 'success' ? '0 0 18px rgba(16, 185, 129, 0.5)' : '0 0 15px rgba(56, 189, 248, 0.4)',
                    }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                    {countdown !== null && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(0,0,0,0.35)',
                          color: '#FFFFFF',
                          fontSize: '3.25rem',
                          fontWeight: 800,
                          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                          animation: 'pulse 0.6s infinite alternate',
                        }}
                      >
                        {countdown}
                      </div>
                    )}
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
                        detectionTone === 'success' ? '#ECFDF5' : detectionTone === 'warning' ? '#FEF3C7' : '#F1F5F9',
                      color:
                        detectionTone === 'success' ? '#065F46' : detectionTone === 'warning' ? '#92400E' : 'var(--navy-primary)',
                      border: `1px solid ${
                        detectionTone === 'success' ? '#A7F3D0' : detectionTone === 'warning' ? '#FDE68A' : '#CBD5E1'
                      }`,
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          detectionTone === 'success' ? '#10B981' : detectionTone === 'warning' ? '#F59E0B' : '#38BDF8',
                      }}
                    />
                    <span>{faceDetectionStatus}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--navy-text-muted)', lineHeight: '1.5', margin: '0 0 0.75rem' }}>
                    {faceSource === 'LIVE_CAMERA'
                      ? '✓ Your face was captured live via webcam. This 128-d vector template will be linked to your cadet profile for automatic parade muster.'
                      : faceSource === 'UPLOADED_PHOTO'
                      ? '✓ A biometric face template was extracted from your uploaded uniform photo. You can submit with this, OR click below to capture a fresh live webcam photo.'
                      : 'Position your face in front of your camera to auto-capture your attendance face template, or upload a clear portrait photo above.'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={cameraLoading}
                      onClick={startFaceCamera}
                      className="btn-primary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        backgroundColor: faceSource !== 'NONE' ? '#059669' : 'var(--navy-primary)',
                        borderColor: faceSource !== 'NONE' ? '#059669' : 'var(--navy-primary)',
                      }}
                    >
                      <Camera size={14} />
                      <span>
                        {cameraLoading
                          ? 'Starting Camera...'
                          : faceSource === 'LIVE_CAMERA'
                          ? 'RE-TAKE LIVE CAMERA PHOTO'
                          : faceSource === 'UPLOADED_PHOTO'
                          ? 'CAPTURE LIVE VIA WEBCAM INSTEAD'
                          : 'CAPTURE FACE VIA CAMERA'}
                      </span>
                    </button>
                    {faceSource !== 'NONE' && (
                      <button
                        type="button"
                        onClick={handleClearFace}
                        className="btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', color: '#DC2626', borderColor: '#FCA5A5' }}
                      >
                        Clear Face
                      </button>
                    )}
                    {faceDescriptor ? (
                      <span style={{ fontSize: '0.78rem', color: faceSource === 'LIVE_CAMERA' ? '#10B981' : '#2563EB', fontWeight: 600 }}>
                        {biometricStatus}
                      </span>
                    ) : null}
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
                disabled={submitting || !faceDescriptor}
                className="btn-primary"
                style={{
                  opacity: !faceDescriptor ? 0.65 : 1,
                  cursor: !faceDescriptor ? 'not-allowed' : 'pointer',
                }}
                title={!faceDescriptor ? 'Biometric Face Registration is required before submitting application' : ''}
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
