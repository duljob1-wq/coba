
import React, { useEffect, useState, useRef } from 'react';
import { getTrainings, deleteTraining, getResponses, getGlobalQuestions, saveGlobalQuestion, deleteGlobalQuestion, getContacts, saveContact, deleteContact, getSettings, saveSettings, resetApplicationData, saveTraining, exportAllData, importAllData, getThemes, saveTheme, deleteTheme, getGuestEntries, clearGuestEntries } from '../services/storageService';
import { exportToPDF, exportToExcel, exportToWord } from '../services/exportService';
import { Training, GlobalQuestion, QuestionType, Contact, AppSettings, TrainingTheme, Question, GuestEntry } from '../types';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Eye, Share2, LogOut, X, Check, Users, Calendar, Hash, Database, Pencil, LayoutDashboard, FileText, Settings, Search, Contact as ContactIcon, Phone, RotateCcw, Download, FileSpreadsheet, File as FileIcon, Printer, ChevronDown, MessageSquare, Upload, CloudDownload, AlertCircle, Copy as CopyIcon, Link as LinkIcon, Smartphone, List, Save, Layout, Layers, CheckCircle, BookOpen, Lock, Unlock, Shield, Key, Globe } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import LZString from 'lz-string';
import { QuestionBuilder } from '../components/QuestionBuilder';

