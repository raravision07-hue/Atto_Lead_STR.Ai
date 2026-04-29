import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  Settings, 
  Globe, 
  Mail, 
  Phone, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  Filter, 
  Download, 
  Plus, 
  ExternalLink,
  Facebook,
  Linkedin,
  Instagram,
  LayoutDashboard,
  Users,
  Briefcase,
  Loader2,
  Copy,
  ChevronRight,
  PlusCircle,
  ClipboardList,
  MessageSquare,
  Sparkles,
  MoreVertical,
  BellOff,
  Trash2,
  Edit2,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel,
  AlignmentType,
  BorderStyle
} from 'docx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { searchLeads, generatePitch, generateDemoPrompt, generateFollowUp, enrichLeadData, Lead, DemoPromptResult } from './services/leadService';
import { auth, db } from './lib/firebase';
import { useAuth } from './contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc 
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getTwitterIcon = (size = 14) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function App() {
  const { user, loading: authLoading, signIn, logout } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState({ niche: 'Dentists', location: 'Austin, TX' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [storedLeads, setStoredLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedLeadsToExport, setSelectedLeadsToExport] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'doc' | 'csv' | 'json' | 'txt'>('doc');
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Load leads from Firestore when user changes
  useEffect(() => {
    if (!user) {
      setStoredLeads([]);
      return;
    }

    const path = `users/${user.uid}/leads`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStoredLeads(fetchedLeads);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddLead = async (newLead: any) => {
    if (!user) return;
    const path = `users/${user.uid}/leads`;
    
    // Clean data to avoid Firestore 'undefined' crash
    const sanitize = (obj: any) => {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
          cleaned[key] = obj[key];
        }
      });
      return cleaned;
    };

    try {
      if (newLead.id && storedLeads.some(l => l.id === newLead.id)) {
        // Update existing
        const { id, ...updateData } = newLead;
        await updateDoc(doc(db, 'users', user.uid, 'leads', id), {
          ...sanitize(updateData),
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new
        const { id: _, ...createData } = newLead;
        await addDoc(collection(db, path), {
          ...sanitize(createData),
          userId: user.uid,
          status: createData.status || 'New',
          industry: createData.industry || '',
          cms: createData.cms || '',
          projectType: createData.projectType || 'General Redesign',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdateLead = async (updatedLead: any) => {
    if (!user) return;
    const path = `users/${user.uid}/leads/${updatedLead.id}`;
    
    const sanitize = (obj: any) => {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
          cleaned[key] = obj[key];
        }
      });
      return cleaned;
    };

    try {
      const { id, ...data } = updatedLead;
      await updateDoc(doc(db, 'users', user.uid, 'leads', id), {
        ...sanitize(data),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}/leads/${id}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'leads', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const [pitch, setPitch] = useState<string | null>(null);
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [demoPrompt, setDemoPrompt] = useState<DemoPromptResult | null>(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [followUpStep, setFollowUpStep] = useState(1);
  const [generatingFollowUpState, setGeneratingFollowUpState] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorStatus(null);
    try {
      const newLeads = await searchLeads(searchQuery.niche, searchQuery.location);
      if (newLeads.length === 0) {
        setErrorStatus("No leads found for the specified niche/location. Try different terms.");
      }
      setLeads(prev => [...newLeads, ...prev]);
    } catch (err: any) {
      console.error("Search failed:", err);
      setErrorStatus(err.message || "Failed to search for leads. Please check your internet connection or API settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePitch = async (lead: Lead) => {
    setGeneratingPitch(true);
    setErrorStatus(null);
    try {
      const result = await generatePitch(lead);
      setPitch(result);
    } catch (err: any) {
      console.error("Pitch generation failed:", err);
      setErrorStatus(err.message || "Failed to generate pitch. Try again.");
    } finally {
      setGeneratingPitch(false);
    }
  };

  const getDashboardData = () => {
    const statusData = ['New', 'Contacted', 'Meeting', 'Proposal', 'Won', 'Lost'].map(status => ({
      name: status,
      value: storedLeads.filter(l => l.status === status).length,
      color: status === 'Won' ? '#10b981' : status === 'Lost' ? '#ef4444' : status === 'Proposal' ? '#a855f7' : status === 'Meeting' ? '#f59e0b' : status === 'Contacted' ? '#3b82f6' : '#9ca3af'
    }));

    const industryMap: Record<string, number> = {};
    storedLeads.forEach(l => {
      const ind = l.industry || 'Other';
      industryMap[ind] = (industryMap[ind] || 0) + 1;
    });

    const industryData = Object.entries(industryMap).map(([name, value]) => ({ name, value }));

    return { statusData, industryData };
  };

  const handleGenerateFollowUp = async (lead: Lead, step: number = 1) => {
    setGeneratingFollowUpState(true);
    setFollowUpStep(step);
    setErrorStatus(null);
    try {
      const result = await generateFollowUp(lead, step);
      setFollowUp(result);
    } catch (err: any) {
      console.error("Follow-up generation failed:", err);
      setErrorStatus(err.message || "Failed to generate follow-up. Try again.");
    } finally {
      setGeneratingFollowUpState(false);
    }
  };

  const handlePrintAudit = () => {
    window.print();
  };

  const handleGenerateDemoPrompt = async (lead: Lead) => {
    setGeneratingDemo(true);
    setErrorStatus(null);
    try {
      const result = await generateDemoPrompt(lead);
      setDemoPrompt(result);
    } catch (err: any) {
      console.error("Demo generation failed:", err);
      setErrorStatus(err.message || "Failed to generate demo prompt. Try again.");
    } finally {
      setGeneratingDemo(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-red-500 bg-red-50 border-red-100';
    if (score >= 5) return 'text-amber-500 bg-amber-50 border-amber-100';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100';
  };

  const handleExportDoc = async () => {
    if (selectedLeadsToExport.length === 0) return;

    const leadsToExport = storedLeads.filter(l => selectedLeadsToExport.includes(l.id));

    const doc = new Document({
      sections: [{
        properties: {},
        children: leadsToExport.flatMap((lead, index) => [
          new Paragraph({
            text: lead.companyName || lead.title || "Untitled Lead",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Email: ", bold: true }),
              new TextRun(lead.email || "N/A")
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Phone: ", bold: true }),
              new TextRun(lead.phone || "N/A")
            ]
          }),
          lead.website ? new Paragraph({
            children: [
              new TextRun({ text: "Website: ", bold: true }),
              new TextRun(lead.website)
            ]
          }) : null,
          lead.whatsapp ? new Paragraph({
            children: [
              new TextRun({ text: "WhatsApp: ", bold: true }),
              new TextRun(lead.whatsapp)
            ]
          }) : null,
          lead.facebook ? new Paragraph({
            children: [
              new TextRun({ text: "Facebook: ", bold: true }),
              new TextRun(lead.facebook)
            ]
          }) : null,
          lead.linkedin ? new Paragraph({
            children: [
              new TextRun({ text: "LinkedIn: ", bold: true }),
              new TextRun(lead.linkedin)
            ]
          }) : null,
          lead.instagram ? new Paragraph({
            children: [
              new TextRun({ text: "Instagram: ", bold: true }),
              new TextRun(lead.instagram)
            ]
          }) : null,
          lead.twitter ? new Paragraph({
            children: [
              new TextRun({ text: "X (Twitter): ", bold: true }),
              new TextRun(lead.twitter)
            ]
          }) : null,
          lead.projectType ? new Paragraph({
            children: [
              new TextRun({ text: "Project Type: ", bold: true }),
              new TextRun(lead.projectType)
            ]
          }) : null,
          lead.clientManager ? new Paragraph({
            children: [
              new TextRun({ text: "Client Manager: ", bold: true }),
              new TextRun(lead.clientManager)
            ]
          }) : null,
          lead.processingWork ? new Paragraph({
            children: [
              new TextRun({ text: "Notes: ", bold: true }),
              new TextRun(lead.processingWork)
            ],
            spacing: { before: 100 }
          }) : null,
          index < leadsToExport.length - 1 ? new Paragraph({
            children: [
              new TextRun({
                text: "_________________________________________________________________________________ ",
                color: "E2E8F0"
              })
            ],
            spacing: { before: 200, after: 200 }
          }) : null
        ].filter(Boolean) as any[])
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CRM_Leads_Export_${new Date().toISOString().split('T')[0]}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsExportModalOpen(false);
    setSelectedLeadsToExport([]);
  };

  const handleExportCSV = () => {
    if (selectedLeadsToExport.length === 0) return;

    const leadsToExport = storedLeads.filter(l => selectedLeadsToExport.includes(l.id));
    
    const headers = ["Company Name", "Email", "Phone", "Website", "Industry", "Opportunity Score", "CMS", "Facebook", "LinkedIn", "Instagram", "X (Twitter)", "Project Type", "Client Manager", "Notes"];
    const rows = leadsToExport.map(l => [
      l.companyName || l.title || "N/A",
      l.email || "N/A",
      l.phone || "N/A",
      l.website || "N/A",
      l.industry || "N/A",
      l.opportunityScore || "N/A",
      l.cms || "N/A",
      l.facebook || "N/A",
      l.linkedin || "N/A",
      l.instagram || "N/A",
      l.twitter || "N/A",
      l.projectType || "N/A",
      l.clientManager || "N/A",
      l.processingWork || "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LeadFlow_Export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
    setSelectedLeadsToExport([]);
  };

  const handleExportJSON = () => {
    if (selectedLeadsToExport.length === 0) return;
    const leadsToExport = storedLeads.filter(l => selectedLeadsToExport.includes(l.id));
    const jsonString = JSON.stringify(leadsToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LeadFlow_Export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
    setSelectedLeadsToExport([]);
  };

  const handleExportTXT = () => {
    if (selectedLeadsToExport.length === 0) return;
    const leadsToExport = storedLeads.filter(l => selectedLeadsToExport.includes(l.id));
    const txtContent = leadsToExport.map(l => {
      return `--- ${l.companyName || l.title} ---
Email: ${l.email || 'N/A'}
Phone: ${l.phone || 'N/A'}
Website: ${l.website || 'N/A'}
CMS: ${l.cms || 'N/A'}
Opportunity: ${l.opportunityScore || 'N/A'}
Socials: FB: ${l.facebook || '-'}, LI: ${l.linkedin || '-'}, IG: ${l.instagram || '-'}
Notes: ${l.processingWork || 'None'}
`;
    }).join('\n\n');

    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LeadFlow_Export_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
    setSelectedLeadsToExport([]);
  };

  const VULNERABILITIES = [
    { name: "SQL Injection", desc: "Attackers inject malicious SQL statements to manipulate database queries.", risk: "High" },
    { name: "Cross-Site Scripting (XSS)", desc: "Injecting malicious scripts into web pages viewed by other users.", risk: "Medium" },
    { name: "CSRF", desc: "Forces authenticated users to execute unwanted actions on a web application.", risk: "Medium" },
    { name: "Broken Authentication", desc: "Flaws in authentication or session management that allow attackers to compromise passwords.", risk: "Critical" },
    { name: "Security Misconfiguration", desc: "Insecure default configurations, open cloud storage, or verbose error messages.", risk: "High" },
    { name: "Insecure Direct Object References", desc: "Exposing internal implementation objects to users without access checking.", risk: "High" }
  ];

  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white space-y-4">
        <Loader2 className="w-12 h-12 text-black animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Initializing Systems...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex bg-[#F8F9FA] relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-black/5 blur-3xl -mr-64 -mt-64 rounded-full" />
        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-emerald-500/5 blur-3xl -ml-64 -mb-64 rounded-full" />

        <div className="flex-1 flex flex-col items-center justify-center px-4 z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center"
          >
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center shadow-2xl shadow-black/20">
                <TrendingUp className="text-white w-10 h-10" />
              </div>
            </div>
            
            <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">LeadFlow AI</h1>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-10">Web Audit & CRM Engine</p>

            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-4 text-left p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center shrink-0">
                  <Search size={16} className="text-black" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Deep Audit Engine</h4>
                  <p className="text-[11px] text-gray-500 font-medium">Find high-opportunity WordPress leads instantly.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 text-left p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center shrink-0">
                  <Briefcase size={16} className="text-black" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Personal CRM</h4>
                  <p className="text-[11px] text-gray-500 font-medium">Each user gets their own private workspace.</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => signIn()}
              className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <LogIn size={18} />
              Continue with Google
            </button>

            <p className="mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              A private tool for professional web developers
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-gray-900 overflow-hidden relative">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-50 transition-transform duration-300 lg:translate-x-0 lg:static ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <TrendingUp className="text-white w-5 h-5" />
              </div>
              <h1 className="font-bold text-xl tracking-tight">LeadFlow AI</h1>
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Web Audit Engine</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="rotate-180" size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
          <NavItem icon={<Search size={18} />} label="Lead Finder" active={activeTab === 'search'} onClick={() => { setActiveTab('search'); setIsSidebarOpen(false); }} />
          <NavItem icon={<PlusCircle size={18} />} label="Add Lead" active={activeTab === 'add-lead'} onClick={() => { setEditingLead(null); setActiveTab('add-lead'); setIsSidebarOpen(false); }} />
          <NavItem icon={<ClipboardList size={18} />} label="All Leads" active={activeTab === 'all-leads'} onClick={() => { setActiveTab('all-leads'); setIsSidebarOpen(false); }} />
          <NavItem icon={<BarChart3 size={18} />} label="Pipeline" active={activeTab === 'pipeline'} onClick={() => { setActiveTab('pipeline'); setIsSidebarOpen(false); }} />
          <NavItem icon={<Briefcase size={18} />} label="Outreach" active={activeTab === 'outreach'} onClick={() => { setActiveTab('outreach'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="p-6 border-t border-gray-100 space-y-6">
          {/* Personal Profile Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black overflow-hidden flex items-center justify-center text-white font-black text-xs border-2 border-gray-100 shadow-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" />
                ) : (
                  user.displayName?.charAt(0) || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-900 leading-none truncate">{user.displayName || 'Anonymous'}</p>
                <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">Verified User</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-3 px-1">
                <a href="https://www.facebook.com/profile.php?id=61586575149744" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <Facebook size={16} />
                </a>
                <a href="https://www.instagram.com/strahmed7/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 transition-colors">
                  <Instagram size={16} />
                </a>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <NavItem icon={<Settings size={18} />} label="Settings" onClick={() => {}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <MoreVertical size={20} />
            </button>
            <h2 className="font-semibold text-lg hidden sm:block">
              {activeTab === 'dashboard' ? 'Overview' : activeTab === 'search' ? 'Lead Finder' : activeTab === 'add-lead' ? 'Manual Entry' : activeTab === 'all-leads' ? 'CRM' : activeTab === 'outreach' ? 'Outreach AI' : 'Resources'}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={14} className="hidden sm:inline" />
              Export
            </button>
            <button 
              onClick={() => handleSearch()}
              disabled={loading}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span className="hidden sm:inline">Refresh Leads</span>
              <span className="sm:hidden">Refresh</span>
            </button>
          </div>
        </header>

        {/* Error Notification */}
        <AnimatePresence>
          {errorStatus && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-50 border-b border-red-100 overflow-hidden"
            >
              <div className="px-8 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-red-700">
                  <AlertTriangle size={16} />
                  <p className="text-sm font-medium">{errorStatus}</p>
                </div>
                <button 
                  onClick={() => setErrorStatus(null)}
                  className="p-1 hover:bg-red-100 rounded-md text-red-400 group"
                >
                  <Plus size={16} className="rotate-45" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  <StatCard label="Live Leads" value={leads.length.toString()} icon={<Users className="text-blue-500" />} trend="+12% this month" />
                  <StatCard label="High Opportunity" value={leads.filter(l => l.opportunityScore >= 8).length.toString()} icon={<AlertTriangle className="text-red-500" />} trend="Redesign ready" />
                  <StatCard label="WP Detected" value={leads.length.toString()} icon={<Globe className="text-emerald-500" />} trend="WordPress 100%" />
                  <StatCard label="Manual CRM" value={storedLeads.length.toString()} icon={<ClipboardList className="text-purple-500" />} trend="Saved leads" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                   <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                         <div>
                            <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">Pipeline Health</h3>
                            <p className="text-[10px] font-bold text-gray-400">Current Sales Cycle Distribution</p>
                         </div>
                      </div>
                      <div className="h-[250px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getDashboardData().statusData}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                               <RechartsTooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 700 }}
                                  cursor={{ fill: '#f8fafc' }}
                               />
                               <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                  {getDashboardData().statusData.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                               </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div>
                        <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-1">Status Summary</h3>
                        <p className="text-[10px] font-bold text-gray-400 mb-6">Pipeline segmentation</p>
                        <div className="space-y-4">
                          {getDashboardData().statusData.filter(d => d.value > 0).map((d, i) => (
                            <div key={i} className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                  <span className="text-[11px] font-bold text-gray-600">{d.name}</span>
                               </div>
                               <span className="text-[11px] font-black text-gray-900">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('pipeline')}
                        className="mt-6 w-full py-3 bg-gray-50 border border-gray-100 text-gray-500 font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-black hover:text-white transition-all"
                      >
                        View Board View
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Market Focus</h3>
                    <div className="space-y-4">
                      {getDashboardData().industryData.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-xs italic">No industry data yet.</div>
                      ) : (
                        getDashboardData().industryData.slice(0, 4).map((d, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                            <span className="text-sm font-medium text-gray-500">{d.name}</span>
                            <span className="text-sm font-black text-gray-900">{d.value} Leads</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-black text-white p-6 rounded-2xl shadow-xl shadow-black/10 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-xl mb-2">Automate Outreach</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">Turn discovery results into signed contracts using our AI-driven pitch engine.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('search')}
                      className="mt-6 w-full py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-gray-100 transition-all"
                    >
                      Search New Territory
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'search' ? (
              <motion.div 
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Search Bar */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:bg-black/10" />
                  <form onSubmit={handleSearch} className="relative flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        value={searchQuery.niche}
                        onChange={(e) => setSearchQuery(prev => ({ ...prev, niche: e.target.value }))}
                        placeholder="Niche (e.g. Dentists, HVAC, Law)"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                    <div className="flex-1 relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        value={searchQuery.location}
                        onChange={(e) => setSearchQuery(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="City, State"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 min-w-[160px]"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                      Find Leads
                    </button>
                  </form>
                </div>

                {/* Discovery Results */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                    <div>
                      <h3 className="font-bold text-lg">Discovery Hotlist</h3>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-tight">Real-time business audit results</p>
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Asset</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Web Vulnerabilities</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Opportunity</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {leads.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-20 text-center text-gray-400 text-sm">No discovery results yet.</td>
                          </tr>
                        ) : (
                          leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-gray-50/80 transition-colors group">
                              <td className="px-6 py-5">
                                <div className="font-bold text-gray-900 leading-tight mb-0.5">{lead.businessName}</div>
                                <div className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-tight">
                                  <Globe size={10} className="text-gray-300" /> {lead.websiteUrl.replace(/https?:\/\/(www\.)?/, '')}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-wrap gap-1.5">
                                  {lead.websiteIssues.slice(0, 2).map((issue, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-gray-900 text-[9px] font-bold text-white rounded uppercase tracking-tighter">
                                      {issue}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-black border ${getScoreColor(lead.opportunityScore)} tracking-widest`}>
                                  RANK {lead.opportunityScore}/10
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <button 
                                  onClick={() => { setSelectedLead(lead); setPitch(null); }}
                                  className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white hover:border-black transition-all"
                                >
                                  ANALYZE
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden divide-y divide-gray-100">
                    {leads.length === 0 ? (
                      <div className="px-6 py-20 text-center text-gray-400 text-sm">No discovery results yet.</div>
                    ) : (
                      leads.map((lead) => (
                        <div key={lead.id} className="p-4 space-y-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-gray-900 truncate">{lead.businessName}</div>
                              <div className="text-[10px] font-bold text-gray-400 truncate uppercase mt-1">
                                {lead.websiteUrl.replace(/https?:\/\/(www\.)?/, '')}
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-black border ${getScoreColor(lead.opportunityScore)}`}>
                              {lead.opportunityScore}/10
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {lead.websiteIssues.slice(0, 3).map((issue, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-gray-900 text-[9px] font-bold text-white rounded uppercase tracking-tighter">
                                {issue}
                              </span>
                            ))}
                          </div>

                          <button 
                            onClick={() => { setSelectedLead(lead); setPitch(null); }}
                            className="w-full py-2 bg-white border border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                          >
                            Analyze Assets
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'add-lead' ? (
              <motion.div
                key="add-lead"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
                  <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                      {editingLead ? 'Modify Existing Lead' : 'Register New Lead'}
                    </h3>
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                      {editingLead ? 'Update details for this opportunity' : 'Manual entry for incoming opportunities'}
                    </p>
                  </div>
                  <AddLeadForm 
                    initialData={editingLead} 
                    onAdd={(lead) => { handleAddLead(lead); setActiveTab('all-leads'); setEditingLead(null); }} 
                  />
                </div>
              </motion.div>
            ) : activeTab === 'all-leads' ? (
              <motion.div
                key="all-leads"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-black text-gray-900">Stored CRM Leads</h3>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Manage your manual outreach list</p>
                  </div>
                  <div className="flex gap-2">
                     <button 
                      onClick={() => setActiveTab('pipeline')}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-100 transition-all"
                    >
                      <LayoutDashboard size={14} /> Board View
                    </button>
                    <button 
                      onClick={() => { setEditingLead(null); setActiveTab('add-lead'); }}
                      className="flex items-center gap-2 px-6 py-3 bg-black text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-800 transition-all shadow-lg"
                    >
                      <Plus size={14} /> New Entry
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {storedLeads.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                      <ClipboardList size={48} className="mx-auto text-gray-200 mb-4" />
                      <h4 className="font-bold text-gray-900">No leads stored yet</h4>
                      <p className="text-sm text-gray-400">Click "New Entry" to start building your database.</p>
                    </div>
                  ) : (
                    storedLeads.map((lead) => (
                      <LeadCard 
                        key={lead.id} 
                        lead={lead} 
                        onDelete={handleDeleteLead} 
                        onEdit={(l) => { setEditingLead(l); setActiveTab('add-lead'); }}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            ) : activeTab === 'pipeline' ? (
               <motion.div
                key="pipeline"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col space-y-6"
              >
                <div className="flex items-center justify-between">
                   <div>
                    <h3 className="text-3xl font-black text-gray-900">Sales Pipeline</h3>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Visual Lead Management</p>
                  </div>
                </div>

                <div className="flex-1 flex gap-6 pb-6 overflow-x-auto min-h-0">
                  {['New', 'Contacted', 'Meeting', 'Proposal', 'Won', 'Lost'].map((status) => (
                    <div key={status} className="w-80 shrink-0 flex flex-col bg-gray-100/50 rounded-3xl border border-gray-200">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            status === 'Won' ? 'bg-emerald-500' :
                            status === 'Lost' ? 'bg-red-500' :
                            status === 'Proposal' ? 'bg-purple-500' :
                            status === 'Meeting' ? 'bg-amber-500' :
                            status === 'Contacted' ? 'bg-blue-500' :
                            'bg-gray-400'
                          }`} />
                          <h4 className="font-black text-xs uppercase tracking-widest text-gray-900">{status}</h4>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                          {storedLeads.filter(l => l.status === status).length}
                        </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {storedLeads.filter(l => l.status === status).map((lead) => (
                          <motion.div 
                            layoutId={lead.id}
                            key={lead.id}
                            onClick={() => { setEditingLead(lead); setActiveTab('add-lead'); }}
                            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-black transition-all cursor-pointer group"
                          >
                            <p className="font-black text-sm text-gray-900 mb-1 group-hover:text-black">
                              {lead.companyName || lead.title}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight truncate">
                              {lead.industry || 'No Industry'}
                            </p>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                               <div className="flex gap-1">
                                  {lead.email && <Mail size={10} className="text-gray-300" />}
                                  {lead.phone && <Phone size={10} className="text-gray-300" />}
                               </div>
                               <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${getScoreColor(lead.opportunityScore || 5)}`}>
                                 {lead.opportunityScore || 5}/10
                               </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : activeTab === 'outreach' ? (
              <motion.div
                key="outreach"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-3xl font-black text-gray-900">Outreach AI</h3>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Generate high-converting audit pitches</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 font-black text-[10px] uppercase tracking-widest">Ready for Pitch</div>
                      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                        {[...leads, ...storedLeads].filter(l => (l.email || l.businessName)).map((l, i) => (
                          <button 
                            key={i}
                            onClick={() => { setSelectedLead(l); setPitch(null); setFollowUp(null); }}
                            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors group ${selectedLead?.id === l.id ? 'bg-gray-50 border-r-4 border-black' : ''}`}
                          >
                            <div className="font-bold text-sm text-gray-900 truncate">{l.businessName || l.title || 'Untitled Lead'}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase truncate mt-0.5">{l.email || 'No email provided'}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2">
                    {selectedLead ? (
                      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                         {!pitch && !generatingPitch ? (
                           <>
                             <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mb-6">
                               <Mail size={32} />
                             </div>
                             <h4 className="text-xl font-black text-gray-900 mb-2">New Proposal for {selectedLead.businessName || selectedLead.title}</h4>
                             <p className="text-sm text-gray-400 mb-8 max-w-sm">Ready to generate a professional audit-based outreach email?</p>
                             
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                                <button 
                                  onClick={() => handleGeneratePitch(selectedLead)}
                                  className="px-6 py-4 bg-black text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-center"
                                >
                                  Generate 1st Pitch
                                </button>

                                <button 
                                  onClick={() => handleGenerateFollowUp(selectedLead, 1)}
                                  className="px-6 py-4 bg-white border border-gray-200 text-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-sm hover:bg-gray-50 transition-all text-center"
                                >
                                  1st Follow-up
                                </button>

                                <button 
                                  onClick={() => handleGenerateFollowUp(selectedLead, 2)}
                                  className="px-6 py-4 bg-white border border-gray-200 text-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-sm hover:bg-gray-50 transition-all text-center"
                                >
                                  2nd Follow-up
                                </button>

                                <button 
                                  onClick={() => handleGenerateFollowUp(selectedLead, 3)}
                                  className="px-6 py-4 bg-white border border-gray-200 text-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-sm hover:bg-gray-50 transition-all text-center"
                                >
                                  3rd (Break-up)
                                </button>
                             </div>
                           </>
                         ) : generatingPitch || generatingFollowUpState ? (
                           <div className="space-y-4">
                              <Loader2 size={48} className="animate-spin text-black mx-auto" />
                              <p className="text-xs font-black uppercase tracking-widest animate-pulse">
                                {generatingPitch ? "Crafting Custom Hook..." : `Preparing Follow-up #${followUpStep}...`}
                              </p>
                           </div>
                         ) : pitch || followUp ? (
                           <div className="w-full space-y-6 text-left">
                              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div>
                                  <h5 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-1">
                                    {pitch ? "Phase: Initial Pitch" : `Phase: Follow-up #${followUpStep}`}
                                  </h5>
                                  <p className="font-bold text-gray-900">{selectedLead.email || 'N/A'}</p>
                                </div>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(pitch || followUp || '')}
                                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-sm"
                                >
                                  <Copy size={14} /> Copy Body
                                </button>
                              </div>
                              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-inner relative group">
                                <pre className="text-sm font-medium text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{pitch || followUp}</pre>
                              </div>
                              <button 
                                onClick={() => { setPitch(null); setFollowUp(null); }}
                                className="w-full py-4 text-gray-400 font-bold text-xs uppercase hover:text-black transition-colors"
                              >
                                Try different angle
                              </button>
                           </div>
                         ) : null}
                      </div>
                    ) : (
                      <div className="bg-white rounded-3xl border border-gray-200 border-dashed p-12 flex flex-col items-center justify-center text-center text-gray-400 min-h-[400px]">
                        <Briefcase size={48} className="mb-4 opacity-20" />
                        <h4 className="font-bold text-gray-900 mb-1">No Lead Selected</h4>
                        <p className="text-sm">Select a lead from the discovery list or CRM to generate a custom pitch.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 italic">
                Coming soon...
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Audit Modal Overlay */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLead(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[95vh] overflow-y-auto"
            >
              <div className="flex flex-col lg:flex-row h-full">
                {/* Audit Details */}
                <div className="flex-1 p-6 lg:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
                  <div className="mb-8 flex items-center justify-between">
                     <div className="flex-1">
                        <span className="inline-block px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-4">WordPress Verified</span>
                        <h2 className="text-3xl lg:text-4xl font-black text-gray-900 leading-none mb-3 break-words">{selectedLead.businessName}</h2>
                        <a href={selectedLead.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 font-bold flex items-center gap-2 hover:text-black transition-colors break-all text-sm">
                          <Globe size={18} className="shrink-0" />
                          {selectedLead.websiteUrl}
                          <ExternalLink size={14} className="shrink-0" />
                        </a>
                     </div>
                     <button 
                        onClick={handlePrintAudit}
                        className="print:hidden p-4 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-2xl transition-all flex flex-col items-center gap-1 border border-gray-100"
                        title="Download PDF/Print Audit"
                     >
                        <Download size={20} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">PDF Report</span>
                     </button>
                  </div>

                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#ff0000] font-mono">Web Vulnerabilities Audit</h4>
                      <div className="space-y-6">
                        {VULNERABILITIES.map((v, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between items-baseline">
                              <p className="text-sm font-black text-[#ff0000]">{v.name}</p>
                              <span className="text-[8px] font-black text-[#ff0000] uppercase border-b border-[#ff0000] pb-0.5">Risk: {v.risk}</span>
                            </div>
                            <p className="text-xs text-[#ff0000]/80 leading-relaxed">{v.desc}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Prospect Intelligence</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">CMS Detected</span>
                             <p className="text-xs font-black">{selectedLead.cms || 'WordPress (Inferred)'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Industry Sector</span>
                             <p className="text-xs font-black uppercase tracking-tight">{selectedLead.industry}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Project Category</span>
                             <p className="text-xs font-black uppercase tracking-tight">{selectedLead.projectType || 'General Redesign'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Potential Value</span>
                             <p className="text-xs font-black text-emerald-600">${(selectedLead.opportunityScore * 1000).toLocaleString()}+ EST.</p>
                          </div>
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contact Intel</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <a href={`mailto:${selectedLead.email}`} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors block overflow-hidden">
                             <Mail size={16} className="mb-2 text-gray-400" />
                             <p className="text-xs font-black truncate">{selectedLead.email}</p>
                          </a>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                             <Phone size={16} className="mb-2 text-gray-400" />
                             <p className="text-xs font-black">{selectedLead.phone || 'Unknown'}</p>
                          </div>
                       </div>
                    </section>

                    <section className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Direct Actions & Socials</h4>
                       <div className="flex flex-wrap gap-4">
                          {selectedLead.phone && (
                            <a 
                              href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-6 py-3 bg-emerald-500 text-white rounded-2xl shadow-sm hover:bg-emerald-600 transition-all font-black text-xs uppercase tracking-widest"
                            >
                              <MessageSquare size={18} />
                              Open WhatsApp
                            </a>
                          )}
                          <div className="flex gap-2">
                             {(selectedLead.facebook || selectedLead.socialMedia?.facebook) && (
                               <a href={selectedLead.facebook || selectedLead.socialMedia?.facebook} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                 <Facebook size={20} />
                               </a>
                             )}
                             {(selectedLead.linkedin || selectedLead.socialMedia?.linkedin) && (
                               <a href={selectedLead.linkedin || selectedLead.socialMedia?.linkedin} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-blue-700 hover:bg-blue-700 hover:text-white transition-all shadow-sm">
                                 <Linkedin size={20} />
                               </a>
                             )}
                             {(selectedLead.instagram || selectedLead.socialMedia?.instagram) && (
                               <a href={selectedLead.instagram || selectedLead.socialMedia?.instagram} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-pink-600 hover:bg-pink-600 hover:text-white transition-all shadow-sm">
                                 <Instagram size={20} />
                               </a>
                             )}
                             {(selectedLead.twitter || selectedLead.socialMedia?.twitter) && (
                               <a href={selectedLead.twitter || selectedLead.socialMedia?.twitter} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center text-black hover:bg-black hover:text-white transition-all shadow-sm">
                                 {getTwitterIcon(20)}
                               </a>
                             )}
                          </div>
                       </div>
                    </section>
                  </div>
                </div>

                {/* Pitch Section */}
                <div className="w-full lg:w-[400px] bg-gray-50 p-6 lg:p-10 flex flex-col min-h-[400px]">
                  <div className="mb-8 flex items-center justify-between text-gray-400">
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Outreach AI</h4>
                    <div className={`p-2 rounded-lg border-2 font-black text-xs ${getScoreColor(selectedLead.opportunityScore)}`}>
                      SCO {selectedLead.opportunityScore}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-[300px]">
                    {!pitch && !generatingPitch ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-gray-200">
                          <Mail size={40} />
                        </div>
                        <div className="space-y-2">
                           <h5 className="font-black text-gray-900">Custom Pitch Ready</h5>
                           <p className="text-[11px] font-bold text-gray-400 leading-relaxed px-4">Our AI will craft a personalized WordPress redesign proposal targeting their specific issues.</p>
                        </div>
                        <button 
                          onClick={() => handleGeneratePitch(selectedLead)}
                          className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          BUILD PROPOSAL
                        </button>
                      </div>
                    ) : generatingPitch ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                         <Loader2 size={32} className="animate-spin text-black" />
                         <p className="text-xs font-black uppercase tracking-widest animate-pulse">Analyzing Vulnerabilities...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group">
                            <button 
                              onClick={() => { navigator.clipboard.writeText(pitch!); }}
                              className="absolute top-4 right-4 p-2 bg-gray-50 rounded-lg hover:bg-black hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Copy size={14} />
                            </button>
                            <pre className="text-[11px] font-medium text-gray-600 whitespace-pre-wrap leading-relaxed font-sans">{pitch}</pre>
                         </div>
                         <button 
                           onClick={() => {
                             handleAddLead({
                               title: selectedLead.businessName,
                               companyName: selectedLead.businessName,
                               website: selectedLead.websiteUrl,
                               industry: selectedLead.industry,
                               email: selectedLead.email,
                               phone: selectedLead.phone,
                               whatsapp: selectedLead.whatsapp || selectedLead.phone,
                               facebook: selectedLead.facebook || selectedLead.socialMedia?.facebook || '',
                               linkedin: selectedLead.linkedin || selectedLead.socialMedia?.linkedin || '',
                               instagram: selectedLead.instagram || selectedLead.socialMedia?.instagram || '',
                               twitter: selectedLead.socialMedia?.twitter || selectedLead.socialMedia?.twitter || '',
                               opportunityScore: selectedLead.opportunityScore,
                               websiteIssues: selectedLead.websiteIssues || [],
                               cms: selectedLead.cms,
                               projectType: selectedLead.projectType || 'General Redesign',
                               status: 'New'
                             });
                             setActiveTab('all-leads');
                             setSelectedLead(null);
                             setPitch(null);
                             setFollowUp(null);
                             setDemoPrompt(null);
                           }}
                           className="w-full py-4 bg-emerald-500 text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-lg hover:bg-emerald-600 transition-all"
                         >
                            SYNC TO CRM
                         </button>
                         <button 
                          onClick={() => setPitch(null)}
                          className="w-full py-2 text-gray-400 font-bold text-[10px] uppercase hover:text-gray-900 transition-colors"
                         >
                            RE-GENERATE
                         </button>
                      </div>
                    )}

                    {/* Create Demo Section */}
                    <div className="mt-8 pt-8 border-t border-gray-200">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h5 className="font-black text-gray-900 text-sm">Need a Fresh Look?</h5>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Our AI will fix security issues and design a modern, conversion-focused demo based on your audit.</p>
                        </div>
                        
                        {!demoPrompt && !generatingDemo ? (
                          <button 
                            onClick={() => handleGenerateDemoPrompt(selectedLead!)}
                            className="w-full py-3 bg-white border border-gray-200 text-black font-black uppercase tracking-widest text-[10px] rounded-xl shadow-sm hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                          >
                            <TrendingUp size={14} />
                            Create Demo
                          </button>
                        ) : generatingDemo ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 size={24} className="animate-spin text-black" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Analyzing & Re-Architecting...</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2"
                            >
                              <CheckCircle2 size={14} className="text-emerald-500" />
                              <span className="text-[10px] font-bold text-emerald-700 uppercase">Your modern redesign prompt is ready!</span>
                            </motion.div>

                            <div className="space-y-4">
                              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">১. Visual Audit Summary</div>
                                <div className="text-[10px] font-medium text-gray-600 leading-relaxed whitespace-pre-line">
                                  {demoPrompt.visualAudit}
                                </div>
                              </div>

                              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">২. Key Improvements</div>
                                <div className="text-[10px] font-medium text-gray-600 leading-relaxed whitespace-pre-line">
                                  {demoPrompt.keyImprovements}
                                </div>
                              </div>
                              
                              <div className="p-4 bg-gray-900 rounded-2xl overflow-hidden relative group">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 flex justify-between items-center">
                                  <span>৩. Master Prompt for AI Studio</span>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(demoPrompt.masterPrompt);
                                    }}
                                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[9px] transition-colors"
                                  >
                                    COPY PROMPT
                                  </button>
                                </div>
                                <div className="text-[10px] font-mono text-gray-400 line-clamp-4 leading-relaxed bg-black/30 p-3 rounded-xl">
                                  {demoPrompt.masterPrompt}
                                </div>
                              </div>

                              <a 
                                href={`https://aistudio.google.com/app/prompts/new?text=${encodeURIComponent(demoPrompt.masterPrompt)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group border border-white/10"
                              >
                                <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                Build Demo on Google AI Studio
                              </a>

                              <button 
                                onClick={() => setDemoPrompt(null)}
                                className="w-full py-1 text-gray-400 font-bold text-[9px] uppercase hover:text-gray-900 transition-colors"
                              >
                                Create Another Version
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900">Export CRM Leads</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Select entries to include in audit report</p>
                </div>
                <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Plus className="rotate-45" size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black transition-all"
                      checked={selectedLeadsToExport.length === storedLeads.length && storedLeads.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadsToExport(storedLeads.map(l => l.id));
                        } else {
                          setSelectedLeadsToExport([]);
                        }
                      }}
                    />
                    <span className="text-sm font-black uppercase tracking-widest text-gray-400 group-hover:text-black transition-colors">Select All</span>
                  </label>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{selectedLeadsToExport.length} selected</span>
                </div>

                <div className="space-y-2">
                  {storedLeads.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm font-medium italic">
                      No Leads available for export.
                    </div>
                  ) : (
                    storedLeads.map((lead) => (
                      <label key={lead.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all cursor-pointer group">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black transition-all"
                            checked={selectedLeadsToExport.includes(lead.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeadsToExport(prev => [...prev, lead.id]);
                              } else {
                                setSelectedLeadsToExport(prev => prev.filter(id => id !== lead.id));
                              }
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{lead.companyName || lead.title}</p>
                            <p className="text-[10px] font-bold text-gray-400 truncate uppercase mt-0.5">{lead.email || 'No email'}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          lead.status === 'Completed' ? 'text-emerald-500 bg-emerald-100' :
                          lead.status === 'In Progress' ? 'text-blue-500 bg-blue-100' :
                          'text-gray-400 bg-gray-200'
                        }`}>
                          {lead.status}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button 
                    onClick={() => setExportFormat('doc')}
                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${
                      exportFormat === 'doc' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Download size={14} className="mb-1" />
                    .DOCX
                  </button>
                  <button 
                    onClick={() => setExportFormat('csv')}
                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${
                      exportFormat === 'csv' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <ClipboardList size={14} className="mb-1" />
                    .CSV
                  </button>
                  <button 
                    onClick={() => setExportFormat('json')}
                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${
                      exportFormat === 'json' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Globe size={14} className="mb-1" />
                    .JSON
                  </button>
                  <button 
                    onClick={() => setExportFormat('txt')}
                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${
                      exportFormat === 'txt' ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Plus size={14} className="mb-1" />
                    .TXT
                  </button>
                </div>
                
                <button 
                  onClick={() => {
                    if (exportFormat === 'doc') handleExportDoc();
                    else if (exportFormat === 'csv') handleExportCSV();
                    else if (exportFormat === 'json') handleExportJSON();
                    else if (exportFormat === 'txt') handleExportTXT();
                  }}
                  disabled={selectedLeadsToExport.length === 0}
                  className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Download size={18} />
                  Export {selectedLeadsToExport.length} Leads
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddLeadForm({ onAdd, initialData }: { onAdd: (lead: any) => void, initialData?: any }) {
  const [formData, setFormData] = useState<any>({
    id: initialData?.id || '',
    businessName: initialData?.businessName || '',
    status: initialData?.status || 'New',
    companyName: initialData?.businessName || initialData?.companyName || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    whatsapp: initialData?.whatsapp || '',
    facebook: initialData?.socialMedia?.facebook || '',
    linkedin: initialData?.socialMedia?.linkedin || '',
    instagram: initialData?.socialMedia?.instagram || '',
    twitter: initialData?.socialMedia?.twitter || '',
    projectType: initialData?.projectType || '',
    clientManager: initialData?.clientManager || '',
    website: initialData?.websiteUrl || initialData?.website || '',
    processingWork: initialData?.processingWork || '',
    industry: initialData?.industry || '',
    cms: initialData?.cms || '',
    websiteIssues: initialData?.websiteIssues || [],
    techStack: initialData?.techStack || [],
    auditResults: initialData?.auditResults || { performance: 0, security: 0, seo: 0, design: 0 },
    opportunityScore: initialData?.opportunityScore || 0
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState<string>('');
  const [followUpText, setFollowUpText] = useState<string | null>(null);
  const [demoPrompt, setDemoPrompt] = useState<DemoPromptResult | null>(null);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [genStep, setGenStep] = useState(1);

  const handleGenFollowUp = async (step: number) => {
    const leadObj: Lead = {
      id: formData.id,
      businessName: formData.companyName || '',
      websiteUrl: formData.website || '',
      email: formData.email || '',
      industry: formData.industry || '',
      websiteIssues: formData.websiteIssues || [],
      cms: formData.cms || '',
      phone: formData.phone || '',
      socialMedia: {
        facebook: formData.facebook,
        linkedin: formData.linkedin,
        instagram: formData.instagram,
        twitter: formData.twitter
      },
      opportunityScore: formData.opportunityScore || 0,
      status: formData.status || 'New',
      projectType: formData.projectType || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsGeneratingFollowUp(true);
    setGenStep(step);
    setFollowUpText(null);
    setDemoPrompt(null);
    try {
      const result = await generateFollowUp(leadObj, step);
      setFollowUpText(result);
    } catch (err) {
      console.error("Follow-up generation failed:", err);
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const handleGenDemo = async () => {
    const leadObj: Lead = {
      id: formData.id,
      businessName: formData.companyName || '',
      websiteUrl: formData.website || '',
      email: formData.email || '',
      industry: formData.industry || '',
      websiteIssues: formData.websiteIssues || [],
      cms: formData.cms || '',
      phone: formData.phone || '',
      socialMedia: {
        facebook: formData.facebook,
        linkedin: formData.linkedin,
        instagram: formData.instagram,
        twitter: formData.twitter
      },
      opportunityScore: formData.opportunityScore || 0,
      status: formData.status || 'New',
      projectType: formData.projectType || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsGeneratingDemo(true);
    setDemoPrompt(null);
    setFollowUpText(null);
    try {
      const result = await generateDemoPrompt(leadObj);
      setDemoPrompt(result);
    } catch (err) {
      console.error("Demo generation failed:", err);
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleEnrich = async () => {
    const query = formData.companyName || formData.website;
    if (!query) return;

    setIsEnriching(true);
    setEnrichmentStatus('Initializing Neural Audit...');
    
    // Status updates simulation while awaiting real data
    const statuses = [
      'Scanning Website Source...',
      'Analyzing Technical Stack...',
      'Identifying Vulnerabilities...',
      'Extracting Business Meta-data...',
      'Calculating Opportunity Score...',
      'Mapping Digital Presence...'
    ];
    
    let currentStatus = 0;
    const interval = setInterval(() => {
      if (currentStatus < statuses.length) {
        setEnrichmentStatus(statuses[currentStatus]);
        currentStatus++;
      }
    }, 2000);

    try {
      const data = await enrichLeadData(query);
      setFormData(prev => ({
        ...prev,
        companyName: data.businessName || prev.companyName,
        website: data.websiteUrl || prev.website,
        industry: data.industry || prev.industry,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        whatsapp: data.whatsapp || prev.whatsapp,
        facebook: data.socialMedia?.facebook || prev.facebook,
        linkedin: data.socialMedia?.linkedin || prev.linkedin,
        instagram: data.socialMedia?.instagram || prev.instagram,
        twitter: data.socialMedia?.twitter || prev.twitter,
        cms: data.cms || prev.cms,
        techStack: data.techStack || prev.techStack,
        websiteIssues: data.websiteIssues || prev.websiteIssues,
        auditResults: data.auditResults || prev.auditResults,
        opportunityScore: data.opportunityScore || prev.opportunityScore,
        projectType: data.projectType || prev.projectType
      }));
      setEnrichmentStatus('Audit Complete!');
    } catch (err) {
      console.error("Enrichment failed:", err);
      setEnrichmentStatus('Audit Interrupted');
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsEnriching(false);
        setEnrichmentStatus('');
      }, 1500);
    }
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        businessName: initialData.businessName || '',
        companyName: initialData.businessName || initialData.companyName || '',
        status: initialData.status || 'New',
        phone: initialData.phone || '',
        email: initialData.email || '',
        whatsapp: initialData.whatsapp || '',
        facebook: initialData.socialMedia?.facebook || '',
        linkedin: initialData.socialMedia?.linkedin || '',
        instagram: initialData.socialMedia?.instagram || '',
        twitter: initialData.socialMedia?.twitter || '',
        projectType: initialData.projectType || '',
        clientManager: initialData.clientManager || '',
        website: initialData.websiteUrl || initialData.website || '',
        processingWork: initialData.processingWork || '',
        industry: initialData.industry || '',
        cms: initialData.cms || '',
        websiteIssues: initialData.websiteIssues || [],
        techStack: initialData.techStack || [],
        auditResults: initialData.auditResults || { performance: 0, security: 0, seo: 0, design: 0 },
        opportunityScore: initialData.opportunityScore || 0
      });
    } else {
      // Keep existing data or initialize if first time
      setFormData(prev => ({
        ...prev,
        id: prev.id || '',
        businessName: prev.businessName || '',
        companyName: prev.companyName || '',
        status: prev.status || 'New',
        phone: prev.phone || '',
        email: prev.email || '',
        whatsapp: prev.whatsapp || '',
        facebook: prev.facebook || '',
        linkedin: prev.linkedin || '',
        instagram: prev.instagram || '',
        twitter: prev.twitter || '',
        projectType: prev.projectType || '',
        clientManager: prev.clientManager || '',
        website: prev.website || '',
        processingWork: prev.processingWork || '',
        industry: prev.industry || '',
        cms: prev.cms || '',
        websiteIssues: prev.websiteIssues || [],
        techStack: prev.techStack || [],
        auditResults: prev.auditResults || { performance: 0, security: 0, seo: 0, design: 0 },
        opportunityScore: prev.opportunityScore || 0
      }));
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-bold flex items-center gap-2 mb-4 overflow-hidden"
          >
            <CheckCircle2 size={16} /> Lead saved successfully!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-1.5 flex flex-col justify-end">
           <FormInput label="Title/Ref" name="businessName" value={formData.businessName} onChange={handleChange} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</label>
          <select 
            name="status"
            value={formData.status ?? 'New'}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm"
          >
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Meeting">Meeting</option>
            <option value="Proposal">Proposal</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
        <div className="space-y-1.5 relative flex flex-col justify-end">
          <FormInput label="Business Name / URL" name="companyName" value={formData.companyName} onChange={handleChange} required />
          <button 
            type="button"
            onClick={handleEnrich}
            disabled={isEnriching || (!formData.companyName && !formData.website)}
            className="absolute right-2 bottom-2 px-3 py-1.5 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-1.5 min-w-[120px] justify-center"
          >
            {isEnriching ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                <span className="truncate max-w-[80px]">{enrichmentStatus || 'Scraping...'}</span>
              </>
            ) : (
              <>
                <Search size={10} />
                AI Magic Audit
              </>
            )}
          </button>
        </div>
        <FormInput label="Industry" name="industry" value={formData.industry} onChange={handleChange} />
        <FormInput label="CMS" name="cms" value={formData.cms} onChange={handleChange} />
        <FormInput label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} />
        <FormInput label="Email Address" name="email" value={formData.email} onChange={handleChange} type="email" required />
        <FormInput label="WhatsApp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} />
        <FormInput label="Facebook Profile" name="facebook" value={formData.facebook} onChange={handleChange} />
        <FormInput label="LinkedIn Profile" name="linkedin" value={formData.linkedin} onChange={handleChange} />
        <FormInput label="Instagram Profile" name="instagram" value={formData.instagram} onChange={handleChange} />
        <FormInput label="X (Twitter) Profile" name="twitter" value={formData.twitter} onChange={handleChange} />
        <FormInput label="Project Type" name="projectType" value={formData.projectType} onChange={handleChange} />
        <FormInput label="Client Manager" name="clientManager" value={formData.clientManager} onChange={handleChange} />
        <FormInput label="Website Link" name="website" value={formData.website} onChange={handleChange} />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Processing Work (Notes)</label>
        <textarea 
          name="processingWork"
          value={formData.processingWork ?? ''}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 font-medium text-sm leading-relaxed"
          placeholder="Describe the current progress or specific client needs..."
        />
      </div>

      <div className="pt-4 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <button 
            type="submit"
            className="px-12 py-4 bg-black text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-gray-800 transition-all shadow-xl active:scale-95"
          >
            {initialData ? 'Update Lead in CRM' : 'Register New Lead'}
          </button>

          {initialData && (
            <div className="flex flex-wrap gap-2">
              <button 
                type="button"
                onClick={() => handleGenFollowUp(1)}
                disabled={isGeneratingFollowUp}
                className="px-4 py-3 bg-blue-50 text-blue-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2 border border-blue-100"
              >
                {isGeneratingFollowUp && genStep === 1 ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                1st Follow-up
              </button>
              <button 
                type="button"
                onClick={() => handleGenFollowUp(2)}
                disabled={isGeneratingFollowUp}
                className="px-4 py-3 bg-purple-50 text-purple-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-purple-100 transition-all flex items-center gap-2 border border-purple-100"
              >
                {isGeneratingFollowUp && genStep === 2 ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                2nd Follow-up
              </button>
              <button 
                type="button"
                onClick={() => handleGenFollowUp(3)}
                disabled={isGeneratingFollowUp}
                className="px-4 py-3 bg-orange-50 text-orange-600 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-orange-100 transition-all flex items-center gap-2 border border-orange-100"
              >
                {isGeneratingFollowUp && genStep === 3 ? <Loader2 size={12} className="animate-spin" /> : <BellOff size={12} />}
                3rd (Break-up)
              </button>
              <button 
                type="button"
                onClick={handleGenDemo}
                disabled={isGeneratingDemo}
                className="px-4 py-3 bg-white border border-gray-200 text-black font-black uppercase tracking-widest text-[10px] rounded-xl shadow-sm hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
              >
                {isGeneratingDemo ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Create Demo
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {followUpText && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-6 relative group"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  AI Generated Follow-up (Sequence #{genStep})
                </span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(followUpText);
                    alert("Message copied to clipboard!");
                  }}
                  className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-black transition-all"
                  title="Copy Message"
                >
                  <Copy size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                {followUpText}
              </p>
            </motion.div>
          )}

          {demoPrompt && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 italic">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Visual Audit Summary</div>
                <div className="text-xs font-medium text-gray-600 leading-relaxed whitespace-pre-line">
                  {demoPrompt.visualAudit}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Key Improvements</div>
                <div className="text-xs font-medium text-gray-600 leading-relaxed whitespace-pre-line">
                  {demoPrompt.keyImprovements}
                </div>
              </div>
              
              <div className="p-4 bg-gray-900 rounded-2xl overflow-hidden relative group">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 flex justify-between items-center">
                  <span>Master Prompt for AI Studio</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(demoPrompt.masterPrompt);
                      alert("Prompt copied!");
                    }}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[9px] transition-colors"
                  >
                    COPY PROMPT
                  </button>
                </div>
                <div className="text-xs font-mono text-gray-400 line-clamp-4 leading-relaxed bg-black/30 p-3 rounded-xl">
                  {demoPrompt.masterPrompt}
                </div>
              </div>

              <a 
                href={`https://aistudio.google.com/app/prompts/new?text=${encodeURIComponent(demoPrompt.masterPrompt)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-black text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group border border-white/10"
              >
                <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                Build Demo on Google AI Studio
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

function LeadCard({ lead, onDelete, onEdit }: { lead: Lead, onDelete: (id: string) => void, onEdit: (lead: any) => void, key?: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <motion.div 
      layout
      className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden group hover:border-black transition-all"
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-1">
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${
              lead.status === 'Won' ? 'bg-emerald-50 text-emerald-600' :
              lead.status === 'Meeting' ? 'bg-blue-50 text-blue-600' :
              lead.status === 'Proposal' ? 'bg-purple-50 text-purple-600' :
              lead.status === 'Lost' ? 'bg-red-50 text-red-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {lead.status}
            </div>
            {lead.industry && (
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{lead.industry}</span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
             {lead.opportunityScore > 0 && (
               <div className="flex flex-col items-end">
                 <div className={`text-lg font-black tracking-tighter ${getScoreColor(lead.opportunityScore)}`}>
                   {lead.opportunityScore}%
                 </div>
                 <div className="text-[8px] font-black uppercase tracking-widest text-gray-300">Opportunity</div>
               </div>
             )}
             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => onEdit(lead)}
                 className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-black"
               >
                 <Edit2 size={14} />
               </button>
               <button 
                 onClick={() => onDelete(lead.id)}
                 className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
               >
                 <Trash2 size={14} />
               </button>
             </div>
          </div>
        </div>

        <h4 className="text-xl font-black text-gray-900 leading-tight mb-1">{lead.businessName || "Untitled Lead"}</h4>
        
        {lead.techStack && lead.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
            {lead.techStack.slice(0, 3).map((tech, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-md text-[8px] font-black uppercase tracking-widest text-gray-400">
                {tech}
              </span>
            ))}
            {lead.techStack.length > 3 && (
              <span className="text-[8px] font-black text-gray-300">+{lead.techStack.length - 3} More</span>
            )}
          </div>
        )}

        <div className="space-y-3 pb-4 border-b border-gray-100 mt-4">
          <div className="flex items-center gap-3 text-xs font-bold text-gray-600 truncate">
            <Mail size={14} className="text-gray-300 shrink-0" /> {lead.email || 'No email provided'}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs font-bold text-gray-600 flex-1">
              <Phone size={14} className="text-gray-300 shrink-0" /> {lead.phone || 'N/A'}
            </div>
            {lead.whatsapp && (
              <a 
                href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shrink-0"
              >
                <MessageSquare size={14} />
              </a>
            )}
          </div>
          {lead.websiteUrl && (
            <div className="flex items-center gap-3 text-xs font-bold text-gray-600 truncate">
              <Globe size={14} className="text-gray-300 shrink-0" /> {lead.websiteUrl}
            </div>
          )}
        </div>

        <div className="pt-4 flex items-center justify-between gap-4">
          <div className="flex gap-2 shrink-0">
            {lead.socialMedia?.facebook && (
              <a href={lead.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                <Facebook size={15} />
              </a>
            )}
            {lead.socialMedia?.linkedin && (
              <a href={lead.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-700 transition-colors">
                <Linkedin size={15} />
              </a>
            )}
            {lead.socialMedia?.instagram && (
              <a href={lead.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 transition-colors">
                <Instagram size={15} />
              </a>
            )}
            {lead.socialMedia?.twitter && (
              <a href={lead.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                {getTwitterIcon()}
              </a>
            )}
          </div>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100"
          >
            {isExpanded ? 'Hide Details' : 'View Details'}
          </button>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 mt-4 border-t border-gray-100 space-y-6">
                {lead.auditResults && (
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Technical Audit Report</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                       <AuditScore label="Performance" score={lead.auditResults.performance} />
                       <AuditScore label="Security" score={lead.auditResults.security} />
                       <AuditScore label="SEO" score={lead.auditResults.seo} />
                       <AuditScore label="UI/UX Design" score={lead.auditResults.design} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Project Type" value={lead.projectType} />
                  <DetailRow label="Client Manager" value={lead.clientManager} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="CMS Engine" value={lead.cms} />
                  <DetailRow label="Lead Score" value={`${lead.opportunityScore}%`} />
                </div>
                
                {lead.techStack && lead.techStack.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Detailed Tech Stack</span>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.techStack.map((tech, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Identified Vulnerabilities</span>
                  <div className="flex flex-wrap gap-2">
                    {lead.websiteIssues.map((issue, idx) => (
                      <div key={idx} className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        <span className="text-[10px] font-bold text-red-700 uppercase tracking-tight">{issue}</span>
                      </div>
                    ))}
                    {lead.websiteIssues.length === 0 && (
                      <span className="text-xs font-medium text-gray-400 italic">No specific issues identified yet.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Internal Processing Notes</span>
                  <p className="text-xs font-medium text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl min-h-[80px] border border-gray-100">
                    {lead.processingWork || 'Scan complete. No manual notes added.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AuditScore({ label, score }: { label: string, score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return 'bg-emerald-500';
    if (s >= 75) return 'bg-blue-500';
    if (s >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</span>
        <span className={`text-xs font-black ${score >= 90 ? 'text-emerald-600' : score <= 50 ? 'text-red-600' : 'text-gray-900'}`}>{score}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full rounded-full ${getColor(score)} transition-all duration-1000`}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">{label}</span>
      <span className="font-black text-gray-900">{value || 'N/A'}</span>
    </div>
  );
}

function FormInput({ label, name, value, onChange, type = "text", required = false }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 font-bold text-sm transition-all"
        placeholder={`Enter ${label.toLowerCase()}...`}
      />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all transform active:scale-95 ${
        active 
          ? 'bg-black text-white shadow-lg' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group hover:border-black transition-colors overflow-hidden">
       <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 transform rotate-12 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-400 font-black uppercase tracking-widest text-[9px]">{label}</span>
        </div>
        <div className="text-4xl font-black mb-2 tracking-tighter">{value}</div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{trend}</div>
      </div>
    </div>
  );
}


