
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTrainingById, getResponses, deleteFacilitatorResponses, getSettings, saveTraining } from '../services/storageService';
import { Training, Response, QuestionType, Question } from '../types';
import { ArrowLeft, User, Layout, Quote, Calendar, Award, Trash2, Lock, UserCheck, AlertTriangle, RefreshCw, Eye, EyeOff, Save, CheckCircle, Pencil, X, ArrowUp, ArrowDown, Settings2, CheckSquare, Square, BarChart2 } from 'lucide-react';

// --- HELPER FUNCTIONS ---
const formatDateID = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const getLabel = (val: number, type: QuestionType) => {
    if (type === 'text') return '';
    if (type === 'star') {
        if (val >= 4.2) return 'Sangat Baik';
        if (val >= 3.4) return 'Baik';
        if (val >= 2.6) return 'Cukup';
        if (val >= 1.8) return 'Sedang';
        return 'Kurang';
    } else {
        if (val >= 86) return 'Sangat Baik';
        if (val >= 76) return 'Baik';
        if (val >= 56) return 'Sedang';
        return 'Kurang';
    }
};

const getLabelColor = (val: number, type: QuestionType) => {
    if (type === 'star') {
        if (val >= 4.2) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (val >= 3.4) return 'text-blue-600 bg-blue-50 border-blue-200';
        if (val >= 2.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        if (val >= 1.8) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    } else {
        if (val >= 86) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (val >= 76) return 'text-blue-600 bg-blue-50 border-blue-200';
        if (val >= 56) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    }
};

const getAverage = (responses: Response[], qId: string) => {
    const valid = responses.filter(r => typeof r.answers[qId] === 'number');
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, curr) => acc + (curr.answers[qId] as number), 0);
    return Number((sum / valid.length).toFixed(2)); 
};

// CALCULATE PERCENTAGE DISTRIBUTION (4 Categories: Kurang, Sedang, Baik, Sangat Baik)
const calculateDistribution = (responses: Response[], qId: string, type: QuestionType) => {
    const counts = { k: 0, s: 0, b: 0, sb: 0, total: 0 };
    responses.forEach(r => {
        const val = r.answers[qId];
        if (typeof val === 'number') {
            counts.total++;
            if (type === 'star') {
                // 1=Kurang, 2&3=Sedang, 4=Baik, 5=Sangat Baik
                if (val <= 1) counts.k++;
                else if (val <= 3) counts.s++;
                else if (val === 4) counts.b++;
                else if (val === 5) counts.sb++;
            } else { // Slider
                // <=55 Kurang, <=75 Sedang, <=85 Baik, >85 Sgt Baik
                if (val <= 55) counts.k++;
                else if (val <= 75) counts.s++;
                else if (val <= 85) counts.b++;
                else counts.sb++;
            }
        }
    });

    if (counts.total === 0) return { k: 0, s: 0, b: 0, sb: 0, total: 0 };
    
    // Return formatted percentages (1 decimal)
    return {
        k: ((counts.k / counts.total) * 100).toFixed(1),
        s: ((counts.s / counts.total) * 100).toFixed(1),
        b: ((counts.b / counts.total) * 100).toFixed(1),
        sb: ((counts.sb / counts.total) * 100).toFixed(1),
        total: counts.total
    };
};

const getTextAnswers = (responses: Response[], qId: string) => {
    return responses
    .map(r => r.answers[qId])
    .filter(a => typeof a === 'string' && a.trim() !== '') as string[];
};

