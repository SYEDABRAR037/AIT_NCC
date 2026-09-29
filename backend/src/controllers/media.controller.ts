import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';

const ranks = ['SUO', 'JUO', 'CSM', 'CQMH', 'SGT', 'CPL', 'LCPL'];
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const validImageFile = (file: Express.Multer.File): boolean => {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
};

const photoUrl = (id: string) => `/api/public/gallery/${id}/image`;
const rankUrl = (id: string) => `/api/public/rank-holders/${id}/image`;

export const listPublicGallery = async (_req: Request, res: Response): Promise<void> => {
  try {
    const photos = await prisma.galleryPhoto.findMany({
      where: { isPublished: true }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, category: true, altText: true },
    });
    res.json({ success: true, photos: photos.map((photo) => ({ ...photo, imageUrl: photoUrl(photo.id) })) });
  } catch { res.status(500).json({ success: false, message: 'Unable to load photo archives.' }); }
};

export const getGalleryImage = async (req: Request, res: Response): Promise<void> => {
  const photo = await prisma.galleryPhoto.findUnique({ where: { id: String(req.params.id) } });
  if (!photo || !photo.isPublished) { res.sendStatus(404); return; }
  res.setHeader('Content-Type', photo.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(Buffer.from(photo.image));
};

export const listManagedGallery = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const photos = await prisma.galleryPhoto.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true, category: true, altText: true, mimeType: true, isPublished: true, createdAt: true } });
    res.json({ success: true, photos: photos.map((photo) => ({ ...photo, imageUrl: photoUrl(photo.id) })) });
  } catch { res.status(500).json({ success: false, message: 'Unable to load managed photos.' }); }
};

export const createGalleryPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file;
  const title = String(req.body.title || '').trim();
  const altText = String(req.body.altText || '').trim();
  if (!file || !allowedMime.has(file.mimetype) || !validImageFile(file) || !title || !altText) {
    res.status(400).json({ success: false, message: 'Provide a JPEG, PNG, or WebP photo, title, and description.' }); return;
  }
  const id = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.galleryPhoto.create({ data: { id, title, category: String(req.body.category || 'NCC').slice(0, 80), altText, image: Uint8Array.from(file.buffer), mimeType: file.mimetype, isPublished: req.body.isPublished === 'true', createdById: req.user!.id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: 'GALLERY_PHOTO_CREATED', targetType: 'GALLERY_PHOTO', targetId: id, details: JSON.stringify({ title }) } });
  });
  res.status(201).json({ success: true, photo: { id, title, category: String(req.body.category || 'NCC'), altText, imageUrl: photoUrl(id), isPublished: req.body.isPublished === 'true' } });
};

export const updateGalleryPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.galleryPhoto.findUnique({ where: { id }, select: { id: true } });
  if (!existing) { res.sendStatus(404); return; }
  const title = String(req.body.title || '').trim();
  const altText = String(req.body.altText || '').trim();
  if (!title || !altText || (req.file && (!allowedMime.has(req.file.mimetype) || !validImageFile(req.file)))) { res.status(400).json({ success: false, message: 'Valid title, description, and JPEG/PNG/WebP photo are required.' }); return; }
  await prisma.$transaction(async (tx) => {
    await tx.galleryPhoto.update({ where: { id }, data: { title, altText, category: String(req.body.category || 'NCC').slice(0, 80), isPublished: req.body.isPublished === 'true', ...(req.file ? { image: Uint8Array.from(req.file.buffer), mimeType: req.file.mimetype } : {}) } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: 'GALLERY_PHOTO_UPDATED', targetType: 'GALLERY_PHOTO', targetId: id, details: JSON.stringify({ title }) } });
  });
  res.json({ success: true, message: 'Photo saved.' });
};

