import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Webhook delivery function
async function deliverWebhook(url: string, event: string, payload: any) {
  try {
    await axios.post(url, {
      event,
      timestamp: new Date().toISOString(),
      data: payload
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SupervisorEye-Webhook-Agent/1.0'
      },
      timeout: 5000
    });
    console.log(`Webhook delivered to ${url} for event ${event}`);
  } catch (error) {
    console.error(`Webhook delivery failed to ${url}:`, error instanceof Error ? error.message : error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  app.use(cors());
  app.use(express.json());

  // Simple in-memory cache (replace with Redis in production)
  const cache = new Map<string, { data: any; expiry: number }>();

  const getCachedData = (key: string) => {
    const cached = cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    cache.delete(key);
    return null;
  };

  const setCachedData = (key: string, data: any, ttlSeconds = 60) => {
    cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
  };

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    const cachedStatus = getCachedData('health_status');
    if (cachedStatus) {
      return res.json({ status: "ok", cached: true, ...cachedStatus });
    }
    
    const status = { timestamp: new Date().toISOString() };
    setCachedData('health_status', status, 10); // Cache for 10 seconds
    res.json({ status: "ok", cached: false, ...status });
  });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });
  const upload = multer({ storage });

  // API Routes
  // Audit Log Endpoint
  app.post("/api/audit", async (req, res) => {
    const { action, actorId, orgId, details } = req.body;
    console.log(`[AUDIT] ${new Date().toISOString()} - ${actorId} in ${orgId}: ${action}`, details);
    // In a real app, we'd save this to Firestore or a dedicated logging service
    res.status(201).json({ success: true });
  });

  // Webhook Trigger Endpoint
  app.post("/api/webhooks/trigger", async (req, res) => {
    const { orgId, event, payload, webhooks } = req.body;
    
    if (!webhooks || !Array.isArray(webhooks)) {
      return res.status(400).json({ error: 'No webhooks provided' });
    }

    // Filter webhooks for this event
    const activeWebhooks = webhooks.filter((w: any) => w.active && w.events.includes(event));
    
    // Deliver asynchronously
    activeWebhooks.forEach((webhook: any) => {
      deliverWebhook(webhook.url, event, payload);
    });

    res.json({ status: 'queued', count: activeWebhooks.length });
  });

  // File Upload Endpoint (Local Storage Adapter)
  app.post("/api/upload", upload.single('file'), (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });
  });

  // Serve uploads statically
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.post("/api/email", async (req, res) => {
    const { name, email, subject, message } = req.body;
    
    // Import dynamically to avoid top-level issues if not installed
    try {
      const nodemailer = (await import('nodemailer')).default;
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_USER || '"Supervisor Eye Contact Form" <noreply@supervisoreye.com>',
        to: process.env.DEVELOPER_EMAIL || 'omulebrianfredrick@gmail.com',
        subject: `New Inquiry: ${subject}`,
        text: `You have received a new inquiry from the platform contact form.\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `<p>You have received a new inquiry from the platform contact form.</p><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>`,
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log("=============================");
        console.log("Mock Email Sent (SMTP credentials not configured):");
        console.log("To:", mailOptions.to);
        console.log("From:", mailOptions.from);
        console.log("Subject:", mailOptions.subject);
        console.log("Message:", mailOptions.text);
        console.log("=============================");
      } else {
        await transporter.sendMail(mailOptions);
        console.log("Email notification sent successfully.");
      }

      res.status(200).json({ success: true, message: "Notification sent." });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email notification." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Supervisor Eye Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