function calculateOverall(items: Response[], qs: Question[]) {
    const starQs = qs.filter(q => q.type === 'star');
    let starAvg = 0;
    if (starQs.length > 0) {
        let totalScore = 0;
        let totalCount = 0;
        starQs.forEach(q => {
            const valid = items.filter(r => typeof r.answers[q.id] === 'number');
            if(valid.length) {
                totalScore += valid.reduce((a,b) => a + (b.answers[q.id] as number), 0);
                totalCount += valid.length;
            }
        });
        starAvg = totalCount ? Number((totalScore / totalCount).toFixed(2)) : 0;
    }

    const sliderQs = qs.filter(q => q.type === 'slider');
    let sliderAvg = 0;
    if (sliderQs.length > 0) {
        let totalScore = 0;
        let totalCount = 0;
        sliderQs.forEach(q => {
            const valid = items.filter(r => typeof r.answers[q.id] === 'number');
            if(valid.length) {
                totalScore += valid.reduce((a,b) => a + (b.answers[q.id] as number), 0);
                totalCount += valid.length;
            }
        });
        sliderAvg = totalCount ? Number((totalScore / totalCount).toFixed(2)) : 0;
    }

    return { starAvg, sliderAvg, hasStar: starQs.length > 0, hasSlider: sliderQs.length > 0 };
}

interface SessionData {
    name: string;
    subject: string;
    date: string;
    items: Response[];
    overall: {
        starAvg: number;
        sliderAvg: number;
        hasStar: boolean;
        hasSlider: boolean;
    };
}

// Interface for temporary restore config
interface RestoreConfigItem {
    id: string;
    label: string;
    type: QuestionType;
    originalInferredType: QuestionType;
}

