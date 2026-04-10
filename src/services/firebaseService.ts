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
import { db, auth } from '../firebase';
import { UserProfile, Organization, Report, Task, Notification, AuditLog, Comment, Webhook, ReportHistory, ReportType, PublicContent, WorkflowRule, Feedback } from '../types';

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

// --- Public Content ---
export const getPublicContent = async (): Promise<PublicContent | null> => {
  try {
    const docRef = doc(db, 'publicContent', 'home');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as PublicContent : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'publicContent/home');
    return null;
  }
};

export const updatePublicContent = async (content: Partial<PublicContent>) => {
  try {
    const docRef = doc(db, 'publicContent', 'home');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, { ...content, updatedAt: new Date().toISOString() });
    } else {
      await setDoc(docRef, { 
        ...content, 
        companyName: content.companyName || 'Supervisor Eye',
        description: content.description || 'Hierarchical Reporting & Accountability Platform',
        updatedAt: new Date().toISOString() 
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'publicContent/home');
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

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  try {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
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

export const getOrganizationById = async (orgId: string): Promise<Organization | null> => {
  try {
    const docRef = doc(db, 'organizations', orgId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Organization : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `organizations/${orgId}`);
    return null;
  }
};

export const updateOrganization = async (orgId: string, updates: Partial<Organization>) => {
  try {
    const orgRef = doc(db, 'organizations', orgId);
    await updateDoc(orgRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `organizations/${orgId}`);
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
    await evaluateWorkflows(report.orgId, 'report_submitted', { id: reportRef.id, ...report });
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
export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
  try {
    const taskRef = await addDoc(collection(db, 'tasks'), {
      ...task,
      createdAt: new Date().toISOString()
    });
    await logAudit('task:created', taskRef.id, task.orgId, { title: task.title });
    await evaluateWorkflows(task.orgId, 'task_created', { id: taskRef.id, ...task });
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
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload file to local server');
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error("Local upload failed:", error);
    throw error;
  }
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

export const sendNotification = async (recipientId: string, title: string, message: string, type: string, relatedId?: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      title,
      message,
      type,
      relatedId: relatedId || null,
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

export const reviewReport = async (reportId: string, status: Report['status'], reviewComment: string, reviewerId: string, reviewerName: string, rating?: number) => {
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
      details: reviewComment + (rating ? ` (Rating: ${rating}/5)` : '')
    };

    const updates: Partial<Report> = {
      status,
      reviewComment,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      history: [...history, newHistoryItem]
    };
    
    if (rating !== undefined) {
      updates.rating = rating;
    }

    await updateDoc(reportRef, updates);
    
    await logAudit(`report:${status}`, reportId, reportData.orgId, { reviewComment, rating });
    await triggerWebhooks(reportData.orgId, `report_${status}`, { id: reportId, ...reportData, status, rating });
    
    if (status === 'approved' || status === 'rejected') {
      await evaluateWorkflows(reportData.orgId, `report_${status}`, { id: reportId, ...reportData, status, rating });
    }
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
      if (status === 'completed') {
        await evaluateWorkflows(taskData.orgId, 'task_completed', { id: taskId, ...taskData });
      }
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

export const checkUpcomingDeadlines = async (orgId: string, userId: string) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(db, 'tasks'),
      where('orgId', '==', orgId),
      where('status', 'in', ['pending', 'in_progress']),
      where('deadline', '<=', tomorrow.toISOString()),
      where('deadline', '>=', now.toISOString())
    );

    const snapshot = await getDocs(q);
    for (const doc of snapshot.docs) {
      const task = { id: doc.id, ...doc.data() } as Task;
      
      // Only notify if the user is an assignee
      if (task.assigneeIds.includes(userId)) {
        // Check if a reminder was already sent
        const notifQuery = query(
          collection(db, 'notifications'),
          where('recipientId', '==', userId),
          where('type', '==', 'task_deadline_reminder'),
          where('relatedId', '==', task.id)
        );
        const notifSnapshot = await getDocs(notifQuery);
        
        if (notifSnapshot.empty) {
          await sendNotification(
            userId,
            'Task Deadline Approaching',
            `Task "${task.title}" is due soon (${new Date(task.deadline).toLocaleDateString()}).`,
            'task_deadline_reminder',
            task.id
          );
        }
      }
    }
  } catch (error) {
    console.error('Error checking deadlines:', error);
  }
};

// --- Workflow Rules ---

export const getWorkflowRules = async (orgId: string): Promise<WorkflowRule[]> => {
  try {
    const q = query(collection(db, 'workflowRules'), where('orgId', '==', orgId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowRule));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'workflowRules');
    return [];
  }
};

export const createWorkflowRule = async (ruleData: Omit<WorkflowRule, 'id' | 'createdAt'>): Promise<string | undefined> => {
  try {
    const docRef = await addDoc(collection(db, 'workflowRules'), {
      ...ruleData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'workflowRules');
  }
};

export const updateWorkflowRule = async (ruleId: string, updates: Partial<WorkflowRule>) => {
  try {
    const ruleRef = doc(db, 'workflowRules', ruleId);
    await updateDoc(ruleRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workflowRules/${ruleId}`);
  }
};

export const deleteWorkflowRule = async (ruleId: string) => {
  try {
    const ruleRef = doc(db, 'workflowRules', ruleId);
    await deleteDoc(ruleRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workflowRules/${ruleId}`);
  }
};

export const evaluateWorkflows = async (orgId: string, trigger: WorkflowRule['trigger'], payload: any) => {
  try {
    const rules = await getWorkflowRules(orgId);
    const activeRules = rules.filter(r => r.isActive && r.trigger === trigger);

    for (const rule of activeRules) {
      let conditionsMet = true;
      for (const condition of rule.conditions) {
        const payloadValue = payload[condition.field];
        switch (condition.operator) {
          case 'equals':
            if (payloadValue !== condition.value) conditionsMet = false;
            break;
          case 'not_equals':
            if (payloadValue === condition.value) conditionsMet = false;
            break;
          case 'contains':
            if (typeof payloadValue !== 'string' || !payloadValue.includes(condition.value)) conditionsMet = false;
            break;
          case 'greater_than':
            if (Number(payloadValue) <= Number(condition.value)) conditionsMet = false;
            break;
          case 'less_than':
            if (Number(payloadValue) >= Number(condition.value)) conditionsMet = false;
            break;
        }
      }

      if (conditionsMet) {
        for (const action of rule.actions) {
          try {
            switch (action.type) {
              case 'notify_user':
                await sendNotification(
                  action.config.target,
                  `Workflow: ${rule.name}`,
                  `Triggered by ${trigger}`,
                  'workflow_alert',
                  payload.id
                );
                break;
              case 'create_task':
                await createTask({
                  title: `Automated Task: ${rule.name}`,
                  description: `Triggered by ${trigger} on ${payload.id}`,
                  assigneeIds: [action.config.target],
                  creatorId: 'system',
                  orgId,
                  deadline: new Date(Date.now() + 86400000).toISOString(), // +1 day
                  status: 'pending',
                  priority: 'medium'
                });
                break;
              case 'webhook':
                await fetch(action.config.target, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ event: trigger, payload, rule: rule.name })
                });
                break;
              case 'send_email':
                // In a real app, this would call a cloud function to send an email
                console.log(`Sending email to ${action.config.target} for rule ${rule.name}`);
                break;
              case 'require_approval':
                // Create an approval task for the specified role or user
                await createTask({
                  title: `Approval Required: ${payload.title || payload.id}`,
                  description: `Please review and approve this item. Triggered by workflow: ${rule.name}`,
                  assigneeIds: action.config.target ? [action.config.target] : [],
                  creatorId: 'system',
                  orgId,
                  deadline: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
                  status: 'pending',
                  priority: 'high'
                });
                break;
            }
          } catch (actionError) {
            console.error(`Error executing workflow action ${action.type}:`, actionError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error evaluating workflows:', error);
  }
};

// --- Feedback ---

export const createFeedback = async (feedback: Omit<Feedback, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'feedback'), {
      ...feedback,
      createdAt: new Date().toISOString()
    });
    await logAudit('feedback:created', docRef.id, feedback.orgId, { recipientId: feedback.recipientId, rating: feedback.rating });
    await sendNotification(feedback.recipientId, 'New Feedback Received', `You received new feedback from ${feedback.authorName}.`, 'feedback_received', docRef.id);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'feedback');
  }
};