export const deleteGalleryPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  const photo = await prisma.galleryPhoto.findUnique({ where: { id: String(req.params.id) }, select: { id: true, title: true } });
  if (!photo) { res.sendStatus(404); return; }
  await prisma.$transaction(async (tx) => {
    await tx.galleryPhoto.delete({ where: { id: photo.id } });
    await tx.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: 'GALLERY_PHOTO_DELETED', targetType: 'GALLERY_PHOTO', targetId: photo.id, details: JSON.stringify({ title: photo.title }) } });
  });
  res.json({ success: true });
};

export const listPublicRankHolders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const holders = await prisma.rankHolder.findMany({ where: { isActive: true, name: { not: null }, image: { not: null } }, orderBy: { sortOrder: 'asc' }, select: { id: true, rank: true, name: true } });
    res.json({ success: true, holders: holders.map((holder) => ({ ...holder, imageUrl: rankUrl(holder.id) })) });
  } catch { res.status(500).json({ success: false, message: 'Unable to load rank holders.' }); }
};

export const getRankHolderImage = async (req: Request, res: Response): Promise<void> => {
  const holder = await prisma.rankHolder.findUnique({ where: { id: String(req.params.id) } });
  if (!holder?.isActive || !holder.name || !holder.image || !holder.mimeType) { res.sendStatus(404); return; }
  res.setHeader('Content-Type', holder.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(Buffer.from(holder.image));
};

export const manageRankHolder = async (req: AuthRequest, res: Response): Promise<void> => {
  const rank = String(req.body.rank || '').trim().toUpperCase();
  if (!ranks.includes(rank)) { res.status(400).json({ success: false, message: 'Select a valid NCC cadet appointment.' }); return; }
  const name = String(req.body.name || '').trim() || null;
  const active = req.body.isActive === 'true';
  if (active && (!name || (!req.file && !String(req.params.id)))) { res.status(400).json({ success: false, message: 'An active rank holder needs a real name and photograph.' }); return; }
  if (req.file && (!allowedMime.has(req.file.mimetype) || !validImageFile(req.file))) { res.status(400).json({ success: false, message: 'Upload a JPEG, PNG, or WebP photo.' }); return; }
  const existing = await prisma.rankHolder.findUnique({ where: { rank } });
  const holder = await prisma.rankHolder.upsert({ where: { rank }, create: { rank, name, isActive: active, sortOrder: ranks.indexOf(rank), ...(req.file ? { image: Uint8Array.from(req.file.buffer), mimeType: req.file.mimetype } : {}) }, update: { name, isActive: active, sortOrder: ranks.indexOf(rank), ...(req.file ? { image: Uint8Array.from(req.file.buffer), mimeType: req.file.mimetype } : {}) } });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, actorName: req.user!.fullName, action: existing ? 'RANK_HOLDER_UPDATED' : 'RANK_HOLDER_CREATED', targetType: 'RANK_HOLDER', targetId: holder.id, details: JSON.stringify({ rank, isActive: active }) } });
  res.json({ success: true, holder: { id: holder.id, rank: holder.rank, name: holder.name, isActive: holder.isActive } });
};

export const getInstitutionalInfo = async (_req: Request, res: Response): Promise<void> => {
  try {
    const info = await prisma.institutionalInfo.findUnique({ where: { id: 'main' }, select: { address: true, email: true, phone: true, timings: true, updatedAt: true } });
    res.json({ success: true, info });
  } catch { res.status(500).json({ success: false, message: 'Unable to load institutional information.' }); }
};

export const updateInstitutionalInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  const clean = (key: string) => String(req.body[key] || '').trim().slice(0, 500) || null;
  const info = await prisma.institutionalInfo.upsert({ where: { id: 'main' }, create: { id: 'main', address: clean('address'), email: clean('email'), phone: clean('phone'), timings: clean('timings'), updatedById: req.user!.id }, update: { address: clean('address'), email: clean('email'), phone: clean('phone'), timings: clean('timings'), updatedById: req.user!.id } });
  res.json({ success: true, info: { address: info.address, email: info.email, phone: info.phone, timings: info.timings, updatedAt: info.updatedAt } });
};
