import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, X } from 'lucide-react';
import { safeApiFetch } from '../../utils/api';

interface FaceEnrollmentModalProps {
  cadet: {
    id: string;
    fullName: string;
    regimentalNumber: string;
    platoonName?: string;
  };
  token: string;
  onClose: () => void;
  onEnrolled: () => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  cadet,
  token,
  onClose,
  onEnrolled,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Loading face recognition models...');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceSnapshot, setFaceSnapshot] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        if (active) {
          setModelsReady(true);
          setStatusMessage('Models ready. Obtain cadet consent before starting the camera.');
        }
      } catch {
        if (active) setError('Failed to load biometric recognition models.');
      }
    };
    init();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    if (!consent) { setError('Confirm that the cadet consents before activating the camera.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is not available in this browser.'); return; }
    try {
      setError(null);
      setStatusMessage('Requesting camera permission...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = mediaStream;
      const video = videoRef.current;
      if (!video) throw new Error('VIDEO_ELEMENT_UNAVAILABLE');
      video.srcObject = mediaStream;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('VIDEO_METADATA_TIMEOUT')), 8000);
          video.addEventListener('loadedmetadata', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
          video.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error('VIDEO_METADATA_FAILED')); }, { once: true });
        });
      }
      await video.play();
      const deadline = Date.now() + 5000;
      while ((video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (!video.videoWidth || !video.videoHeight) throw new Error('VIDEO_FRAME_UNAVAILABLE');
      setCameraActive(true);
      setStatusMessage('Camera ready. Align one face and choose Capture Face.');
    } catch (err: any) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
      setError(err?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access and retry.'
        : err?.name === 'NotFoundError' ? 'No camera was found on this device.'
          : 'Unable to start the camera or read video frames. Please retry.');
    }
  };

  const captureFace = async () => {
    const video = videoRef.current;
    if (!video || !consent || !modelsReady || !cameraActive || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    setIsCapturing(true);
    setError(null);
    setStatusMessage('Validating one face and extracting a 128-value descriptor...');

    try {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })).withFaceLandmarks(true).withFaceDescriptors();
      if (detections.length !== 1) throw new Error(detections.length === 0 ? 'NO_FACE' : 'MULTIPLE_FACES');
      const detection = detections[0];
      const vector = Array.from(detection.descriptor);
      if (vector.length !== 128 || !vector.every(Number.isFinite) || vector.every((value) => value === 0)) throw new Error('INVALID_DESCRIPTOR');
      if (detection.detection.score < 0.5 || detection.detection.box.width < video.videoWidth * 0.18 || detection.detection.box.height < video.videoHeight * 0.18) throw new Error('LOW_QUALITY');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx || canvas.width < 160 || canvas.height < 160) throw new Error('INVALID_FRAME');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setFaceSnapshot(canvas.toDataURL('image/jpeg', 0.88));
      setDescriptor(vector);
      setQualityScore(Math.max(0, Math.min(1, detection.detection.score)));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraActive(false);
      setStatusMessage('Capture preview ready. Retake or confirm enrollment.');
    } catch (err: any) {
      setError(err?.message === 'NO_FACE' ? 'No face was detected. Align the cadet face and try again.'
        : err?.message === 'MULTIPLE_FACES' ? 'Only one face may be visible during enrollment.'
          : err?.message === 'LOW_QUALITY' ? 'Face image quality is too low. Move closer and improve lighting.'
            : 'The camera frame could not be validated. Try again.');
      setStatusMessage('Capture failed. Adjust the camera and try again.');
      setDescriptor(null);
      setFaceSnapshot(null);
      setQualityScore(null);
    } finally {
      setIsCapturing(false);
    }
  };

  const confirmAndEnroll = async () => {
    if (!consent || !descriptor || descriptor.length !== 128 || !faceSnapshot || qualityScore === null) {
      setError('Capture and review a valid face before confirming enrollment.');
      return;
    }
    setIsCapturing(true);
    setError(null);
    setStatusMessage('Saving the confirmed face descriptor...');
    try {

      // Send to backend
      const { ok, data } = await safeApiFetch('/api/attendance/biometrics/enroll', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({
          cadetId: cadet.id,
          descriptor,
          qualityScore,
        }),
      });

      if (ok && data?.success) {
        setSuccess(true);
        setStatusMessage(`✓ Biometric template enrolled for ${cadet.fullName}`);
        setTimeout(() => {
          onEnrolled();
          onClose();
        }, 1200);
      } else {
        setError(data?.message || 'Enrollment failed');
      }
    } catch {
      setError('Biometric enrollment failed. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const closeEnrollment = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 26, 51, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 1350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--color-background)',
          border: '2px solid var(--navy-primary)',
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--navy-primary)',
            color: 'var(--color-background)',
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', letterSpacing: '0.03em' }}>
              BIOMETRIC FACE ENROLLMENT
            </h4>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-disabled)' }}>
              {cadet.fullName} &bull; {cadet.regimentalNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={closeEnrollment}
            style={{ background: 'none', border: 'none', color: 'var(--color-background)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* CAMERA FEED */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '280px',
              backgroundColor: '#000000',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: faceSnapshot ? 'none' : 'block' }} />
            {faceSnapshot && <img src={faceSnapshot} alt="Captured face preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}

            {/* Target Reticle */}
            <div
              style={{
                position: 'absolute',
                width: '160px',
                height: '200px',
                border: '2px dashed rgba(255, 255, 255, 0.5)',
                borderRadius: '8px',
                pointerEvents: 'none',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.78rem', lineHeight: 1.4, color: 'var(--navy-text)' }}>
            <input type="checkbox" checked={consent} disabled={success} onChange={(event) => {
              setConsent(event.target.checked);
              if (!event.target.checked) {
                streamRef.current?.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
                setCameraActive(false);
                setDescriptor(null);
                setFaceSnapshot(null);
                setQualityScore(null);
              }
            }} />
            <span>I confirm that the cadet has consented to camera capture and enrollment of a face descriptor. The camera image is used for preview only and is not uploaded or stored.</span>
          </label>

          {/* STATUS PILL */}
          <div
            style={{
              backgroundColor: success ? 'var(--color-success-soft)' : error ? 'var(--color-error-soft)' : 'var(--color-surface)',
              border: `1px solid ${success ? 'var(--color-success)' : error ? 'var(--color-error)' : 'var(--white-border)'}`,
              borderRadius: '4px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8rem',
              color: success ? 'var(--color-success)' : error ? 'var(--color-error)' : 'var(--navy-text)',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            {statusMessage}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={closeEnrollment} className="btn-secondary btn-sm">
              Cancel
            </button>
            {cameraActive ? (
              <button type="button" disabled={isCapturing || success} onClick={captureFace} className="btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Camera size={15} /><span>{isCapturing ? 'Processing...' : 'Capture Face'}</span>
              </button>
            ) : descriptor && faceSnapshot ? (
              <>
                <button type="button" disabled={isCapturing || success || !consent} onClick={() => { setDescriptor(null); setFaceSnapshot(null); setQualityScore(null); startCamera(); }} className="btn-secondary btn-sm">Retake</button>
                <button type="button" disabled={isCapturing || success || !consent} onClick={confirmAndEnroll} className="btn-primary btn-sm">
                  {isCapturing ? 'Saving...' : 'Confirm and Enroll'}
                </button>
              </>
            ) : (
              <button type="button" disabled={!consent || !modelsReady || isCapturing || success} onClick={startCamera} className="btn-primary btn-sm">
                <Camera size={15} /> Start Camera
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
