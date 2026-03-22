import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, Organization, Report, Task, Notification, AuditLog, Comment, Webhook, ReportHistory, ReportType } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Auth Helpers ---
export const sendPasswordReset = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password Reset Error:', error);
    throw error;
  }
};

// --- User Profile ---
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as UserProfile : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
};

export const createUserProfile = async (profile: UserProfile) => {
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);
    await logAudit('user:created', profile.uid, profile.orgId, { email: profile.email });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${profile.uid}`);
  }
};

// --- Organizations ---
export const createOrganization = async (org: Omit<Organization, 'id'>) => {
  try {
    const orgRef = await addDoc(collection(db, 'organizations'), org);
    await logAudit('org:created', orgRef.id, orgRef.id, { name: org.name });
    return orgRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'organizations');
  }
};

export const getOrganizationByCode = async (code: string): Promise<Organization | null> => {
  try {
    const q = query(collection(db, 'organizations'), where('code', '==', code));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Organization;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'organizations');
    return null;
  }
};

// --- Reports ---
export const submitReport = async (report: Omit<Report, 'id'>) => {
  try {
    const reportRef = await addDoc(collection(db, 'reports'), {
      ...report,
      createdAt: new Date().toISOString()
    });
    await logAudit('report:submitted', reportRef.id, report.orgId, { title: report.title });
    return reportRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'reports');
  }
};

export const subscribeToReports = (orgId: string, callback: (reports: Report[]) => void, filters?: any) => {
  let q = query(collection(db, 'reports'), where('orgId', '==', orgId), orderBy('createdAt', 'desc'));
  
  if (filters?.authorId) {
    q = query(q, where('authorId', '==', filters.authorId));
  }
  
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
    callback(reports);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'reports'));
};

// --- Report Types ---
export const createReportType = async (type: Omit<ReportType, 'id'>) => {
  try {
    const typeRef = await addDoc(collection(db, 'reportTypes'), type);
    await logAudit('reportType:created', typeRef.id, type.orgId, { name: type.name });
    return typeRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'reportTypes');
  }
};

export const subscribeToReportTypes = (orgId: string, callback: (types: ReportType[]) => void) => {
  const q = query(collection(db, 'reportTypes'), where('orgId', '==', orgId));
  return onSnapshot(q, (snapshot) => {
    const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReportType));
    callback(types);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'reportTypes'));
};

// --- Tasks ---
export const createTask = async (task: Omit<Task, 'id'>) => {
  try {
    const taskRef = await addDoc(collection(db, 'tasks'), {
      ...task,
      createdAt: new Date().toISOString()
    });
    await logAudit('task:created', taskRef.id, task.orgId, { title: task.title });
    return taskRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tasks');
  }
};

export const subscribeToTasks = (orgId: string, callback: (tasks: Task[]) => void, filters?: any) => {
  let q = query(collection(db, 'tasks'), where('orgId', '==', orgId), orderBy('createdAt', 'desc'));
  
  if (filters?.assigneeId) {
    q = query(q, where('assigneeIds', 'array-contains', filters.assigneeId));
  }
  
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    callback(tasks);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));
};

// --- Files ---
export const uploadFile = async (file: File, path: string) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// --- Audit & Notifications ---
export const logAudit = async (action: string, targetId: string, orgId: string, details: any) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      actorId: auth.currentUser?.uid || 'system',
      orgId,
      targetId,
      details,
      timestamp: new Date().toISOString()
    });
    
    // Also log to backend for external monitoring
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, actorId: auth.currentUser?.uid, orgId, details })
    }).catch(console.error);
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

export const sendNotification = async (recipientId: string, title: string, message: string, type: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Notification Error:', error);
  }
};

// --- AI Integration ---
export const updateReportAI = async (reportId: string, aiSummary: string, aiAnalysis: any) => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      aiSummary,
      aiAnalysis,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
};

export const reviewReport = async (reportId: string, status: Report['status'], reviewComment: string, reviewerId: string, reviewerName: string) => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) return;
    
    const reportData = reportSnap.data() as Report;
    const history = reportData.history || [];
    const newHistoryItem: ReportHistory = {
      id: Math.random().toString(36).substring(7),
      updatedAt: new Date().toISOString(),
      updatedBy: reviewerId,
      updatedByName: reviewerName,
      action: `status_change:${status}`,
      details: reviewComment
    };

    await updateDoc(reportRef, {
      status,
      reviewComment,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      history: [...history, newHistoryItem]
    });
    
    await logAudit(`report:${status}`, reportId, reportData.orgId, { reviewComment });
    await triggerWebhooks(reportData.orgId, `report_${status}`, { id: reportId, ...reportData, status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
};

export const updateReport = async (reportId: string, updates: Partial<Report>) => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) return;
    
    const reportData = reportSnap.data() as Report;
    const history = reportData.history || [];
    const newHistoryItem: ReportHistory = {
      id: Math.random().toString(36).substring(7),
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.uid || 'system',
      updatedByName: auth.currentUser?.displayName || 'User',
      action: 'report_updated',
      details: 'Report content updated by author'
    };

    await updateDoc(reportRef, {
      ...updates,
      status: 'submitted', // Reset to submitted after update
      updatedAt: new Date().toISOString(),
      history: [...history, newHistoryItem]
    });
    
    await logAudit('report:updated', reportId, reportData.orgId, {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
};

export const updateTaskStatus = async (taskId: string, status: Task['status']) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, {
      status,
      updatedAt: new Date().toISOString()
    });
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();
      await logAudit(`task:${status}`, taskId, taskData.orgId, {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
  }
};

export const updateTaskChecklist = async (taskId: string, checklist: Task['checklist']) => {
  try {
    const taskRef = doc(db, 'tasks', taskId);
    await updateDoc(taskRef, {
      checklist,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
  }
};

// --- Comments ---
export const addComment = async (parentId: string, authorId: string, authorName: string, text: string) => {
  try {
    await addDoc(collection(db, 'comments'), {
      parentId,
      authorId,
      authorName,
      text,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'comments');
  }
};

export const subscribeToComments = (parentId: string, callback: (comments: Comment[]) => void) => {
  const q = query(
    collection(db, 'comments'),
    where('parentId', '==', parentId),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
    callback(comments);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'comments'));
};

export const triggerWebhooks = async (orgId: string, event: string, payload: any) => {
  try {
    // Fetch active webhooks for the org
    const webhooksSnap = await getDocs(query(collection(db, 'webhooks'), where('orgId', '==', orgId), where('active', '==', true)));
    const webhooks = webhooksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Webhook));
    
    if (webhooks.length === 0) return;

    // Call our backend to deliver webhooks
    await fetch('/api/webhooks/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, event, payload, webhooks })
    });
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
};