export const ResultsView: React.FC = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  
  // --- 1. HOOKS DECLARATION (MUST BE TOP LEVEL) ---
  const [training, setTraining] = useState<Training | undefined>(undefined);
  const [responses, setResponses] = useState<Response[]>([]);
  const [activeTab, setActiveTab] = useState<'facilitator' | 'process'>('facilitator');

  // Delete Session State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [sysDeletePass, setSysDeletePass] = useState('adm123'); 

  // Variable Management State
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedVarIds, setSelectedVarIds] = useState<Set<string>>(new Set());
  const [isVarDeleteModalOpen, setIsVarDeleteModalOpen] = useState(false);
  const [varDeletePassword, setVarDeletePassword] = useState('');

  // Data Recovery State
  const [showRestoredData, setShowRestoredData] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreConfigs, setRestoreConfigs] = useState<RestoreConfigItem[]>([]);

  // --- 2. EFFECT HOOKS ---
  useEffect(() => {
    const fetchData = async () => {
        if (trainingId) {
            setTraining(await getTrainingById(trainingId));
            setResponses(await getResponses(trainingId));
            const s = await getSettings();
            if (s.deletePassword) setSysDeletePass(s.deletePassword);
        }
    };
    fetchData();
  }, [trainingId]);

  // --- 3. MEMO HOOKS (LOGIC) ---
  const filteredResponses = useMemo(() => {
      return responses.filter(r => r.type === activeTab);
  }, [responses, activeTab]);

  const activeQuestions = useMemo(() => {
      if (!training) return [];
      return activeTab === 'facilitator' ? training.facilitatorQuestions : training.processQuestions;
  }, [training, activeTab]);

  // --- DATA RECOVERY LOGIC ---
  const orphanedQuestionIds = useMemo(() => {
      const currentIds = new Set(activeQuestions.map(q => q.id));
      const orphans = new Set<string>();
      filteredResponses.forEach(r => {
          if (r.answers) {
              Object.keys(r.answers).forEach(qId => {
                  if (!currentIds.has(qId)) orphans.add(qId);
              });
          }
      });
      return Array.from(orphans);
  }, [filteredResponses, activeQuestions]);

  const effectiveQuestions = useMemo(() => {
      if (!showRestoredData || orphanedQuestionIds.length === 0) return activeQuestions;
      const restoredQuestions: Question[] = orphanedQuestionIds.map(id => {
          let inferredType: QuestionType = 'star';
          const sample = filteredResponses.find(r => r.answers[id] !== undefined);
          if (sample) {
              const val = sample.answers[id];
              if (typeof val === 'string') inferredType = 'text';
              else if (typeof val === 'number') inferredType = val > 5 ? 'slider' : 'star';
          }
          return { id: id, label: `(Data Lama) ID: ${id.substring(0,4)}...`, type: inferredType };
      });
      return [...activeQuestions, ...restoredQuestions];
  }, [activeQuestions, orphanedQuestionIds, showRestoredData, filteredResponses]);

  const flatSessions = useMemo<SessionData[]>(() => {
      if (!training) return [];
      const groupedSessions: Record<string, Response[]> = {};
      
      if (activeTab === 'process') {
          groupedSessions['Penyelenggaraan|Umum'] = filteredResponses;
      } else {
          filteredResponses.forEach(r => {
              const name = r.targetName || 'Umum';
              const subject = r.targetSubject || 'Umum';
              const key = `${name}|${subject}`;
              if (!groupedSessions[key]) groupedSessions[key] = [];
              groupedSessions[key].push(r);
          });
      }

      let sessions = Object.keys(groupedSessions).map(key => {
          const [name, subject] = key.split('|');
          const items = groupedSessions[key];
          let date = '';
          if (activeTab === 'facilitator') {
              const facData = training.facilitators.find(f => f.name === name && f.subject === subject);
              if (facData) date = facData.sessionDate;
          }
          const overall = calculateOverall(items, effectiveQuestions);
          return { name, subject, date, items, overall };
      });

      sessions.sort((a, b) => {
          if (activeTab === 'process') return 0;
          if (a.date && b.date) {
              if (a.date < b.date) return -1;
              if (a.date > b.date) return 1;
          }
          const facA = training.facilitators.find(f => f.name === a.name && f.subject === a.subject);
          const facB = training.facilitators.find(f => f.name === b.name && f.subject === b.subject);
          const orderA = facA?.order || 0;
          const orderB = facB?.order || 0;
          return orderA - orderB;
      });
      return sessions;
  }, [training, filteredResponses, activeTab, effectiveQuestions]);

  const grandStats = useMemo(() => {
      let grandAvg = 0;
      let grandAvgLabel = '';
      let grandAvgColor = '';
      if (activeTab === 'facilitator' && flatSessions.length > 0) {
          let totalSessionAvg = 0;
          let sessionCount = 0;
          flatSessions.forEach(session => {
              let sessionTotalScore = 0;
              let sessionMetricCount = 0;
              effectiveQuestions.forEach(q => {
                  if (q.type !== 'text') {
                      const valid = session.items.filter(r => typeof r.answers[q.id] === 'number');
                      if (valid.length > 0) {
                          const sum = valid.reduce((acc, curr) => acc + (curr.answers[q.id] as number), 0);
                          const avg = sum / valid.length;
                          sessionTotalScore += avg;
                          sessionMetricCount++;
                      }
                  }
              });
              if (sessionMetricCount > 0) {
                  totalSessionAvg += (sessionTotalScore / sessionMetricCount);
                  sessionCount++;
              }
          });
          if (sessionCount > 0) {
              grandAvg = Number((totalSessionAvg / sessionCount).toFixed(2));
              const type: QuestionType = grandAvg > 5 ? 'slider' : 'star';
              grandAvgLabel = getLabel(grandAvg, type);
              grandAvgColor = getLabelColor(grandAvg, type);
          }
      }
      return { grandAvg, grandAvgLabel, grandAvgColor };
  }, [flatSessions, effectiveQuestions, activeTab]);

  // --- 4. HANDLERS ---
  const handleInitiateDelete = (name: string) => { setTargetToDelete(name); setDeletePassword(''); setIsDeleteModalOpen(true); };
  const handleDeleteConfirm = async () => { if (deletePassword !== sysDeletePass) { alert("Kata sandi salah!"); return; } if (trainingId && targetToDelete) { setIsDeleting(true); try { await deleteFacilitatorResponses(trainingId, targetToDelete); const updatedResponses = responses.filter(r => !(r.type === 'facilitator' && r.targetName === targetToDelete)); setResponses(updatedResponses); setIsDeleteModalOpen(false); setTargetToDelete(null); } catch (error) { alert("Gagal menghapus data."); } finally { setIsDeleting(false); } } };
  const handleToggleSelectVariable = (id: string) => { const newSet = new Set(selectedVarIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedVarIds(newSet); };
  const handleDeleteVariablesConfirm = async () => { if (varDeletePassword !== sysDeletePass) { alert("Kata sandi salah!"); return; } if (!training) return; setIsDeleting(true); try { const updatedTraining = { ...training }; if (activeTab === 'facilitator') { updatedTraining.facilitatorQuestions = updatedTraining.facilitatorQuestions.filter(q => !selectedVarIds.has(q.id)); } else { updatedTraining.processQuestions = updatedTraining.processQuestions.filter(q => !selectedVarIds.has(q.id)); } await saveTraining(updatedTraining); setTraining(updatedTraining); setIsVarDeleteModalOpen(false); setIsManageMode(false); setSelectedVarIds(new Set()); setVarDeletePassword(''); } catch (error) { console.error("Failed to delete variables", error); alert("Gagal menghapus variabel."); } finally { setIsDeleting(false); } };
  const handleInitiateRestore = () => { if (!training || orphanedQuestionIds.length === 0) return; const configs: RestoreConfigItem[] = orphanedQuestionIds.map(id => { let inferredType: QuestionType = 'star'; const sample = filteredResponses.find(r => r.answers[id] !== undefined); if (sample) { const val = sample.answers[id]; if (typeof val === 'string') inferredType = 'text'; else if (typeof val === 'number') inferredType = val > 5 ? 'slider' : 'star'; } return { id, label: '', type: inferredType, originalInferredType: inferredType }; }); setRestoreConfigs(configs); setIsRestoreModalOpen(true); };
  const handleUpdateRestoreConfig = (index: number, field: keyof RestoreConfigItem, value: any) => { const newConfigs = [...restoreConfigs]; newConfigs[index] = { ...newConfigs[index], [field]: value }; setRestoreConfigs(newConfigs); };
  const handleMoveUp = (index: number) => { if (index === 0) return; const newConfigs = [...restoreConfigs]; [newConfigs[index - 1], newConfigs[index]] = [newConfigs[index], newConfigs[index - 1]]; setRestoreConfigs(newConfigs); };
  const handleMoveDown = (index: number) => { if (index === restoreConfigs.length - 1) return; const newConfigs = [...restoreConfigs]; [newConfigs[index], newConfigs[index + 1]] = [newConfigs[index + 1], newConfigs[index]]; setRestoreConfigs(newConfigs); };
  const handleRemoveRestoreConfig = (index: number) => { if(confirm("Hapus variabel ini?")) { const newConfigs = [...restoreConfigs]; newConfigs.splice(index, 1); setRestoreConfigs(newConfigs); } };
  const handleExecuteRestore = async () => { if (!training) return; const missingLabels = restoreConfigs.some(c => !c.label.trim()); if (missingLabels) { alert("Isi nama variabel."); return; } setIsRestoring(true); try { const restoredQuestions: Question[] = restoreConfigs.map(cfg => ({ id: cfg.id, label: cfg.label, type: cfg.type })); const updatedTraining = { ...training }; if (activeTab === 'facilitator') updatedTraining.facilitatorQuestions = [...updatedTraining.facilitatorQuestions, ...restoredQuestions]; else updatedTraining.processQuestions = [...updatedTraining.processQuestions, ...restoredQuestions]; await saveTraining(updatedTraining); setTraining(updatedTraining); setShowRestoredData(false); setIsRestoreModalOpen(false); alert("Berhasil."); } catch (error) { alert("Error."); } finally { setIsRestoring(false); } };

  if (!training) return <div className="p-8 text-center text-slate-500">Memuat Laporan...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
                <Link to="/admin/dashboard" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition mt-1">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-lg font-bold text-slate-800">Laporan Hasil Evaluasi</h1>
                    <div className="flex flex-col gap-1 mt-1">
                        <span className="text-sm font-bold text-slate-700">{training.title}</span>
                        {(training.learningMethod || training.location) && (
                            <span className="text-xs text-slate-500 mt-0.5">
                                {training.learningMethod && `Metode Pembelajaran ${training.learningMethod} `}
                                {training.location && `Di UPT Pelatihan Kesehatan Masyarakat Kampus ${training.location}`}
                            </span>
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Calendar size={10} />
                            Periode: {formatDateID(training.startDate)} s/d {formatDateID(training.endDate)}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3 self-start md:self-center">
                 <button
                    onClick={() => { setIsManageMode(!isManageMode); setSelectedVarIds(new Set()); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border ${isManageMode ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                    <Settings2 size={16}/>
                    {isManageMode ? 'Batal Kelola' : 'Kelola Variabel'}
                </button>
                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                    <button
                        onClick={() => { setActiveTab('facilitator'); setShowRestoredData(false); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${activeTab === 'facilitator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Fasilitator
                    </button>
                    <button
                        onClick={() => { setActiveTab('process'); setShowRestoredData(false); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${activeTab === 'process' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Penyelenggaraan
                    </button>
                </div>
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- RECOVERY BANNER --- */}
        {orphanedQuestionIds.length > 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-amber-800 text-sm">Terdeteksi Data Lama / Terhapus</h3>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                            Sistem mendeteksi adanya data penilaian responden untuk <strong>{orphanedQuestionIds.length} variabel pertanyaan</strong> yang telah Anda hapus atau ubah dari konfigurasi pelatihan ini.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowRestoredData(!showRestoredData)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm border ${showRestoredData ? 'bg-white text-amber-800 border-amber-300' : 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200'}`}> {showRestoredData ? <EyeOff size={16}/> : <Eye size={16}/>} {showRestoredData ? 'Sembunyikan' : 'Lihat'} </button>
                    {showRestoredData && (<button onClick={handleInitiateRestore} disabled={isRestoring} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 disabled:opacity-50"><Pencil size={16}/> Pulihkan</button>)}
                </div>
            </div>
        )}

        {/* GRAND AVERAGE SUMMARY CARD (FACILITATOR ONLY) */}
        {activeTab === 'facilitator' && grandStats.grandAvg > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <div className="flex items-center gap-4 z-10">
                    <div className="bg-indigo-50 p-3 rounded-full text-indigo-600">
                        <Award size={32} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Rata-rata Keseluruhan</h2>
                        <p className="text-slate-500 text-sm">Akumulasi nilai akhir dari seluruh sesi fasilitator.</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 z-10 bg-slate-50 px-6 py-3 rounded-xl border border-slate-100">
                     <div className="text-right">
                        <div className="text-3xl font-bold text-slate-900 leading-none">{grandStats.grandAvg}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Nilai Rata-rata</div>
                     </div>
                     <div className={`px-4 py-1.5 rounded-lg border-2 font-bold text-xs uppercase tracking-wide shadow-sm ${grandStats.grandAvgColor}`}>
                        {grandStats.grandAvgLabel}
                     </div>
                </div>
            </div>
        )}

        {flatSessions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-4 rounded-full mb-3 text-slate-400"><Layout size={32} /></div>
                <h3 className="text-lg font-semibold text-slate-700">Belum Ada Data</h3>
                <p className="text-slate-500 text-sm">Belum ada responden yang mengisi kategori ini.</p>
             </div>
        ) : (
            <div className="space-y-6">
                {flatSessions.map((session, idx) => {
                    const dateStr = session.date ? formatDateID(session.date) : '';
                    
                    return (
                        <div key={`${session.name}-${session.subject}-${idx}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                             {/* Card Header */}
                             <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${activeTab === 'facilitator' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {activeTab === 'facilitator' ? <User size={18}/> : <Layout size={18}/>}
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="font-bold text-slate-800 text-base">
                                            {activeTab === 'process' ? 'Hasil Evaluasi Penyelenggaraan' : session.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            {activeTab === 'facilitator' && (<span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{session.subject}</span>)}
                                            {dateStr && <span className="flex items-center gap-1"><Calendar size={12}/> {dateStr}</span>}
                                            {activeTab === 'process' && training.processOrganizer && (<span className="flex items-center gap-1"><UserCheck size={12}/> {training.processOrganizer.name}</span>)}
                                        </div>
                                    </div>
                                </div>
                                {activeTab === 'facilitator' && (<button onClick={() => handleInitiateDelete(session.name)} className="p-1.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 hover:bg-red-50 rounded transition-colors" title="Hapus Nilai Fasilitator Ini"><Trash2 size={16}/></button>)}
                             </div>

                             {/* Session Details */}
                             <div className="p-4">
                                {/* Sub-Header Stats */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 border-b border-slate-50 pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-2">
                                            {session.overall.hasStar && (<div className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-1.5"><span className="text-[9px] uppercase font-bold text-yellow-600 tracking-wider">BINTANG</span><span className="text-xs font-bold text-slate-800">{session.overall.starAvg}</span></div>)}
                                            {session.overall.hasSlider && (<div className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1.5"><span className="text-[9px] uppercase font-bold text-blue-600 tracking-wider">SKALA</span><span className="text-xs font-bold text-slate-800">{session.overall.sliderAvg}</span></div>)}
                                        </div>
                                        <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">{session.items.length} Responden</span>
                                    </div>
                                </div>

                                {/* IF PROCESS TAB: SHOW TABLE VIEW */}
                                {activeTab === 'process' ? (
                                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold w-12 text-center">NO</th>
                                                    <th className="px-4 py-3 font-bold">HAL-HAL YANG DIEVALUASI</th>
                                                    <th className="px-4 py-3 font-bold text-center w-24">KURANG</th>
                                                    <th className="px-4 py-3 font-bold text-center w-24">SEDANG</th>
                                                    <th className="px-4 py-3 font-bold text-center w-24">BAIK</th>
                                                    <th className="px-4 py-3 font-bold text-center w-24">SGT.BAIK</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {effectiveQuestions.filter(q => q.type !== 'text').map((q, qIdx) => {
                                                    const dist = calculateDistribution(session.items, q.id, q.type);
                                                    const isRestored = q.label.includes('(Data Lama)');
                                                    const isSelected = selectedVarIds.has(q.id);
                                                    
                                                    return (
                                                        <tr key={q.id} className={`hover:bg-slate-50 transition ${isRestored ? 'bg-amber-50/50' : ''} ${isSelected ? 'bg-red-50' : ''}`} onClick={() => { if(isManageMode && !isRestored) handleToggleSelectVariable(q.id); }}>
                                                            <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">
                                                                {isManageMode && !isRestored ? (isSelected ? <CheckSquare className="mx-auto text-red-500" size={16}/> : <Square className="mx-auto text-slate-300" size={16}/>) : (qIdx + 1)}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-800 font-medium">
                                                                {q.label}
                                                                {isRestored && <span className="ml-2 text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">Data Lama</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-center border-l border-slate-50">{dist.k}%</td>
                                                            <td className="px-4 py-3 text-center border-l border-slate-50">{dist.s}%</td>
                                                            <td className="px-4 py-3 text-center border-l border-slate-50">{dist.b}%</td>
                                                            <td className="px-4 py-3 text-center border-l border-slate-50 font-bold text-slate-900">{dist.sb}%</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        
                                        {/* Show Text Answers below Table for Process */}
                                        <div className="mt-6 px-4 pb-4">
                                            {effectiveQuestions.filter(q => q.type === 'text').map(q => (
                                                <div key={q.id} className="mb-4">
                                                    <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><Quote size={14} className="text-indigo-500"/> {q.label}</h4>
                                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                        {getTextAnswers(session.items, q.id).length > 0 ? (
                                                            getTextAnswers(session.items, q.id).map((ans, aIdx) => (
                                                                <p key={aIdx} className="text-xs text-slate-600 italic border-b border-slate-200 last:border-0 pb-1 last:pb-0">"{ans}"</p>
                                                            ))
                                                        ) : <span className="text-xs text-slate-400 italic">Tidak ada jawaban.</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* FACILITATOR VIEW (GRID CARDS) - UNCHANGED */
                                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {effectiveQuestions.map(q => {
                                            const avg = getAverage(session.items, q.id);
                                            const label = getLabel(avg, q.type);
                                            const labelColor = getLabelColor(avg, q.type);
                                            const isRestored = q.label.includes('(Data Lama)');
                                            const isSelected = selectedVarIds.has(q.id);

                                            return (
                                            <div key={q.id} className={`bg-white border rounded-lg p-2.5 shadow-sm flex flex-col h-full relative transition-all ${isRestored ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-100' : 'border-slate-100'} ${isManageMode && !isRestored ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md' : ''} ${isSelected ? 'ring-2 ring-red-500 border-red-500 bg-red-50' : ''}`} onClick={() => { if(isManageMode && !isRestored) handleToggleSelectVariable(q.id); }}>
                                                {isManageMode && !isRestored && (<div className="absolute top-2 right-2 z-10">{isSelected ? <CheckSquare className="text-red-500 fill-white" size={20}/> : <Square className="text-slate-300" size={20}/>}</div>)}
                                                <div className="flex items-start justify-between mb-1.5 pr-6"><p className={`text-[11px] font-bold line-clamp-2 h-[28px] leading-snug flex-1 ${isRestored ? 'text-amber-800 italic' : 'text-slate-700'}`} title={q.label}>{q.label}</p>{isRestored && <AlertTriangle size={12} className="text-amber-500 shrink-0 ml-1"/>}</div>
                                                <div className="mt-auto">{q.type === 'text' ? (<div className="bg-white/50 rounded-lg p-2 max-h-32 overflow-y-auto space-y-2 custom-scrollbar border border-slate-200/50">{getTextAnswers(session.items, q.id).length > 0 ? (getTextAnswers(session.items, q.id).map((ans, idx) => (<div key={idx} className="flex gap-1.5 text-[10px] text-slate-600 leading-relaxed border-b border-slate-100 last:border-0 pb-1 last:pb-0"><Quote size={10} className="text-slate-400 min-w-[10px] mt-0.5" /><p className="italic">{ans}</p></div>))) : ( <span className="text-[10px] text-slate-400">Tidak ada jawaban</span> )}</div>) : (<div className="flex flex-col gap-2"><div className="flex items-center justify-between pt-1"><span className="text-lg font-bold text-slate-800 tracking-tight">{avg}</span><span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${labelColor}`}>{label}</span></div></div>)}</div>
                                            </div>
                                        )})}
                                    </div>
                                )}
                             </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* FLOATING ACTION BAR FOR DELETE VARIABLES */}
        {isManageMode && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-6">
                <span className="text-sm font-bold text-slate-700">{selectedVarIds.size} Dipilih</span>
                <div className="h-6 w-px bg-slate-200"></div>
                <button onClick={() => { setIsManageMode(false); setSelectedVarIds(new Set()); }} className="text-sm font-bold text-slate-500 hover:text-slate-800">Batal</button>
                <button onClick={() => { if(selectedVarIds.size > 0) { setIsVarDeleteModalOpen(true); setVarDeletePassword(''); } }} disabled={selectedVarIds.size === 0} className="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Trash2 size={16}/> Hapus</button>
            </div>
        )}
        
        {/* Modals included in existing component (omitted for brevity as they are unchanged) */}
        {isVarDeleteModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95"><div className="p-6"><div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 className="text-red-600" size={24}/></div><h3 className="text-center font-bold text-slate-800 text-lg mb-2">Hapus {selectedVarIds.size} Variabel?</h3><p className="text-center text-slate-500 text-sm mb-6">Variabel yang dihapus akan hilang dari laporan ini, namun data penilaian tersimpan dapat dipulihkan nanti melalui menu pemulihan.</p><div className="space-y-3"><div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kode Otorisasi (Sandi)</label><div className="relative"><Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="password" value={varDeletePassword} onChange={(e) => setVarDeletePassword(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="Masukkan sandi..." autoFocus /></div></div><div className="flex gap-2 pt-2"><button onClick={() => { setIsVarDeleteModalOpen(false); setVarDeletePassword(''); }} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition">Batal</button><button onClick={handleDeleteVariablesConfirm} disabled={isDeleting || !varDeletePassword} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">{isDeleting ? 'Menghapus...' : 'Hapus'}</button></div></div></div></div></div>)}
        {isRestoreModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]"><div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><div className="flex items-center gap-3"><div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><RefreshCw size={20}/></div><div><h3 className="font-bold text-slate-800">Pulihkan Variabel Penilaian</h3><p className="text-xs text-slate-500">Beri nama label yang sesuai dengan data asli sebelum dihapus.</p></div></div><button onClick={() => setIsRestoreModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400"><X size={20}/></button></div><div className="p-6 overflow-y-auto flex-1"><div className="space-y-4"><div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 text-xs text-amber-800"><AlertTriangle size={16} className="shrink-0 mt-0.5"/><p>Sistem tidak dapat mengembalikan nama variabel secara otomatis. Mohon ketik nama yang sesuai agar data tersaji dengan benar.</p></div><table className="w-full text-left text-sm"><thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase"><tr><th className="px-3 py-2 w-16 text-center">Posisi</th><th className="px-3 py-2">ID Data</th><th className="px-3 py-2 w-32">Tipe</th><th className="px-3 py-2">Nama Asli Variabel (Wajib Diisi)</th><th className="px-3 py-2 w-10"></th></tr></thead><tbody className="divide-y divide-slate-100">{restoreConfigs.map((cfg, idx) => (<tr key={cfg.id} className="hover:bg-slate-50"><td className="px-3 py-3"><div className="flex items-center justify-center gap-1"><button onClick={() => handleMoveUp(idx)} disabled={idx === 0} className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"><ArrowUp size={14} /></button><button onClick={() => handleMoveDown(idx)} disabled={idx === restoreConfigs.length - 1} className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"><ArrowDown size={14} /></button></div></td><td className="px-3 py-3 font-mono text-[10px] text-slate-400 select-all" title={cfg.id}>{cfg.id.substring(0,8)}...</td><td className="px-3 py-3"><select value={cfg.type} onChange={(e) => handleUpdateRestoreConfig(idx, 'type', e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"><option value="star">★ Bintang</option><option value="slider">⸺ Skala</option><option value="text">¶ Teks</option></select>{cfg.type !== cfg.originalInferredType && (<div className="text-[10px] text-amber-600 mt-1">Terdeteksi: {cfg.originalInferredType}</div>)}</td><td className="px-3 py-3"><input type="text" value={cfg.label} onChange={(e) => handleUpdateRestoreConfig(idx, 'label', e.target.value)} className={`w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${!cfg.label ? 'border-red-300 ring-red-100 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-200'}`} placeholder="Ketik Pertanyaan/Variabel..." autoFocus={idx === 0} /></td><td className="px-3 py-3"><button onClick={() => handleRemoveRestoreConfig(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus dari daftar pemulihan (Data tidak akan ditampilkan)"><Trash2 size={16} /></button></td></tr>))}</tbody></table></div></div><div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3"><button onClick={() => setIsRestoreModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm">Batal</button><button onClick={handleExecuteRestore} disabled={isRestoring} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">{isRestoring ? <RefreshCw size={16} className="animate-spin"/> : <Save size={16}/>} Pulihkan & Simpan Permanen</button></div></div></div>)}
        {isDeleteModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95"><div className="p-6"><div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><Trash2 className="text-red-600" size={24}/></div><h3 className="text-center font-bold text-slate-800 text-lg mb-2">Hapus Hasil Penilaian?</h3><p className="text-center text-slate-500 text-sm mb-6">Anda akan menghapus seluruh data penilaian untuk fasilitator <strong>{targetToDelete}</strong> dalam pelatihan ini. Tindakan ini tidak dapat dibatalkan.</p><div className="space-y-3"><div><label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kode Otorisasi (Sandi)</label><div className="relative"><Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="Masukkan sandi..." autoFocus /></div></div><div className="flex gap-2 pt-2"><button onClick={() => { setIsDeleteModalOpen(false); setTargetToDelete(null); }} className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition">Batal</button><button onClick={handleDeleteConfirm} disabled={isDeleting || !deletePassword} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">{isDeleting ? 'Menghapus...' : 'Hapus Data'}</button></div></div></div></div></div>)}

      </div>
    </div>
  );
};
