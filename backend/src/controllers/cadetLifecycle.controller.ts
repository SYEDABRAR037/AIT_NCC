import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCadetLifecycleHistory, resolvePlatoonSeniorScope } from '../services/cadetLifecycle.service';

const DEACTIVATION_REASONS: Record<string, string> = {
  WITHDRAWN: 'Withdrawn from NCC',
  PASSED_OUT: 'Passed Out',
  TRANSFERRED: 'Transferred',
  LEFT_INSTITUTION: 'Left institution',
  MEDICAL_OTHER: 'Medical/other approved reason',
  OTHER: 'Other',
};

const parseEffectiveDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

export const changeCadetLifecycle = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  if (!['PLATOON_SENIOR', 'ADMIN_ANO'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Only an authorized Platoon Senior or ANO/Admin may manage cadet status' });
    return;
  }

  const { action, reasonCode, otherReason, effectiveDate: effectiveDateValue, remarks: remarksValue } = req.body || {};
  if (!['DEACTIVATE', 'REACTIVATE'].includes(action)) {
    res.status(400).json({ success: false, message: 'Invalid cadet lifecycle action' });
    return;
  }

  const remarks = typeof remarksValue === 'string' ? remarksValue.trim() : '';
  if (remarks.length > 500) {
    res.status(400).json({ success: false, message: 'Remarks must be 500 characters or fewer' });
    return;
  }

  let effectiveDate: Date;
  let reason: string;
  let resolvedReasonCode: string;
  let newStatus: 'ACTIVE' | 'INACTIVE' | 'PASSED_OUT';
  if (action === 'DEACTIVATE') {
    if (typeof reasonCode !== 'string' || !DEACTIVATION_REASONS[reasonCode]) {
      res.status(400).json({ success: false, message: 'Select a deactivation reason' });
      return;
    }
    const otherReasonText = typeof otherReason === 'string' ? otherReason.trim() : '';
    if (reasonCode === 'OTHER' && !otherReasonText) {
      res.status(400).json({ success: false, message: 'Enter a short reason when selecting Other' });
      return;
    }
    if (otherReasonText.length > 200) {
      res.status(400).json({ success: false, message: 'Other reason must be 200 characters or fewer' });
      return;
    }
    const parsedDate = parseEffectiveDate(effectiveDateValue);
    if (!parsedDate) {
      res.status(400).json({ success: false, message: 'Enter a valid effective date' });
      return;
    }
    effectiveDate = parsedDate;
    reason = reasonCode === 'OTHER' ? otherReasonText : DEACTIVATION_REASONS[reasonCode];
    resolvedReasonCode = reasonCode;
    newStatus = reasonCode === 'PASSED_OUT' ? 'PASSED_OUT' : 'INACTIVE';
  } else {
    effectiveDate = parseEffectiveDate(effectiveDateValue) || new Date();
    reason = 'Reactivated by authorized officer';
    resolvedReasonCode = 'REACTIVATED';
    newStatus = 'ACTIVE';
  }

  const cadetId = Array.isArray(req.params.cadetId) ? req.params.cadetId[0] : req.params.cadetId;
  if (!cadetId) {
    res.status(400).json({ success: false, message: 'Cadet ID is required' });
    return;
  }

  try {
    const updatedCadet = await prisma.$transaction(async (tx) => {
      const platoonScope = req.user!.role === 'PLATOON_SENIOR'
        ? await resolvePlatoonSeniorScope(req.user!.id, req.user!.platoonName, tx)
        : null;
      const cadet = await tx.user.findUnique({
        where: { id: cadetId },
        select: { id: true, fullName: true, regimentalNumber: true, role: true, status: true, platoonName: true },
      });
      if (!cadet || cadet.role !== 'CADET') {
        throw Object.assign(new Error('Cadet record not found'), { statusCode: 404 });
      }
      if (platoonScope && !platoonScope.includes(cadet.platoonName)) {
        throw Object.assign(new Error('This cadet is outside your authorized platoon scope'), { statusCode: 403 });
      }

      const allowedPreviousStatuses = action === 'DEACTIVATE'
        ? ['ACTIVE', 'APPROVED']
        : ['INACTIVE', 'PASSED_OUT'];
      if (!allowedPreviousStatuses.includes(cadet.status)) {
        throw Object.assign(new Error(action === 'DEACTIVATE'
          ? 'Only an active cadet can be deactivated'
          : 'Only an inactive or passed-out cadet can be reactivated'), { statusCode: 409 });
      }

      const changed = await tx.user.updateMany({
        where: { id: cadet.id, role: 'CADET', status: cadet.status, platoonName: cadet.platoonName },
        data: { status: newStatus },
      });
      if (changed.count !== 1) {
        throw Object.assign(new Error('Cadet status changed concurrently. Refresh and try again.'), { statusCode: 409 });
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          action: 'CADET_STATUS_CHANGED',
          targetType: 'CADET',
          targetId: cadet.id,
          details: JSON.stringify({
            previousStatus: cadet.status,
            newStatus,
            reasonCode: resolvedReasonCode,
            reason,
            remarks: remarks || null,
            effectiveDate: effectiveDate.toISOString(),
            officerRole: req.user!.role,
          }),
        },
      });

      return { ...cadet, status: newStatus };
    });

    const lifecycleHistory = (await getCadetLifecycleHistory([updatedCadet.id])).get(updatedCadet.id) || [];
    res.json({
      success: true,
      message: `${updatedCadet.fullName} is now ${updatedCadet.status}. Historical records were preserved.`,
      cadet: {
        id: updatedCadet.id,
        fullName: updatedCadet.fullName,
        regimentalNumber: updatedCadet.regimentalNumber,
        status: updatedCadet.status,
        lifecycleHistory,
        statusDetails: ['INACTIVE', 'PASSED_OUT'].includes(updatedCadet.status)
          ? lifecycleHistory.find((event) => event.newStatus === updatedCadet.status) || null
          : null,
      },
    });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode) {
      res.status(statusCode).json({ success: false, message: (error as Error).message });
      return;
    }
    console.error('changeCadetLifecycle error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cadet status' });
  }
};
