import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { notifyCertificateIssued } from '../services/notification.service';

// ============================================================
// PHASE 11: DIGITAL CERTIFICATE VAULT & VERIFICATION CONTROLLER
// ============================================================

// 1. Issue a Digital Certificate (ADMIN_ANO only)
export const issueCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const {
      cadetId,
      certificateType,
      title,
      grade,
      campName,
      remarks,
      issuedBy,
      issuingUnit,
    } = req.body;

    if (!cadetId || !certificateType || !title) {
      res.status(400).json({ success: false, message: 'Cadet ID, certificate type, and title are required' });
      return;
    }

    const cadet = await prisma.user.findUnique({
      where: { id: String(cadetId) },
      select: { id: true, fullName: true, regimentalNumber: true, email: true, phone: true, status: true },
    });

    if (!cadet) {
      res.status(404).json({ success: false, message: 'Cadet not found' });
      return;
    }

    // Generate unique institutional certificate serial number
    const year = new Date().getFullYear();
    const typeCode = certificateType.includes('A') ? 'A' : certificateType.includes('B') ? 'B' : certificateType.includes('C') ? 'C' : 'CAMP';
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const certificateNo = `NCC/MAH/2BN/${year}/${typeCode}-${randomSuffix}`;

    // Cryptographic verification hash (SHA-256)
    const verificationPayload = `${certificateNo}|${cadet.regimentalNumber}|${cadet.fullName}|${certificateType}|${grade || 'A'}|${Date.now()}`;
    const verificationHash = crypto.createHash('sha256').update(verificationPayload).digest('hex').toUpperCase();

    const certificate = await prisma.certificate.create({
      data: {
        certificateNo,
        verificationHash,
        cadetId: cadet.id,
        certificateType: String(certificateType),
        title: String(title).trim(),
        grade: grade ? String(grade).toUpperCase() : 'A',
        issuingUnit: issuingUnit ? String(issuingUnit).trim() : '2 Maharashtra Battalion NCC, Pune',
        institution: 'Army Institute of Technology, Pune',
        issuedBy: issuedBy ? String(issuedBy).trim() : 'Lt. Col. R.K. Sharma, ANO Command',
        campName: campName ? String(campName).trim() : null,
        remarks: remarks ? String(remarks).trim() : null,
        status: 'VALID',
      },
      include: {
        cadet: {
          select: {
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            branch: true,
            year: true,
            platoonName: true,
          },
        },
      },
    });

    // Dispatch notification to cadet via in-app, email, and SMS
    notifyCertificateIssued(cadet, {
      certificateNo,
      title: certificate.title,
      grade: certificate.grade,
      verificationHash,
    }).catch((err) => console.error('Certificate notification dispatch error:', err));

    res.status(201).json({
      success: true,
      message: `Digital Certificate ${certificateNo} successfully issued to ${cadet.fullName}.`,
      certificate,
    });
  } catch (error) {
    console.error('issueCertificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to issue digital certificate' });
  }
};

// 2. Cadet views their own certificates (CADET, SENIOR, PLATOON_SENIOR)
export const getMyCertificates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const certificates = await prisma.certificate.findMany({
      where: { cadetId: req.user.id },
      include: {
        cadet: {
          select: {
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            branch: true,
            year: true,
            platoonName: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    res.json({
      success: true,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    console.error('getMyCertificates error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve cadet certificates' });
  }
};

// 3. ANO / Admin views all issued certificates
export const getAllCertificates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const certificates = await prisma.certificate.findMany({
      include: {
        cadet: {
          select: {
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            branch: true,
            year: true,
            platoonName: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    console.error('getAllCertificates error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve certificates' });
  }
};

// 4. Revoke a Certificate (ADMIN_ANO only)
export const revokeCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const cert = await prisma.certificate.update({
      where: { id: String(id) },
      data: {
        status: 'REVOKED',
        remarks: remarks ? String(remarks) : 'Revoked by ANO Institutional Command',
      },
    });

    res.json({
      success: true,
      message: `Certificate ${cert.certificateNo} has been revoked.`,
      certificate: cert,
    });
  } catch (error) {
    console.error('revokeCertificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke certificate' });
  }
};

// 5. Public Certificate Verification (PUBLIC ACCESS)
export const verifyCertificatePublic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.params;
    const cleanQuery = String(query).trim().toUpperCase();

    const certificate = await prisma.certificate.findFirst({
      where: {
        OR: [
          { certificateNo: cleanQuery },
          { verificationHash: cleanQuery },
        ],
      },
      include: {
        cadet: {
          select: {
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            branch: true,
            year: true,
            platoonName: true,
          },
        },
      },
    });

    if (!certificate) {
      res.status(404).json({
        success: false,
        valid: false,
        message: 'No institutional certificate found matching this serial number or cryptographic hash.',
      });
      return;
    }

    res.json({
      success: true,
      valid: certificate.status === 'VALID',
      certificate: {
        certificateNo: certificate.certificateNo,
        verificationHash: certificate.verificationHash,
        title: certificate.title,
        certificateType: certificate.certificateType,
        grade: certificate.grade,
        cadetName: certificate.cadet.fullName,
        regimentalNumber: certificate.cadet.regimentalNumber,
        collegeRollNumber: certificate.cadet.collegeRollNumber,
        platoon: certificate.cadet.platoonName,
        issuingUnit: certificate.issuingUnit,
        institution: certificate.institution,
        issuedBy: certificate.issuedBy,
        issueDate: certificate.issueDate,
        status: certificate.status,
        campName: certificate.campName,
        remarks: certificate.remarks,
      },
      verificationAuthority: 'National Cadet Corps (NCC) · 2 Maharashtra Battalion, Pune',
      digitalSeal: 'VERIFIED_GENUINE_DIRECTORATE_RECORD',
    });
  } catch (error) {
    console.error('verifyCertificatePublic error:', error);
    res.status(500).json({ success: false, message: 'Verification query failed' });
  }
};