type MenuTab = 'management' | 'variables' | 'reports' | 'contacts' | 'guestbook' | 'security';
type SettingsTab = 'training' | 'whatsapp' | 'backup' | 'reset';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MenuTab>('management');
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Management State
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [mgmtSearch, setMgmtSearch] = useState('');
  const [mgmtDateStart, setMgmtDateStart] = useState('');
  const [mgmtDateEnd, setMgmtDateEnd] = useState('');
  
  // Management Filters
  const [filterMethod, setFilterMethod] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  // Report Filters (New)
  const [reportSearch, setReportSearch] = useState('');
  const [reportDateStart, setReportDateStart] = useState('');
  const [reportDateEnd, setReportDateEnd] = useState('');
  const [reportFilterMethod, setReportFilterMethod] = useState('');
  const [reportFilterLocation, setReportFilterLocation] = useState('');

  // Delete Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAuthInput, setDeleteAuthInput] = useState(''); // New State for Delete Password

  // Variables & Themes State
  const [globalQuestions, setGlobalQuestions] = useState<GlobalQuestion[]>([]);
  const [themes, setThemes] = useState<TrainingTheme[]>([]);
  const [newQVar, setNewQVar] = useState<{label: string, type: QuestionType, category: 'facilitator'|'process', isDefault: boolean}>({
      label: '', type: 'star', category: 'facilitator', isDefault: true
  });
  const [activeTheme, setActiveTheme] = useState<TrainingTheme | null>(null); // For editing/creating
  const [isEditingTheme, setIsEditingTheme] = useState(false); // Mode toggle
  const [variableSubTab, setVariableSubTab] = useState<'bank'|'themes'>('themes');

  // Contacts State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<{name: string, whatsapp: string}>({ name: '', whatsapp: '' });
  const [contactSearch, setContactSearch] = useState('');
  const contactFileInputRef = useRef<HTMLInputElement>(null);

  // Guest Book State
  const [guestEntries, setGuestEntries] = useState<GuestEntry[]>([]);

  // Reports State
  const [exportDropdownId, setExportDropdownId] = useState<string | null>(null); 
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState<{ shortUrl: string; fullUrl: string; title: string; accessCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'code'>('link');

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('training');
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  
  // Security State (Superadmin)
  const [securitySettings, setSecuritySettings] = useState<{admin: string, super: string, delete: string}>({admin: '', super: '', delete: ''});
  const [showSecurityPass, setShowSecurityPass] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check role
    const isSuper = sessionStorage.getItem('isSuperAdmin') === 'true';
    setIsSuperAdmin(isSuper);

    refreshData();
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshData = async () => {
    const fetchedTrainings = await getTrainings();
    setTrainings(fetchedTrainings);

    // Fetch response counts asynchronously
    const counts: Record<string, number> = {};
    await Promise.all(fetchedTrainings.map(async (t) => {
        const res = await getResponses(t.id);
        counts[t.id] = res.length;
    }));
    setResponseCounts(counts);

    setGlobalQuestions(await getGlobalQuestions());
    setThemes(await getThemes());
    setContacts(await getContacts());
    
    const settings = await getSettings();
    setAppSettings(settings);
    setSecuritySettings({
        admin: settings.adminPassword || '12345',
        super: settings.superAdminPassword || 'supersimep',
        delete: settings.deletePassword || 'adm123'
    });

    setGuestEntries(await getGuestEntries());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('isSuperAdmin');
    navigate('/admin');
  };

  const executeDelete = async () => {
    if (!deleteTargetId) return;
    
    // PASSWORD CHECK
    const requiredPass = appSettings.deletePassword || 'adm123';
    if (deleteAuthInput !== requiredPass) {
        alert("Kode otorisasi (Sandi) salah!");
        return;
    }

    setIsDeleting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      await deleteTraining(deleteTargetId);
      await refreshData();
      setDeleteTargetId(null);
      setDeleteAuthInput(''); // Reset password input
    } catch (err) {
      alert('Gagal menghapus data.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyTraining = async (source: Training) => {
    const copiedTraining: Training = {
      ...source,
      id: uuidv4(),
      accessCode: Math.random().toString(36).substring(2, 7).toUpperCase(),
      title: `${source.title} (Salinan)`,
      createdAt: Date.now(),
      reportedTargets: {}
    };
    await saveTraining(copiedTraining);
    refreshData();
  };

  const handleSaveVariable = async () => {
      if(!newQVar.label) return;
      await saveGlobalQuestion({
          id: uuidv4(),
          label: newQVar.label,
          type: newQVar.type,
          category: newQVar.category,
          isDefault: newQVar.isDefault
      });
      setNewQVar({ ...newQVar, label: '' }); 
      refreshData();
  };

  const handleUpdateGlobalType = async (q: GlobalQuestion, newType: QuestionType) => {
      await saveGlobalQuestion({ ...q, type: newType });
      refreshData();
  };

  // Theme Management Functions
  const handleCreateTheme = () => {
      const newTheme: TrainingTheme = {
          id: uuidv4(),
          name: '',
          facilitatorQuestions: [],
          processQuestions: []
      };
      setActiveTheme(newTheme);
      setIsEditingTheme(true);
  };

  const handleEditTheme = (theme: TrainingTheme) => {
      setActiveTheme({ ...theme }); // Deep copy (shallow first level is enough as QuestionBuilder updates via array replacement)
      setIsEditingTheme(true);
  };

  const handleSaveTheme = async () => {
      if (activeTheme && activeTheme.name) {
          await saveTheme(activeTheme);
          setActiveTheme(null);
          setIsEditingTheme(false);
          refreshData();
      } else {
          alert("Nama tema tidak boleh kosong");
      }
  };

  const handleDeleteTheme = async (id: string) => {
      if(confirm("Hapus tema ini?")) {
          await deleteTheme(id);
          refreshData();
      }
  };


  const handleSaveContact = async () => {
      if(!newContact.name) return;
      await saveContact({ id: uuidv4(), name: newContact.name, whatsapp: newContact.whatsapp });
      setNewContact({ name: '', whatsapp: '' });
      refreshData();
  };

  const handleDeleteContact = async (c: Contact) => {
      if (confirm(`Apakah Anda yakin ingin menghapus kontak "${c.name}"?`)) {
          await deleteContact(c.id);
          refreshData();
      }
  };

  const handleExportContacts = () => {
      const dataToExport = contacts.map(c => ({
          'Nama': c.name,
          'WhatsApp': c.whatsapp
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(wb, ws, "Daftar Kontak");
      XLSX.writeFile(wb, "Kontak_Fasilitator_SIMEP.xlsx");
  };

  const handleImportContacts = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const data = XLSX.utils.sheet_to_json(ws);

            let count = 0;
            // Use for...of to support await inside loop
            for (const row of (data as any[])) {
                const name = row['Nama'] || row['nama'] || row['Name'];
                let wa = row['WhatsApp'] || row['whatsapp'] || row['No Telpon'] || row['Phone'] || row['No. HP'];

                if (name) {
                    if (wa) {
                        wa = String(wa).replace(/[^0-9]/g, ''); 
                    }
                    await saveContact({
                        id: uuidv4(),
                        name: String(name),
                        whatsapp: wa ? String(wa) : ''
                    });
                    count++;
                }
            }
            alert(`Berhasil mengimpor ${count} kontak baru.`);
            refreshData();
          } catch (err) {
              console.error(err);
              alert("Gagal membaca file. Pastikan format Excel (.xlsx) valid.");
          }
      };
      reader.readAsBinaryString(file);
      if (contactFileInputRef.current) contactFileInputRef.current.value = '';
  };

  const handleToggleGuestBook = async () => {
      const newStatus = !appSettings.isGuestBookOpen;
      const updated = { ...appSettings, isGuestBookOpen: newStatus };
      await saveSettings(updated);
      setAppSettings(updated);
      // refreshData not strictly needed as local state updated, but good practice
  };

  const handleClearGuestBook = async () => {
      if(confirm("Hapus seluruh riwayat buku tamu?")) {
          await clearGuestEntries();
          refreshData();
      }
  };

  const handleSaveSettings = async () => {
      await saveSettings(appSettings);
      setShowSettingsModal(false);
      refreshData();
  };

  const handleSaveSecurity = async () => {
      if (!securitySettings.admin || !securitySettings.super || !securitySettings.delete) {
          alert('Semua kolom password harus diisi!');
          return;
      }
      const updated = { 
          ...appSettings, 
          adminPassword: securitySettings.admin,
          superAdminPassword: securitySettings.super,
          deletePassword: securitySettings.delete
      };
      await saveSettings(updated);
      setAppSettings(updated);
      alert('Pengaturan akses berhasil diperbarui.');
  };

  const formatDateID = (dateStr: string) => {
     if (!dateStr) return '';
     return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Filtered Logic for Management Tab
  const filteredMgmtTrainings = trainings
    .filter(t => {
      const matchSearch = t.title.toLowerCase().includes(mgmtSearch.toLowerCase());
      let matchDate = true;
      if (mgmtDateStart && mgmtDateEnd) {
        matchDate = (t.startDate <= mgmtDateEnd) && (t.endDate >= mgmtDateStart);
      }
      
      const matchMethod = filterMethod ? t.learningMethod === filterMethod : true;
      const matchLocation = filterLocation ? t.location === filterLocation : true;

      return matchSearch && matchDate && matchMethod && matchLocation;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  // Filtered Logic for Reports Tab (New)
  const filteredReportTrainings = trainings
    .filter(t => {
      const matchSearch = t.title.toLowerCase().includes(reportSearch.toLowerCase());
      let matchDate = true;
      if (reportDateStart && reportDateEnd) {
        matchDate = (t.startDate <= reportDateEnd) && (t.endDate >= reportDateStart);
      }
      
      const matchMethod = reportFilterMethod ? t.learningMethod === reportFilterMethod : true;
      const matchLocation = reportFilterLocation ? t.location === reportFilterLocation : true;

      return matchSearch && matchDate && matchMethod && matchLocation;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const filteredContacts = contacts
    .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.whatsapp.includes(contactSearch))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openShareModal = (training: Training) => {
    const origin = window.location.origin;
    const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    const cleanUrl = `${baseUrl}/#/evaluate/${training.id}`;

    setShareData({ 
        shortUrl: cleanUrl, 
        fullUrl: cleanUrl, 
        title: training.title, 
        accessCode: training.accessCode || 'N/A' 
    });
    setCopied(false);
    setShareTab('link');
    setShowShareModal(true);
  };

  const copyToClipboard = async (text: string) => {
    try { 
        await navigator.clipboard.writeText(text); 
        setCopied(true); 
        setTimeout(() => setCopied(false), 2000); 
    } catch (err) {}
  };

  const handleResetApplication = async () => {
    if (confirm('Hapus seluruh data aplikasi secara permanen?')) {
        await resetApplicationData();
        refreshData();
        setShowSettingsModal(false);
        navigate('/admin');
    }
  };

  // --- CONTACTS HELPERS ---
  const getCountryCode = (num: string) => {
      if (num.startsWith('+60')) return 'mys';
      if (num.startsWith('+65')) return 'sgp';
      if (num.startsWith('+1')) return 'usa';
      if (num.startsWith('+61')) return 'aus';
      if (num.startsWith('+81')) return 'jpn';
      if (num.startsWith('+44')) return 'gbr';
      if (num.startsWith('+966')) return 'sau';
      return 'idn';
  };

  const countryLabel = getCountryCode(newContact.whatsapp);
  
  const isDuplicateName = newContact.name.length > 2 && contacts.some(c => c.name.toLowerCase().includes(newContact.name.toLowerCase()));
  const isDuplicatePhone = newContact.whatsapp.length > 4 && contacts.some(c => c.whatsapp.replace(/[^0-9]/g, '') === newContact.whatsapp.replace(/[^0-9]/g, ''));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <nav className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
          {/* ... Navbar content same as before ... */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${isSuperAdmin ? 'bg-amber-500' : 'bg-indigo-500'}`}>S</div>
                      <div className="flex flex-col">
                          <span className="font-bold text-lg text-white leading-none">SIMEP <span className={isSuperAdmin ? 'text-amber-400' : 'text-indigo-400'}>{isSuperAdmin ? 'Super' : 'Admin'}</span></span>
                      </div>
                  </div>

                  <div className="flex space-x-2 overflow-x-auto mx-4">
                      {(['management', 'variables', 'contacts', 'reports', 'guestbook'] as MenuTab[]).map((tab) => (
                          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                              {tab === 'management' && <LayoutDashboard size={18}/>}
                              {tab === 'variables' && <Database size={18}/>}
                              {tab === 'contacts' && <ContactIcon size={18}/>}
                              {tab === 'reports' && <FileText size={18}/>}
                              {tab === 'guestbook' && <BookOpen size={18}/>}
                              <span className="capitalize">{tab === 'management' ? 'Manajemen' : tab === 'variables' ? 'Variabel' : tab === 'contacts' ? 'Kontak' : tab === 'reports' ? 'Laporan' : 'Buku Tamu'}</span>
                          </button>
                      ))}
                      
                      {isSuperAdmin && (
                          <button onClick={() => setActiveTab('security')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === 'security' ? 'bg-amber-600 text-white' : 'text-amber-300 hover:bg-slate-800 border border-amber-900/30'}`}>
                              <Shield size={18}/>
                              <span>Pengaturan Akses</span>
                          </button>
                      )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowSettingsModal(true)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"><Settings size={20} /></button>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-slate-800"><LogOut size={18} /></button>
                  </div>
              </div>
          </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {activeTab === 'management' && (
            <div className="animate-in fade-in duration-300">
                {/* ... (Management Tab Content - unchanged) ... */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Manajemen Pelatihan</h2>
                        <p className="text-slate-500 text-sm">Kelola daftar pelatihan aktif anda.</p>
                    </div>
                    <Link to="/admin/create" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 font-medium">
                        <Plus size={18} /> Buat Baru
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4 relative">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cari Pelatihan</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input type="text" value={mgmtSearch} onChange={e => setMgmtSearch(e.target.value)} placeholder="Nama pelatihan..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
                            <input type="date" value={mgmtDateStart} onChange={e => setMgmtDateStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Hingga Tanggal</label>
                            <input type="date" value={mgmtDateEnd} onChange={e => setMgmtDateEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        {/* New Filters */}
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Metode</label>
                            <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="">Semua</option>
                                <option value="Klasikal">Klasikal</option>
                                <option value="Blended">Blended</option>
                                <option value="Daring Learning">Daring</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Kampus</label>
                            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="">Semua</option>
                                <option value="Surabaya">SBY</option>
                                <option value="Malang">MLG</option>
                                <option value="Madiun">MDN</option>
                            </select>
                        </div>

                        <div className="md:col-span-1">
                            <button onClick={() => {setMgmtSearch(''); setMgmtDateStart(''); setMgmtDateEnd(''); setFilterMethod(''); setFilterLocation('');}} className="p-2 text-slate-400 hover:text-red-500 w-full flex justify-center items-center h-full border border-transparent hover:border-red-100 rounded-lg"><RotateCcw size={20}/></button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMgmtTrainings.map(t => (
                        <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden group">
                            <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1.5 rounded-bl-xl border-l border-b border-slate-200">
                                <span className="text-indigo-600 font-mono font-bold text-sm">{t.accessCode}</span>
                            </div>
                            <div className="p-6 pt-10 flex-1">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2" title={t.title}>{t.title}</h3>
                                <div className="space-y-2 mt-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-2"><Calendar size={14} /> <span>{new Date(t.startDate).toLocaleDateString('id-ID')}</span></div>
                                    <div className="flex items-center gap-2"><Users size={14} /> <span>{t.facilitators.length} Fasilitator</span></div>
                                    {/* Display Badges for Method/Location if exists */}
                                    {(t.learningMethod || t.location) && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {t.learningMethod && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{t.learningMethod}</span>}
                                            {t.location && <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{t.location}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <button onClick={() => openShareModal(t)} className="text-indigo-600 text-sm font-semibold flex items-center gap-1 hover:text-indigo-800"><Share2 size={16}/> Bagikan</button>
                                <div className="flex gap-1">
                                    <Link to={`/admin/results/${t.id}`} className="p-2 text-slate-400 hover:text-indigo-600 transition"><Eye size={18}/></Link>
                                    <button onClick={() => handleCopyTraining(t)} className="p-2 text-slate-400 hover:text-blue-600 transition"><CopyIcon size={18}/></button>
                                    <Link to={`/admin/edit/${t.id}`} className="p-2 text-slate-400 hover:text-amber-600 transition"><Pencil size={18}/></Link>
                                    <button onClick={() => { setDeleteTargetId(t.id); setDeleteAuthInput(''); }} className="p-2 text-slate-400 hover:text-red-600 transition"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* ... (Rest of the component remains largely unchanged, just context continuation) ... */}
        {activeTab === 'variables' && (
            <div className="animate-in fade-in duration-300 max-w-5xl mx-auto">
                 {/* ... Variables Content ... */}
                 {/* Re-implementing Variables Tab to ensure file integrity */}
                 <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Variabel Pelatihan</h2>
                    <p className="text-slate-500 text-sm">Kelola tema dan paket pertanyaan evaluasi.</p>
                </div>
                {/* Tabs for Themes vs Bank */}
                <div className="flex items-center gap-2 mb-6">
                     <button 
                        onClick={() => { setVariableSubTab('themes'); setIsEditingTheme(false); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${variableSubTab === 'themes' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                     >
                        <List size={16} /> Tema Pelatihan
                     </button>
                     <button 
                        onClick={() => setVariableSubTab('bank')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${variableSubTab === 'bank' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                     >
                        <Database size={16} /> Bank Pertanyaan Global
                     </button>
                </div>

                {variableSubTab === 'bank' && (
                    <div className="animate-in fade-in">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Plus size={16} /> Tambah Variabel Global Baru
                            </h3>
                            <div className="space-y-4">
                                {/* Baris 1: Label */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Pertanyaan / Variabel</label>
                                    <input 
                                        type="text" 
                                        value={newQVar.label} 
                                        onChange={e => setNewQVar({...newQVar, label: e.target.value})} 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder="Contoh: Penguasaan Materi" 
                                    />
                                </div>

                                {/* Baris 2: Kategori, Tipe, Default, Tombol */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Kategori</label>
                                        <div className="relative">
                                            <select 
                                                value={newQVar.category} 
                                                onChange={e => setNewQVar({...newQVar, category: e.target.value as 'facilitator'|'process'})} 
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="facilitator">Evaluasi Fasilitator</option>
                                                <option value="process">Evaluasi Penyelenggaraan</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                        </div>
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipe Penilaian</label>
                                        <div className="relative">
                                            <select 
                                                value={newQVar.type} 
                                                onChange={e => setNewQVar({...newQVar, type: e.target.value as QuestionType})} 
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="star">★ Bintang</option>
                                                <option value="slider">⸺ Skala 100</option>
                                                <option value="text">¶ Teks</option>
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                        </div>
                                    </div>
                                    
                                    <div className="md:col-span-1 flex items-center h-[38px]">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={newQVar.isDefault} 
                                                onChange={e => setNewQVar({...newQVar, isDefault: e.target.checked})} 
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-700">Jadikan Default</span>
                                                <span className="text-[10px] text-slate-400 leading-none">Otomatis di pelatihan baru</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="md:col-span-1">
                                        <button 
                                            onClick={handleSaveVariable} 
                                            disabled={!newQVar.label}
                                            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                                        >
                                            Tambah
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border divide-y">
                            {globalQuestions.map(q => (
                                <div key={q.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 gap-4">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800">{q.label}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${q.category === 'facilitator' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'}`}>
                                                {q.category === 'facilitator' ? 'Fasilitator' : 'Penyelenggaraan'}
                                            </span>
                                            {q.isDefault && (
                                                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    <CheckCircle size={10} /> Default
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <select
                                                value={q.type}
                                                onChange={(e) => handleUpdateGlobalType(q, e.target.value as QuestionType)}
                                                className="appearance-none bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-xs font-semibold rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all w-32 shadow-sm"
                                            >
                                                <option value="star">★ Bintang</option>
                                                <option value="slider">⸺ Skala</option>
                                                <option value="text">¶ Teks</option>
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                <ChevronDown size={14} />
                                            </div>
                                        </div>
                                        <button onClick={async () => { await deleteGlobalQuestion(q.id); refreshData(); }} className="text-slate-400 hover:text-red-500 p-2 transition bg-slate-50 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {globalQuestions.length === 0 && (
                                <div className="p-8 text-center text-slate-400 italic text-sm">Belum ada variabel global.</div>
                            )}
                        </div>
                    </div>
                )}
                {variableSubTab === 'themes' && (
                     // ... Theme Content (Unchanged)
                     <div className="animate-in fade-in">
                        {isEditingTheme && activeTheme ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800">{activeTheme.name ? `Edit Tema: ${activeTheme.name}` : 'Buat Tema Baru'}</h3>
                                    <button onClick={() => setIsEditingTheme(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-600 mb-2">Nama Tema Pelatihan</label>
                                        <input 
                                            type="text" 
                                            value={activeTheme.name} 
                                            onChange={(e) => setActiveTheme({...activeTheme, name: e.target.value})} 
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Contoh: Pelatihan Teknis Medis"
                                        />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                             <QuestionBuilder 
                                                title="Variabel Fasilitator" 
                                                questions={activeTheme.facilitatorQuestions} 
                                                onChange={(qs) => setActiveTheme({...activeTheme, facilitatorQuestions: qs})} 
                                             />
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                             <QuestionBuilder 
                                                title="Variabel Penyelenggaraan" 
                                                questions={activeTheme.processQuestions} 
                                                onChange={(qs) => setActiveTheme({...activeTheme, processQuestions: qs})} 
                                             />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                        <button onClick={() => setIsEditingTheme(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Batal</button>
                                        <button onClick={handleSaveTheme} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                                            <Save size={18}/> Simpan Tema
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button onClick={handleCreateTheme} className="w-full py-3 border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition flex items-center justify-center gap-2">
                                    <Plus size={20} /> Buat Tema Variabel Baru
                                </button>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {themes.map(t => (
                                        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition shadow-sm group relative">
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-bold text-slate-800 text-lg">{t.name}</h3>
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleEditTheme(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded bg-slate-50"><Pencil size={16}/></button>
                                                    <button onClick={() => handleDeleteTheme(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-slate-50"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-xs text-slate-500">
                                                <p className="flex items-center gap-2"><Users size={14} className="text-indigo-400"/> {t.facilitatorQuestions.length} Variabel Fasilitator</p>
                                                <p className="flex items-center gap-2"><Layout size={14} className="text-orange-400"/> {t.processQuestions.length} Variabel Penyelenggaraan</p>
                                            </div>
                                        </div>
                                    ))}
                                    {themes.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-slate-400">Belum ada tema. Buat tema baru untuk mengelompokkan variabel.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
        
        {/* Contacts, Reports, Guestbook, Security Tabs... (Same as before, abbreviated for file size but included in full) */}
        {activeTab === 'contacts' && (
             <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Kontak Fasilitator</h2>
                        <p className="text-slate-500 text-sm">Kelola buku telepon fasilitator untuk kemudahan input data.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => contactFileInputRef.current?.click()} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition border border-slate-200">
                            <Upload size={16} /> Impor Excel
                        </button>
                        <button onClick={handleExportContacts} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition border border-slate-200">
                            <Download size={16} /> Ekspor Excel
                        </button>
                        <input type="file" ref={contactFileInputRef} onChange={handleImportContacts} className="hidden" accept=".xlsx, .xls" />
                    </div>
                </div>
                
                {/* Form Input Kontak */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 grid md:grid-cols-3 gap-4 items-start">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Nama Lengkap+gelar</label>
                        <input 
                            type="text" 
                            value={newContact.name} 
                            onChange={e => setNewContact({...newContact, name: e.target.value})} 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">WhatsApp ({countryLabel})</label>
                        <div className="relative flex">
                            {/* Dropdown Kode Negara */}
                            <select 
                                onChange={(e) => setNewContact({...newContact, whatsapp: e.target.value + newContact.whatsapp.replace(/^\+\d+/, '')})}
                                className="w-12 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
                                title="Pilih Kode Negara"
                            >
                                <option value="">ID</option>
                                <option value="+62">🇮🇩</option>
                                <option value="+60">🇲🇾</option>
                                <option value="+65">🇸🇬</option>
                                <option value="+1">🇺🇸</option>
                                <option value="+61">🇦🇺</option>
                                <option value="+81">🇯🇵</option>
                                <option value="+44">🇬🇧</option>
                                <option value="+966">🇸🇦</option>
                            </select>
                            
                            <input 
                                type="text" 
                                value={newContact.whatsapp} 
                                onChange={e => setNewContact({...newContact, whatsapp: e.target.value})} 
                                className="w-full border border-slate-300 rounded-r-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="085... atau +62..."
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSaveContact} 
                        disabled={!newContact.name || isDuplicateName || isDuplicatePhone}
                        className="bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition mt-6 md:mt-[22px] disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        Simpan Kontak
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex items-center gap-3">
                    <Search className="text-slate-400" size={20} />
                    <input type="text" placeholder="Cari nama atau nomor WhatsApp..." className="flex-1 outline-none text-sm text-slate-700 placeholder:text-slate-400" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} />
                    {contactSearch && <button onClick={() => setContactSearch('')} className="p-1 text-slate-400 hover:text-slate-600"><X size={16}/></button>}
                </div>
                
                <div className="grid sm:grid-cols-2 gap-4">
                    {filteredContacts.length > 0 ? (
                        filteredContacts.map(c => (
                            <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center group hover:border-indigo-300 transition shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm uppercase">{c.name.charAt(0)}</div>
                                    <div><p className="font-bold text-slate-800 text-sm">{c.name}</p><p className="text-xs text-slate-500 font-mono"><Phone size={10} className="inline mr-1"/> {c.whatsapp}</p></div>
                                </div>
                                <button onClick={() => handleDeleteContact(c)} className="text-slate-300 hover:text-red-500 p-2 transition"><Trash2 size={18}/></button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200"><Search size={32} className="mx-auto mb-2 opacity-50"/><p className="text-sm">Tidak ada kontak ditemukan.</p></div>
                    )}
                </div>
             </div>
        )}
        {activeTab === 'reports' && (
             <div className="animate-in fade-in duration-300 space-y-6">
                <div className="mb-4"><h2 className="text-2xl font-bold text-slate-800">Laporan Akhir</h2></div>
                
                {/* Search & Filter for Reports (Compact Design) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-4 relative">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cari Pelatihan</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                <input type="text" value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="Nama pelatihan..." className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs" />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dari Tanggal</label>
                            <input type="date" value={reportDateStart} onChange={e => setReportDateStart(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Hingga Tanggal</label>
                            <input type="date" value={reportDateEnd} onChange={e => setReportDateEnd(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Metode</label>
                            <select value={reportFilterMethod} onChange={e => setReportFilterMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="">Semua</option>
                                <option value="Klasikal">Klasikal</option>
                                <option value="Blended">Blended</option>
                                <option value="Daring Learning">Daring</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Kampus</label>
                            <select value={reportFilterLocation} onChange={e => setReportFilterLocation(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                <option value="">Semua</option>
                                <option value="Surabaya">SBY</option>
                                <option value="Malang">MLG</option>
                                <option value="Madiun">MDN</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <button onClick={() => {setReportSearch(''); setReportDateStart(''); setReportDateEnd(''); setReportFilterMethod(''); setReportFilterLocation('');}} className="p-1.5 text-slate-400 hover:text-red-500 w-full flex justify-center items-center h-[30px] border border-transparent hover:border-red-100 rounded-lg bg-slate-50 hover:bg-red-50"><RotateCcw size={16}/></button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700 first:rounded-tl-2xl">Judul Pelatihan & Periode</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Responden</th>
                                <th className="px-6 py-4 text-right font-semibold text-slate-700 last:rounded-tr-2xl">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReportTrainings.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm mb-1">{t.title}</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded">
                                            <Calendar size={12}/>
                                            <span>{formatDateID(t.startDate)} - {formatDateID(t.endDate)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold">{responseCounts[t.id] || 0} Respon</span></td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3" ref={dropdownRef}>
                                            <Link to={`/admin/results/${t.id}`} className="text-indigo-600 font-bold hover:underline">Buka Hasil</Link>
                                            <div className="relative">
                                                <button onClick={() => setExportDropdownId(exportDropdownId === t.id ? null : t.id)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200"><Printer size={16}/> Cetak <ChevronDown size={14} /></button>
                                                {exportDropdownId === t.id && (
                                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-[60] overflow-hidden text-left">
                                                        <button onClick={() => { exportToPDF(t); setExportDropdownId(null); }} className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100"><div className="w-8 h-8 bg-red-100 text-red-600 flex items-center justify-center rounded"><FileIcon size={16}/></div> PDF</button>
                                                        <button onClick={() => { exportToExcel(t); setExportDropdownId(null); }} className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100"><div className="w-8 h-8 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded"><FileSpreadsheet size={16}/> Excel</div></button>
                                                        <button onClick={() => { exportToWord(t); setExportDropdownId(null); }} className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-slate-50 flex items-center gap-3"><div className="w-8 h-8 bg-blue-100 text-blue-600 flex items-center justify-center rounded"><FileText size={16}/> Word</div></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredReportTrainings.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">
                                        Tidak ada data pelatihan yang sesuai filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
        )}
        {/* ... Guestbook & Security ... (unchanged) */}
        {activeTab === 'guestbook' && (
             <div className="animate-in fade-in duration-300 max-w-5xl mx-auto space-y-6">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Buku Tamu</h2>
                        <p className="text-slate-500 text-sm">Riwayat akses tamu ke menu laporan.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleToggleGuestBook} 
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition shadow-sm ${appSettings.isGuestBookOpen ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200' : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'}`}
                        >
                            {appSettings.isGuestBookOpen ? <Unlock size={18}/> : <Lock size={18}/>}
                            {appSettings.isGuestBookOpen ? 'Akses Tamu DIBUKA' : 'Akses Tamu DITUTUP'}
                        </button>
                        <button onClick={handleClearGuestBook} className="p-2.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-xl hover:bg-red-50"><Trash2 size={18}/></button>
                    </div>
                 </div>

                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Waktu Akses</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Nama Tamu</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Instansi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {guestEntries.length > 0 ? (
                                guestEntries.map(g => (
                                    <tr key={g.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                            {new Date(g.timestamp).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{g.name}</td>
                                        <td className="px-6 py-4 text-slate-600">{g.institution}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="text-center py-8 text-slate-400 italic">Belum ada riwayat tamu.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
             </div>
        )}
        {activeTab === 'security' && isSuperAdmin && (
            <div className="animate-in fade-in duration-300 max-w-2xl mx-auto space-y-6">
                {/* ... Security Content ... */}
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Shield className="text-amber-500"/> Pengaturan Akses & Keamanan</h2>
                    <p className="text-slate-500 text-sm">Kelola password login dan kode otorisasi sistem.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Password Admin (Reguler)</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input 
                                    type={showSecurityPass ? "text" : "password"} 
                                    value={securitySettings.admin} 
                                    onChange={e => setSecuritySettings({...securitySettings, admin: e.target.value})} 
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Digunakan untuk login sehari-hari. Default: 12345</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-amber-700 mb-1">Password Superadmin</label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18}/>
                                <input 
                                    type={showSecurityPass ? "text" : "password"} 
                                    value={securitySettings.super} 
                                    onChange={e => setSecuritySettings({...securitySettings, super: e.target.value})} 
                                    className="w-full pl-10 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Digunakan untuk akses menu ini. Default: supersimep</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <label className="block text-sm font-bold text-red-700 mb-1">Kode Otorisasi Hapus Data</label>
                            <div className="relative">
                                <Trash2 className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" size={18}/>
                                <input 
                                    type={showSecurityPass ? "text" : "password"} 
                                    value={securitySettings.delete} 
                                    onChange={e => setSecuritySettings({...securitySettings, delete: e.target.value})} 
                                    className="w-full pl-10 pr-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-red-50"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Diminta saat menghapus data sensitif. Default: adm123</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                            <input type="checkbox" checked={showSecurityPass} onChange={e => setShowSecurityPass(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500"/>
                            Tampilkan Karakter
                        </label>
                        <button onClick={handleSaveSecurity} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2">
                            <Save size={18}/> Simpan Perubahan
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Delete Confirmation Modal (Same) */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
             <div className="p-6 text-center">
                <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Hapus</h3>
                <p className="text-slate-500 text-sm mb-4">Hapus data pelatihan ini secara permanen?</p>
                <div className="mb-4 text-left"><label className="block text-xs font-bold text-slate-700 mb-1">Kode Otorisasi</label><div className="relative"><input type="password" value={deleteAuthInput} onChange={e => setDeleteAuthInput(e.target.value)} placeholder="Masukkan sandi..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" autoFocus /></div></div>
                <div className="flex gap-3"><button onClick={() => { setDeleteTargetId(null); setDeleteAuthInput(''); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200">Batal</button><button onClick={executeDelete} disabled={isDeleting} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50">{isDeleting ? <RotateCcw size={18} className="animate-spin" /> : 'Hapus'}</button></div>
             </div>
           </div>
        </div>
      )}

      {/* Share Modal (Same) */}
      {showShareModal && shareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Bagikan Akses</h3>
              <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setShareTab('link')} className={`flex-1 py-2 rounded text-xs font-bold ${shareTab === 'link' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>LINK & DATA</button>
                    <button onClick={() => setShareTab('code')} className={`flex-1 py-2 rounded text-xs font-bold ${shareTab === 'code' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>KODE AKSES</button>
                </div>
                {shareTab === 'link' ? (
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Link Halaman Evaluasi</p>
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Resmi</span>
                            </div>
                            <input 
                                readOnly
                                value={shareData.shortUrl}
                                onClick={(e) => e.currentTarget.select()}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs break-all font-mono text-slate-600 mb-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            
                            <button onClick={() => copyToClipboard(shareData.fullUrl)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                                {copied ? <Check size={18}/> : <CopyIcon size={18}/>}
                                {copied ? 'Link Tersalin!' : 'Salin Link & Data Lengkap'}
                            </button>
                            <p className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">
                                Link ini telah dikompresi agar lebih pendek. Buka di perangkat lain tanpa login.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-4 py-4">
                         <div 
                            onClick={() => copyToClipboard(shareData.accessCode)}
                            className={`p-8 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 group relative overflow-hidden ${copied ? 'bg-green-50 border-green-500' : 'bg-slate-50 border-slate-300 hover:border-indigo-500 hover:bg-white hover:shadow-lg'}`}
                         >
                             <div className={`text-5xl font-mono font-bold tracking-[0.2em] mb-3 transition-all duration-300 group-hover:scale-110 ${copied ? 'text-green-700' : 'text-slate-800'}`}>
                                {shareData.accessCode}
                             </div>
                             
                             <div className="flex items-center justify-center gap-2 text-xs">
                                {copied ? (
                                    <span className="text-green-600 font-bold flex items-center animate-in fade-in zoom-in"><Check size={14} className="mr-1"/> Berhasil Disalin!</span>
                                ) : (
                                    <span className="text-slate-400 group-hover:text-indigo-500 transition-colors flex items-center">
                                        <CopyIcon size={12} className="mr-1.5"/> Klik area ini untuk menyalin kode
                                    </span>
                                )}
                             </div>
                         </div>
                         <p className="text-xs text-slate-400">Gunakan kode ini di halaman depan jika link tidak bekerja.</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Same) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col md:flex-row">
                <div className="w-full md:w-64 bg-slate-50 border-r flex flex-col p-4 space-y-2">
                    <h3 className="font-bold text-slate-800 mb-4 px-4 flex items-center gap-2"><Settings size={18}/> Pengaturan</h3>
                    <button onClick={() => setActiveSettingsTab('training')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'training' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>Dasar</button>
                    <button onClick={() => setActiveSettingsTab('whatsapp')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'whatsapp' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>WhatsApp</button>
                    <button onClick={() => setActiveSettingsTab('backup')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'backup' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 text-slate-600'}`}>Data</button>
                    <button onClick={() => setActiveSettingsTab('reset')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition ${activeSettingsTab === 'reset' ? 'bg-red-600 text-white' : 'hover:bg-red-50 text-red-600'}`}>Reset Sistem</button>
                </div>
                <div className="flex-1 p-8 relative overflow-y-auto bg-white">
                    <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition"><X size={20}/></button>
                    {activeSettingsTab === 'training' && (
                        <div className="space-y-6">
                            <h4 className="text-xl font-bold text-slate-800">Pengaturan Pelatihan</h4>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-2">Deskripsi Default</label>
                                <textarea value={appSettings.defaultTrainingDescription} onChange={e => setAppSettings({...appSettings, defaultTrainingDescription: e.target.value})} className="w-full border border-slate-300 rounded-xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <button onClick={handleSaveSettings} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Simpan</button>
                        </div>
                    )}
                    {activeSettingsTab === 'whatsapp' && (
                        <div className="space-y-4">
                            <h4 className="text-xl font-bold text-slate-800">WhatsApp Gateway</h4>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL Gateway</label><input type="text" value={appSettings.waBaseUrl} onChange={e => setAppSettings({...appSettings, waBaseUrl: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://api.fonnte.com/send" /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key (Fonnte)</label><input type="text" value={appSettings.waApiKey} onChange={e => setAppSettings({...appSettings, waApiKey: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: EK2Ef..." /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Header Pesan</label><textarea value={appSettings.waHeader} onChange={e => setAppSettings({...appSettings, waHeader: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" placeholder="Judul laporan..." /></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Footer Pesan</label><textarea value={appSettings.waFooter} onChange={e => setAppSettings({...appSettings, waFooter: e.target.value})} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none" placeholder="Pesan penutup..." /></div>
                            <div className="pt-4"><button onClick={handleSaveSettings} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition w-full md:w-auto">Simpan Konfigurasi</button></div>
                        </div>
                    )}
                    {activeSettingsTab === 'backup' && (
                        <div className="space-y-8">
                            <h4 className="text-xl font-bold text-slate-800">Cadangan & Pulihkan</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={async () => { const data = await exportAllData(); const blob = new Blob([data], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'backup.json'; a.click(); }} className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl text-center hover:bg-indigo-100 transition"><Download className="mx-auto mb-2 text-indigo-600" size={32}/><p className="font-bold text-indigo-700">Ekspor Data</p></button>
                                <button onClick={() => fileInputRef.current?.click()} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center hover:bg-slate-100 transition"><Upload className="mx-auto mb-2 text-slate-600" size={32}/><p className="font-bold text-slate-700">Impor Data</p></button>
                                <input type="file" ref={fileInputRef} onChange={e => { const file = e.target.files?.[0]; if(file) { const reader = new FileReader(); reader.onload = async (ev) => { if(await importAllData(ev.target?.result as string)) { refreshData(); alert('Data berhasil dipulihkan!'); } }; reader.readAsText(file); } }} className="hidden" accept=".json" />
                            </div>
                        </div>
                    )}
                    {activeSettingsTab === 'reset' && (
                        <div className="space-y-6">
                            <h4 className="text-xl font-bold text-red-600">Reset Data Aplikasi</h4>
                            <p className="text-sm text-slate-500 leading-relaxed">Peringatan: Tindakan ini akan menghapus seluruh database pelatihan, respon evaluasi, dan daftar kontak secara permanen. Pastikan Anda telah melakukan ekspor data jika diperlukan.</p>
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                <AlertCircle className="text-red-600 shrink-0" size={20}/>
                                <p className="text-xs text-red-700 font-medium">Reset tidak dapat dibatalkan. Sistem akan mengembalikan pengaturan ke kondisi awal.</p>
                            </div>
                            <button onClick={handleResetApplication} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">Reset Seluruh Data</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
