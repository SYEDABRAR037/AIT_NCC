import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import publicRoutes from './routes/public.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import hierarchyRoutes from './routes/hierarchy.routes';
import reviewRoutes from './routes/review.routes';
import leaveRoutes from './routes/leave.routes';
import attendanceRoutes from './routes/attendance.routes';
import certificateRoutes from './routes/certificate.routes';
import notificationRoutes from './routes/notification.routes';
import assistantRoutes from './routes/assistant.routes';
import requestRoutes from './routes/request.routes';
import timelineRoutes from './routes/timeline.routes';
import calendarRoutes from './routes/calendar.routes';
import dutyRoutes from './routes/duty.routes';
import campRoutes from './routes/camp.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

// Security & Middleware
app.use(helmet());

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://ncc-aitpune.netlify.app',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        configuredOrigins.includes(origin) ||
        origin.endsWith('.netlify.app') ||
        origin.endsWith('.aitpune.edu.in') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    system: 'NCC Digital Command & Cadet Management System',
    unit: 'Army Institute of Technology, Pune',
    phase: 13,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/duties', dutyRoutes);
app.use('/api/camps', campRoutes);

// Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server Unhandled Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Institutional Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`[NCC COMMAND SERVER] Running on port ${PORT}`);
});

export default app;
