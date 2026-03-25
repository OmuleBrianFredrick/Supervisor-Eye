export type Role = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'EXECUTIVE' | 'HR' | 'IT_STAFF' | 'MANAGER' | 'SUPERVISOR' | 'WORKER';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
  orgId: string;
  supervisorId?: string;
  status: 'active' | 'pending_approval' | 'inactive';
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  adminId: string;
  createdAt: string;
  settings: {
    gpsEnabled: boolean;
    localStorage: boolean;
  };
}

export interface Report {
  id: string;
  title: string;
  typeId?: string; // Reference to ReportType
  description: string;
  challenges: string;
  pendingTasks: string;
  authorId: string;
  orgId: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'revision_requested';
  attachments: Attachment[];
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: string;
  reviewedBy?: string;
  reviewComment?: string;
  reviewedAt?: string;
  taskId?: string;
  history?: ReportHistory[];
  aiSummary?: string;
  aiAnalysis?: {
    riskLevel: 'low' | 'medium' | 'high';
    anomalies: string[];
    suggestions: string[];
  };
}

export interface ReportType {
  id: string;
  name: string;
  orgId: string;
  locationRequired: boolean;
  description?: string;
}

export interface ReportHistory {
  id: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  action: string;
  details?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  hash?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeIds: string[];
  leadAssigneeId?: string;
  creatorId: string;
  orgId: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'overdue' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  checklist?: TaskChecklistItem[];
  attachments?: Attachment[];
  createdAt: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  orgId: string;
  targetId?: string;
  details: any;
  timestamp: string;
}

export interface Comment {
  id: string;
  parentId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface PublicContent {
  id: string;
  companyName: string;
  description: string;
  activities?: string[];
  news?: { id: string; title: string; content: string; date: string }[];
  gallery?: { id: string; url: string; caption: string }[];
  updatedAt: string;
}
