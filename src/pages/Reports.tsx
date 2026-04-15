import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  MoreVertical,
  Download,
  Eye,
  Paperclip,
  MapPin,
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  CheckSquare,
  RefreshCw,
  Loader2,
  ChevronRight,
  Star
} from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  getUserProfile, 
  subscribeToReports, 
  subscribeToTasks,
  submitReport, 
  uploadFile,
  logAudit,
  sendNotification,
  updateReportAI,
  triggerWebhooks,
  reviewReport,
  updateReport,
  subscribeToReportTypes,
  createReportType
} from '../services/firebaseService';
import { UserProfile, Report, Attachment, Task, ReportHistory, ReportType } from '../types';
import { format } from 'date-fns';
import { calculateHash } from '../utils/crypto';
import { summarizeReport, analyzeReport, analyzeImage, textToSpeech } from '../services/aiService';
import CommentSection from '../components/CommentSection';
import { doc, updateDoc, query, collection, where, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(true);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challenges, setChallenges] = useState('');
  const [pendingTasks, setPendingTasks] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isListening, setIsListening] = useState<string | null>(null);
  const [isDraftingWithAI, setIsDraftingWithAI] = useState(false);
  const [aiDraftTranscript, setAiDraftTranscript] = useState('');

  const handleDraftWithAI = async (transcript: string) => {
    setIsDraftingWithAI(true);
    try {
      const prompt = `
        You are an AI assistant that structures raw voice transcripts into formal work reports.
        Extract the following fields from the transcript. If a field is not mentioned, leave it empty.
        Respond ONLY with a JSON object in this exact format:
        {
          "title": "A concise title",
          "description": "The main body of the report",
          "challenges": "Any issues or challenges mentioned",
          "pendingTasks": "Any next steps or pending tasks mentioned"
        }

        Transcript: "${transcript}"
      `;
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);
      if (result.title) setTitle(result.title);
      if (result.description) setDescription(result.description);
      if (result.challenges) setChallenges(result.challenges);
      if (result.pendingTasks) setPendingTasks(result.pendingTasks);
      
    } catch (error) {
      console.error("Error drafting with AI:", error);
      alert("Failed to process voice draft. Please try again.");
    } finally {
      setIsDraftingWithAI(false);
      setAiDraftTranscript('');
    }
  };

  const startAIDrafting = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onstart = () => setIsListening('ai_draft');
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setAiDraftTranscript(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(null);
    };

    recognition.onend = () => {
      setIsListening(null);
      if (finalTranscript.trim()) {
        handleDraftWithAI(finalTranscript.trim());
      }
    };

    // We'll stop it manually via a button
    (window as any).currentRecognition = recognition;
    recognition.start();
  };

  const stopAIDrafting = () => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
    }
  };
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeLocationRequired, setNewTypeLocationRequired] = useState(false);
  const [analyzingImageId, setAnalyzingImageId] = useState<string | null>(null);
  const [imageAnalysisResult, setImageAnalysisResult] = useState<Record<string, string>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [submissionStep, setSubmissionStep] = useState(1);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'uploading' | 'submitting' | 'analyzing' | 'success' | 'error'>('idle');

  const handleListen = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const base64 = await textToSpeech(text);
      if (base64) {
        const audio = new Audio(`data:audio/mp3;base64,${base64}`);
        audio.onended = () => setIsSpeaking(false);
        audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS error:", error);
      setIsSpeaking(false);
    }
  };

  const handleAnalyzeImage = async (file: Attachment) => {
    if (!file.url.match(/\.(jpg|jpeg|png|webp)$/i)) return;
    setAnalyzingImageId(file.id);
    try {
      // Fetch image and convert to base64
      const response = await fetch(file.url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const analysis = await analyzeImage(base64data, blob.type, "Analyze this evidence photo for a work report. What do you see? Are there any issues?");
        setImageAnalysisResult(prev => ({ ...prev, [file.id]: analysis }));
        setAnalyzingImageId(null);
      };
    } catch (error) {
      console.error("Image analysis error:", error);
      setAnalyzingImageId(null);
    }
  };

  const openEditModal = (report: Report) => {
    setTitle(report.title);
    setDescription(report.description);
    setChallenges(report.challenges || '');
    setPendingTasks(report.pendingTasks || '');
    setSelectedTaskId(report.taskId || '');
    setSelectedTypeId(report.typeId || '');
    setIsEditing(true);
    setEditingReportId(report.id);
    setIsModalOpen(true);
    setSelectedReport(null); // Close detail view
  };

  const startListening = (field: string) => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(field);
    recognition.onend = () => setIsListening(null);
    recognition.onerror = () => setIsListening(null);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (field === 'description') setDescription(prev => prev + ' ' + transcript);
      if (field === 'challenges') setChallenges(prev => prev + ' ' + transcript);
      if (field === 'pendingTasks') setPendingTasks(prev => prev + ' ' + transcript);
    };

    recognition.start();
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const reportId = searchParams.get('reportId');
    if (reportId && reports.length > 0) {
      const report = reports.find(r => r.id === reportId);
      if (report) {
        setSelectedReport(report);
        // Clear the URL parameters
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [reports]);

  useEffect(() => {
    let unsubReports: (() => void) | undefined;
    let unsubTasks: (() => void) | undefined;
    let unsubTypes: (() => void) | undefined;
    let unsubTeam: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.uid);
        setUser(profile);
        if (profile) {
          unsubReports = subscribeToReports(profile.orgId, (data) => {
            setReports(data);
            setLoading(false);
          }, profile.role === 'WORKER' ? { authorId: profile.uid } : undefined);

          unsubTasks = subscribeToTasks(profile.orgId, (data) => {
            setUserTasks(data.filter(t => t.status !== 'completed'));
          }, profile.role === 'WORKER' ? { assigneeId: profile.uid } : undefined);

          unsubTypes = subscribeToReportTypes(profile.orgId, setReportTypes);

          // Fetch team members for author filtering
          const q = query(collection(db, 'users'), where('orgId', '==', profile.orgId), where('status', '==', 'active'));
          unsubTeam = onSnapshot(q, (snapshot) => {
            setTeamMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
          });
        }
      } else {
        if (unsubReports) unsubReports();
        if (unsubTasks) unsubTasks();
        if (unsubTypes) unsubTypes();
        if (unsubTeam) unsubTeam();
        setUser(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubReports) unsubReports();
      if (unsubTasks) unsubTasks();
      if (unsubTypes) unsubTypes();
      if (unsubTeam) unsubTeam();
    };
  }, []);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTypeName) return;
    await createReportType({
      name: newTypeName,
      orgId: user.orgId,
      locationRequired: newTypeLocationRequired
    });
    setNewTypeName('');
    setNewTypeLocationRequired(false);
    setIsTypeModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const selectedType = reportTypes.find(t => t.id === selectedTypeId);
    let location: { latitude: number; longitude: number } | undefined;

    if (selectedType?.locationRequired) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
      } catch (error) {
        alert('Location is required for this report type. Please enable GPS.');
        return;
      }
    } else {
      // Optional location
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
      } catch (error) {
        console.warn('Location capture failed (optional)');
      }
    }

    setSubmitting(true);

    try {
      const attachments: Attachment[] = [];
      for (const file of files) {
        const hash = await calculateHash(file);
        const url = await uploadFile(file, `reports/${user.orgId}/${Date.now()}-${file.name}`);
        attachments.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          hash
        });
      }

      const reportData: Omit<Report, 'id'> = {
        title,
        typeId: selectedTypeId || undefined,
        description,
        challenges,
        pendingTasks,
        authorId: user.uid,
        orgId: user.orgId,
        status: 'submitted',
        attachments,
        location,
        taskId: selectedTaskId || undefined,
        createdAt: new Date().toISOString()
      };

      let reportId: string | undefined;

      if (isEditing && editingReportId) {
        await updateReport(editingReportId, {
          title,
          typeId: selectedTypeId || undefined,
          description,
          challenges,
          pendingTasks,
          taskId: selectedTaskId || undefined,
          attachments: attachments.length > 0 ? attachments : undefined
        });
        reportId = editingReportId;
      } else {
        reportId = await submitReport(reportData);
      }

      if (reportId) {
        setSubmissionStatus('analyzing');
        // Trigger AI Analysis in background
        const fullReport = { id: reportId, ...reportData } as Report;
        summarizeReport(fullReport).then(async (summary) => {
          const analysis = await analyzeReport(fullReport);
          await updateReportAI(reportId!, summary, analysis);
        }).catch(console.error);

        // Trigger Webhooks
        triggerWebhooks(user.orgId, isEditing ? 'report_updated' : 'report_submitted', fullReport);
      }

      // Notify supervisor
      if (user.supervisorId) {
        await sendNotification(
          user.supervisorId,
          isEditing ? 'Report Resubmitted' : 'New Report Submitted',
          `${user.displayName} ${isEditing ? 'resubmitted' : 'submitted'} a report: ${title}`,
          isEditing ? 'report_updated' : 'report_submitted'
        );
      }

      setSubmissionStatus('success');
      setTimeout(() => {
        setIsModalOpen(false);
        setIsEditing(false);
        setEditingReportId(null);
        setTitle('');
        setDescription('');
        setChallenges('');
        setPendingTasks('');
        setFiles([]);
        setSelectedTaskId('');
        setSelectedTypeId('');
        setSubmissionStep(1);
        setSubmissionStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      setSubmissionStatus('error');
    }
  };

  const handleReview = async (status: Report['status']) => {
    if (!selectedReport || !user) return;
    setIsReviewing(true);
    try {
      await reviewReport(selectedReport.id, status, reviewComment, user.uid, user.displayName, reviewRating > 0 ? reviewRating : undefined);
      
      // Notify author
      await sendNotification(
        selectedReport.authorId,
        `Report ${status.replace('_', ' ')}`,
        `Your report "${selectedReport.title}" has been ${status.replace('_', ' ')}.`,
        `report_${status}`
      );

      setSelectedReport(null);
      setReviewComment('');
      setReviewRating(0);
    } catch (error) {
      console.error('Error reviewing report:', error);
    } finally {
      setIsReviewing(false);
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || 
                         r.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchesType = filterType === 'all' || r.typeId === filterType;
    const matchesAuthor = filterAuthor === 'all' || r.authorId === filterAuthor;
    return matchesSearch && matchesStatus && matchesType && matchesAuthor;
  });

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleExport = () => {
    window.print();
  };

  const handleDownloadPDF = (report: Report) => {
    // For a real PDF generation, we'd use a library like jsPDF or a server-side route.
    // Here we'll use a simplified approach that triggers a print of just the report details.
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const authorName = teamMembers.find(m => m.uid === report.authorId)?.displayName || 'Unknown';
    const typeName = reportTypes.find(t => t.id === report.typeId)?.name || 'General';

    printWindow.document.write(`
      <html>
        <head>
          <title>Report: ${report.title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin: 0; }
            .meta { font-size: 14px; color: #64748b; margin-top: 8px; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #475569; }
            .content { font-size: 14px; line-height: 1.6; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status-submitted { background: #dbeafe; color: #1d4ed8; }
            .status-approved { background: #dcfce7; color: #15803d; }
            .status-rejected { background: #fee2e2; color: #b91c1c; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${report.title}</h1>
            <div class="meta">
              Author: ${authorName} | Type: ${typeName} | Date: ${format(new Date(report.createdAt), 'PPPP')}
            </div>
          </div>
          <div class="section">
            <div class="section-title">Status</div>
            <div class="status status-${report.status}">${report.status.replace('_', ' ')}</div>
          </div>
          <div class="section">
            <div class="section-title">Description</div>
            <div class="content">${report.description}</div>
          </div>
          ${report.challenges ? `
          <div class="section">
            <div class="section-title">Challenges</div>
            <div class="content">${report.challenges}</div>
          </div>` : ''}
          ${report.pendingTasks ? `
          <div class="section">
            <div class="section-title">Next Steps</div>
            <div class="content">${report.pendingTasks}</div>
          </div>` : ''}
          ${report.attachments.length > 0 ? `
          <div class="section">
            <div class="section-title">Attachments</div>
            <div class="content">
              <ul>
                ${report.attachments.map(a => `<li>${a.name}</li>`).join('')}
              </ul>
            </div>
          </div>` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleManualSummarize = async (report: Report) => {
    if (isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    try {
      const summary = await summarizeReport(report);
      const analysis = await analyzeReport(report);
      await updateReportAI(report.id, summary, analysis);
      setSelectedReport({ ...report, aiSummary: summary, aiAnalysis: analysis });
      setIsSummaryCollapsed(false);
    } catch (error) {
      console.error("Manual summarization error:", error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleExportCSV = () => {
    const csvData = reports.map(r => ({
      ID: r.id,
      Title: r.title,
      Status: r.status,
      AuthorID: r.authorId,
      Date: format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
      Location: r.location ? `${r.location.latitude}, ${r.location.longitude}` : 'N/A'
    }));
    
    if (csvData.length === 0) return;
    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reports_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t('Reports')}</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage and track your evidence-based reports.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            Refresh
          </button>
          {user?.role === 'ORG_ADMIN' && (
            <button 
              onClick={() => setIsTypeModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-6 py-3 rounded-xl font-bold border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Create Report Type
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Plus className="w-5 h-5" />
            {t('New Report')}
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <FileText className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search reports by title or content..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-500 rounded-xl text-sm transition-all outline-none text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revision_requested">Revision Requested</option>
            </select>
          </div>

          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
          >
            <option value="all">All Types</option>
            {reportTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>

          <select 
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
          >
            <option value="all">All Authors</option>
            {teamMembers.map(member => (
              <option key={member.uid} value={member.uid}>{member.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredReports.map((report) => (
          <div key={report.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
            <div className="p-6 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "p-2 rounded-xl",
                  report.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  report.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                )}>
                  <FileText className="w-6 h-6" />
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                  report.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                  report.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                )}>
                  {report.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{report.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{report.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {report.attachments.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                    <Paperclip className="w-3 h-3" />
                    {report.attachments.length} ATTACHMENTS
                  </div>
                )}
                {report.location && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                    <MapPin className="w-3 h-3" />
                    GPS CAPTURED
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                  {report.authorId.charAt(0)}
                </div>
                <div className="text-[10px]">
                  <p className="font-bold text-slate-700 dark:text-slate-300">User {report.authorId.slice(0, 4)}</p>
                  <p className="text-slate-500 dark:text-slate-400">{format(new Date(report.createdAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedReport(report)}
                  className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                  title="View Details"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownloadPDF(report); }}
                  className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                  title="Download PDF"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredReports.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No reports found</h3>
            <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Create Report Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold">{isEditing ? 'Edit & Resubmit Report' : 'Create New Report'}</h2>
              <button onClick={() => { setIsModalOpen(false); setIsEditing(false); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* Progress Indicator */}
              <div className="flex items-center justify-between mb-8 px-4">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      submissionStep >= step ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}>
                      {step}
                    </div>
                    {step < 3 && (
                      <div className={cn(
                        "flex-1 h-1 mx-2 rounded-full transition-all",
                        submissionStep > step ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"
                      )} />
                    )}
                  </div>
                ))}
              </div>

              {submissionStatus !== 'idle' ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  {submissionStatus === 'uploading' && (
                    <>
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <h3 className="text-lg font-bold">Uploading Evidence...</h3>
                      <p className="text-slate-500">Securing your attachments in the cloud.</p>
                    </>
                  )}
                  {submissionStatus === 'submitting' && (
                    <>
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                      <h3 className="text-lg font-bold">Finalizing Report...</h3>
                      <p className="text-slate-500">Recording your submission in the audit log.</p>
                    </>
                  )}
                  {submissionStatus === 'analyzing' && (
                    <>
                      <Sparkles className="w-12 h-12 text-indigo-600 animate-pulse" />
                      <h3 className="text-lg font-bold">AI Analysis in Progress...</h3>
                      <p className="text-slate-500">Generating executive summary and insights.</p>
                    </>
                  )}
                  {submissionStatus === 'success' && (
                    <>
                      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h3 className="text-lg font-bold text-emerald-600">Submission Successful!</h3>
                      <p className="text-slate-500">Your report has been submitted and is awaiting review.</p>
                    </>
                  )}
                  {submissionStatus === 'error' && (
                    <>
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center">
                        <XCircle className="w-10 h-10" />
                      </div>
                      <h3 className="text-lg font-bold text-red-600">Submission Failed</h3>
                      <p className="text-slate-500">There was an error processing your report. Please try again.</p>
                      <button 
                        type="button"
                        onClick={() => setSubmissionStatus('idle')}
                        className="mt-4 px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {submissionStep === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      
                      {/* AI Voice Drafting */}
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Draft with AI Voice
                          </h4>
                          <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                            Speak naturally about your report. AI will automatically structure it into title, description, challenges, and tasks.
                          </p>
                          {isListening === 'ai_draft' && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 animate-pulse">
                              Listening... {aiDraftTranscript}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {isDraftingWithAI ? (
                            <button type="button" disabled className="flex items-center gap-2 px-4 py-2 bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-bold">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </button>
                          ) : isListening === 'ai_draft' ? (
                            <button type="button" onClick={stopAIDrafting} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all shadow-md">
                              <MicOff className="w-4 h-4" />
                              Stop & Process
                            </button>
                          ) : (
                            <button type="button" onClick={startAIDrafting} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md">
                              <Mic className="w-4 h-4" />
                              Start Speaking
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Report Type</label>
                          <select 
                            value={selectedTypeId}
                            onChange={(e) => setSelectedTypeId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
                          >
                            <option value="">General Report</option>
                            {reportTypes.map(type => (
                              <option key={type.id} value={type.id}>
                                {type.name} {type.locationRequired ? '(Location Required)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Report Title</label>
                          <input 
                            required
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Weekly Site Visit - Branch A"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-4">
                        <button 
                          type="button"
                          onClick={() => title && setSubmissionStep(2)}
                          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                          Next Step
                        </button>
                      </div>
                    </div>
                  )}

                  {submissionStep === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Work Done / Narrative</label>
                          <button 
                            type="button"
                            onClick={() => startListening('description')}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              isListening === 'description' ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            )}
                          >
                            {isListening === 'description' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </button>
                        </div>
                        <textarea 
                          required
                          rows={4}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe the activities performed..."
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Challenges Faced</label>
                            <button 
                              type="button"
                              onClick={() => startListening('challenges')}
                              className={cn(
                                "p-1.5 rounded-lg transition-all",
                                isListening === 'challenges' ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                              )}
                            >
                              {isListening === 'challenges' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                          </div>
                          <textarea 
                            rows={3}
                            value={challenges}
                            onChange={(e) => setChallenges(e.target.value)}
                            placeholder="Any blockers or issues?"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all resize-none"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Pending Tasks / Next Steps</label>
                            <button 
                              type="button"
                              onClick={() => startListening('pendingTasks')}
                              className={cn(
                                "p-1.5 rounded-lg transition-all",
                                isListening === 'pendingTasks' ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                              )}
                            >
                              {isListening === 'pendingTasks' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                          </div>
                          <textarea 
                            rows={3}
                            value={pendingTasks}
                            onChange={(e) => setPendingTasks(e.target.value)}
                            placeholder="What needs to be done next?"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all resize-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button 
                          type="button"
                          onClick={() => setSubmissionStep(1)}
                          className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        >
                          Back
                        </button>
                        <button 
                          type="button"
                          onClick={() => description && setSubmissionStep(3)}
                          className="flex-[2] bg-indigo-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                          Next Step
                        </button>
                      </div>
                    </div>
                  )}

                  {submissionStep === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Evidence Attachments</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl hover:border-indigo-400 transition-colors">
                          <div className="space-y-1 text-center">
                            <Paperclip className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" />
                            <div className="flex text-sm text-slate-600 dark:text-slate-400">
                              <label className="relative cursor-pointer bg-white dark:bg-slate-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none">
                                <span>Upload files</span>
                                <input 
                                  type="file" 
                                  multiple 
                                  className="sr-only" 
                                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-500">PNG, JPG, PDF, DOCX up to 10MB</p>
                          </div>
                        </div>
                        {files.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {files.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-900 dark:text-white">
                                <span className="truncate max-w-[200px]">{file.name}</span>
                                <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Link to Task (Optional)</label>
                        <select 
                          value={selectedTaskId}
                          onChange={(e) => setSelectedTaskId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
                        >
                          <option value="">No task linked</option>
                          {userTasks.map(task => (
                            <option key={task.id} value={task.id}>{task.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <button 
                          type="button"
                          onClick={() => setSubmissionStep(2)}
                          className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        >
                          Back
                        </button>
                        <button 
                          type="submit"
                          disabled={submitting}
                          className="flex-[2] bg-indigo-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                        >
                          {submitting ? 'Submitting...' : isEditing ? 'Resubmit Report' : 'Submit Report'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-w-4xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{selectedReport.title}</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-0.5">
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Submitted on {format(new Date(selectedReport.createdAt), 'PPPP')}</p>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-lg w-fit">
                      <button 
                        onClick={() => setActiveTab('details')}
                        className={cn(
                          "px-2 sm:px-3 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-bold rounded-md transition-all",
                          activeTab === 'details' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"
                        )}
                      >
                        DETAILS
                      </button>
                      <button 
                        onClick={() => setActiveTab('history')}
                        className={cn(
                          "px-2 sm:px-3 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-bold rounded-md transition-all",
                          activeTab === 'history' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500"
                        )}
                      >
                        REVISION HISTORY
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <XCircle className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
              {activeTab === 'details' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <button
                      onClick={() => {
                        const searchParams = new URLSearchParams();
                        searchParams.set('title', `Action from: ${selectedReport.title}`);
                        searchParams.set('description', `Based on report insights: ${selectedReport.aiSummary || selectedReport.description}`);
                        navigate(`/tasks?${searchParams.toString()}`);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xl"
                    >
                      <Plus className="w-5 h-5" />
                      Create Task from Report Insights
                    </button>

                    {/* AI Summary Section */}
                    <div className="space-y-4">
                      {!selectedReport.aiSummary ? (
                        <button
                          onClick={() => handleManualSummarize(selectedReport)}
                          disabled={isGeneratingSummary}
                          className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                        >
                          {isGeneratingSummary ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Generating AI Summary...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              View AI Summary
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 overflow-hidden">
                          <button 
                            onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
                            className="w-full p-6 flex items-center justify-between hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-sm">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">AI Executive Summary</h4>
                            </div>
                            <ChevronRight className={cn("w-5 h-5 text-indigo-400 transition-transform", !isSummaryCollapsed && "rotate-90")} />
                          </button>
                          
                          {!isSummaryCollapsed && (
                            <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                              <div className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 relative">
                                <p className="text-sm text-indigo-900 dark:text-indigo-100 leading-relaxed font-medium italic">
                                  "{selectedReport.aiSummary}"
                                </p>
                                <button
                                  onClick={() => handleListen(selectedReport.aiSummary!)}
                                  disabled={isSpeaking}
                                  className="absolute bottom-4 right-4 p-2 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-110 transition-all disabled:opacity-50"
                                >
                                  {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedReport.taskId && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <CheckSquare className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Linked Task</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {userTasks.find(t => t.id === selectedReport.taskId)?.title || 'Task Details'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                          TASK LINKED
                        </span>
                      </div>
                    )}

                    <section>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Work Description</h4>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedReport.description}
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Challenges</h4>
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/30">
                        {selectedReport.challenges || 'No challenges reported.'}
                      </div>
                    </section>
                    <section>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Next Steps</h4>
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30">
                        {selectedReport.pendingTasks || 'No pending tasks.'}
                      </div>
                    </section>
                  </div>

                  {/* Attachments with Integrity Check */}
                  <section>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
                      Evidence Attachments
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{selectedReport.attachments.length} files</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedReport.attachments.map((file) => (
                        <div key={file.id} className="space-y-2">
                          <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center gap-4 group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-all">
                              <Paperclip className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">{(file.size / 1024).toFixed(1)} KB</span>
                                {file.hash && (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                    <ShieldCheck className="w-3 h-3" />
                                    VERIFIED
                                  </span>
                                )}
                              </div>
                            </div>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                            {file.url.match(/\.(jpg|jpeg|png|webp)$/i) && (
                              <button
                                onClick={() => handleAnalyzeImage(file)}
                                disabled={analyzingImageId === file.id}
                                className="p-2 text-slate-400 dark:text-slate-500 hover:text-sparkles transition-all disabled:opacity-50"
                                title="Analyze with AI"
                              >
                                {analyzingImageId === file.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-5 h-5" />
                                )}
                              </button>
                            )}
                          </div>
                          {imageAnalysisResult[file.id] && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl text-[10px] text-indigo-700 dark:text-indigo-300 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="flex items-center gap-2 mb-1 font-bold">
                                <Sparkles className="w-3 h-3" />
                                AI ANALYSIS
                              </div>
                              {imageAnalysisResult[file.id]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                </section>

                  {/* Comments Section */}
                  {user && <CommentSection parentId={selectedReport.id} user={user} />}
                </div>

                <div className="space-y-6">
                  {/* AI Analysis Sidebar */}
                  {selectedReport.aiAnalysis && (
                    <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-6 text-white space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">AI Analysis</h4>
                        <div className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          selectedReport.aiAnalysis.riskLevel === 'high' ? "bg-red-500" :
                          selectedReport.aiAnalysis.riskLevel === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                        )}>
                          {selectedReport.aiAnalysis.riskLevel} Risk
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Detected Anomalies</p>
                          <ul className="space-y-2">
                            {selectedReport.aiAnalysis.anomalies.map((a, i) => (
                              <li key={i} className="text-xs flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="opacity-80">{a}</span>
                              </li>
                            ))}
                            {selectedReport.aiAnalysis.anomalies.length === 0 && (
                              <li className="text-xs opacity-40 italic">No anomalies detected.</li>
                            )}
                          </ul>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">AI Suggestions</p>
                          <ul className="space-y-2">
                            {selectedReport.aiAnalysis.suggestions.map((s, i) => (
                              <li key={i} className="text-xs flex gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="opacity-80">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata Sidebar */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 space-y-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-3">Status Control</p>
                      <div className="flex flex-col gap-2">
                        <span className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold text-center uppercase tracking-wider",
                          selectedReport.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                          selectedReport.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        )}>
                          {selectedReport.status.replace('_', ' ')}
                        </span>

                        {selectedReport.rating && (
                          <div className="flex items-center justify-center gap-1 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star 
                                key={star} 
                                className={cn(
                                  "w-4 h-4", 
                                  selectedReport.rating! >= star ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"
                                )} 
                              />
                            ))}
                          </div>
                        )}

                        {/* Edit Action for Author when Revision Requested */}
                        {user?.uid === selectedReport.authorId && 
                         selectedReport.status === 'revision_requested' && (
                          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl space-y-3">
                            <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Revision Required</p>
                            <p className="text-xs text-amber-700 dark:text-amber-500 italic">"{selectedReport.reviewComment}"</p>
                            <button
                              onClick={() => openEditModal(selectedReport)}
                              className="w-full bg-amber-600 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-3 h-3" />
                              EDIT & RESUBMIT
                            </button>
                          </div>
                        )}

                        {/* Review Actions for Supervisors/Managers */}
                        {['SUPERVISOR', 'MANAGER', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user?.role || '') && 
                         selectedReport.status === 'submitted' && (
                          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Performance Rating:</span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    className={cn(
                                      "p-1 rounded-full transition-all",
                                      reviewRating >= star ? "text-amber-400" : "text-slate-300 dark:text-slate-600 hover:text-amber-200"
                                    )}
                                  >
                                    <Star className="w-5 h-5 fill-current" />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <textarea
                              placeholder="Add a review comment..."
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReview('approved')}
                                disabled={isReviewing}
                                className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                              >
                                APPROVE
                              </button>
                              <button
                                onClick={() => handleReview('revision_requested')}
                                disabled={isReviewing}
                                className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-[10px] font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
                              >
                                REVISION
                              </button>
                            </div>
                            <button
                              onClick={() => handleReview('rejected')}
                              disabled={isReviewing}
                              className="w-full bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 py-2 rounded-xl text-[10px] font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
                            >
                              REJECT REPORT
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedReport.location && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-3">Location Context</p>
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                            <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span>{selectedReport.location.latitude.toFixed(4)}, {selectedReport.location.longitude.toFixed(4)}</span>
                          </div>
                          <a 
                            href={`https://www.google.com/maps?q=${selectedReport.location.latitude},${selectedReport.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block text-center py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all"
                          >
                            VIEW ON MAP
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revision History</h3>
                  <div className="space-y-4">
                    {selectedReport.history?.map((entry) => (
                      <div key={entry.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.updatedByName}</p>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{format(new Date(entry.updatedAt), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2">{entry.action.replace('_', ' ')}</p>
                          {entry.details && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                              {entry.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!selectedReport.history || selectedReport.history.length === 0) && (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No revision history available for this report.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Report Types Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <h2 className="text-xl font-bold">Manage Report Types</h2>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <form onSubmit={handleCreateType} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">New Type Name</label>
                  <input 
                    required
                    type="text" 
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="e.g. Incident Report"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox"
                    id="locationRequired"
                    checked={newTypeLocationRequired}
                    onChange={(e) => setNewTypeLocationRequired(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="locationRequired" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Require Location for this type
                  </label>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  Create Type
                </button>
              </form>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Existing Types</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {reportTypes.map(type => (
                    <div key={type.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{type.name}</p>
                        {type.locationRequired && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">Location Required</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {reportTypes.length === 0 && (
                    <p className="text-center py-4 text-sm text-slate-500 dark:text-slate-400 italic">No custom report types defined.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
