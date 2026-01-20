
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTrainingById, getResponses, deleteFacilitatorResponses, getSettings } from '../services/storageService';
import { Training, Response, QuestionType, Question } from '../types';
import { ArrowLeft, User, Layout, Quote, Calendar, Award, Trash2, Lock, X, UserCheck } from 'lucide-react';

export const ResultsView: React.FC = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [training, setTraining] = useState<Training>();
  const [responses, setResponses] = useState<Response[]>([]);
  const [activeTab, setActiveTab] = useState<'facilitator' | 'process'>('facilitator');

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [sysDeletePass, setSysDeletePass] = useState('adm123'); // Default fallback

  useEffect(() => {
    const fetchData = async () => {
        if (trainingId) {
            setTraining(await getTrainingById(trainingId));
            setResponses(await getResponses(trainingId));
            
            // Get delete password
            const s = await getSettings();
            if (s.deletePassword) setSysDeletePass(s.deletePassword);
        }
    };
    fetchData();
  }, [trainingId]);

  if (!training) return <div className="p-8 text-center text-slate-500">Memuat Laporan...</div>;

  const formatDateID = (dateStr: string) => {
     if (!dateStr) return '';
     return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const filteredResponses = responses.filter(r => r.type === activeTab);
  const questions = activeTab === 'facilitator' ? training.facilitatorQuestions : training.processQuestions;

  // --- DATA PROCESSING START ---
  
  // Interface for flattened session data
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

  // 1. Group responses into unique sessions (Name + Subject)
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

  // 2. Flatten to array and Attach Dates from Training Data
  let flatSessions: SessionData[] = Object.keys(groupedSessions).map(key => {
      const [name, subject] = key.split('|');
      const items = groupedSessions[key];
      
      // Find Date Metadata
      let date = '';
      if (activeTab === 'facilitator') {
          const facData = training.facilitators.find(f => f.name === name && f.subject === subject);
          if (facData) date = facData.sessionDate;
      }

      // Calculate Stats immediately
      const overall = calculateOverall(items, questions);

      return { name, subject, date, items, overall };
  });

  // 3. SORTING LOGIC: Chronological (Date Ascending)
  // If dates are equal, fallback to Order or Name
  flatSessions.sort((a, b) => {
      if (activeTab === 'process') return 0;

      // Primary: Date Ascending
      if (a.date && b.date) {
          if (a.date < b.date) return -1;
          if (a.date > b.date) return 1;
      }
      
      // Secondary: Original Order in Training Data (to keep consistent within same day)
      const facA = training.facilitators.find(f => f.name === a.name && f.subject === a.subject);
      const facB = training.facilitators.find(f => f.name === b.name && f.subject === b.subject);
      const orderA = facA?.order || 0;
      const orderB = facB?.order || 0;
      
      return orderA - orderB;
  });

  // --- DATA PROCESSING END ---

  function calculateOverall(items: Response[], qs: Question[]) {
      // Star Calculation
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

      // Slider Calculation
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

  const getAverage = (responses: Response[], qId: string) => {
    const valid = responses.filter(r => typeof r.answers[qId] === 'number');
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, curr) => acc + (curr.answers[qId] as number), 0);
    return Number((sum / valid.length).toFixed(2)); 
  };

  const getTextAnswers = (responses: Response[], qId: string) => {
      return responses
        .map(r => r.answers[qId])
        .filter(a => typeof a === 'string' && a.trim() !== '') as string[];
  }

  // Helper for Label
  const getLabel = (val: number, type: QuestionType) => {
      if (type === 'text') return '';
      if (type === 'star') {
          if (val >= 4.2) return 'Sangat Baik';
          if (val >= 3.4) return 'Baik';
          if (val >= 2.6) return 'Cukup';
          if (val >= 1.8) return 'Sedang';
          return 'Kurang';
      } else {
          // Slider Scale: 45-100 with breakpoints 55, 75, 85
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
  }

  // --- NEW: Calculate Grand Average for Facilitators ---
  let grandAvg = 0;
  let grandAvgLabel = '';
  let grandAvgColor = '';

  if (activeTab === 'facilitator' && flatSessions.length > 0) {
      let totalSessionAvg = 0;
      let sessionCount = 0;

      flatSessions.forEach(session => {
          let sessionTotalScore = 0;
          let sessionMetricCount = 0;

          questions.forEach(q => {
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

  // --- DELETE HANDLERS ---
  const handleInitiateDelete = (name: string) => {
      setTargetToDelete(name);
      setDeletePassword('');
      setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
      if (deletePassword !== sysDeletePass) {
          alert("Kata sandi salah!");
          return;
      }
      
      if (trainingId && targetToDelete) {
          setIsDeleting(true);
          try {
              await deleteFacilitatorResponses(trainingId, targetToDelete);
              
              const updatedResponses = responses.filter(r => 
                  !(r.type === 'facilitator' && r.targetName === targetToDelete)
              );
              setResponses(updatedResponses);
              
              setIsDeleteModalOpen(false);
              setTargetToDelete(null);
          } catch (error) {
              alert("Gagal menghapus data.");
          } finally {
              setIsDeleting(false);
          }
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
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
                        
                        {/* COMBINED INFO DISPLAY (SINGLE LINE, PLAIN TEXT) */}
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
            
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1 self-start md:self-center">
                <button
                    onClick={() => setActiveTab('facilitator')}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${activeTab === 'facilitator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Fasilitator
                </button>
                <button
                    onClick={() => setActiveTab('process')}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${activeTab === 'process' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Penyelenggaraan
                </button>
            </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* GRAND AVERAGE SUMMARY CARD (FACILITATOR ONLY) */}
        {activeTab === 'facilitator' && grandAvg > 0 && (
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
                        <div className="text-3xl font-bold text-slate-900 leading-none">{grandAvg}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Nilai Rata-rata</div>
                     </div>
                     <div className={`px-4 py-1.5 rounded-lg border-2 font-bold text-xs uppercase tracking-wide shadow-sm ${grandAvgColor}`}>
                        {grandAvgLabel}
                     </div>
                </div>
            </div>
        )}

        {flatSessions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-4 rounded-full mb-3 text-slate-400">
                    <Layout size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Belum Ada Data</h3>
                <p className="text-slate-500 text-sm">Belum ada responden yang mengisi kategori ini.</p>
             </div>
        ) : (
            <div className="space-y-6">
                {flatSessions.map((session, idx) => {
                    const dateStr = session.date ? formatDateID(session.date) : '';
                    
                    return (
                        <div key={`${session.name}-${session.subject}-${idx}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                             {/* Card Header (Name & Subject & Date) */}
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
                                            {activeTab === 'facilitator' && (
                                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                                                    {session.subject}
                                                </span>
                                            )}
                                            {dateStr && <span className="flex items-center gap-1"><Calendar size={12}/> {dateStr}</span>}
                                            
                                            {activeTab === 'process' && training.processOrganizer && (
                                                <span className="flex items-center gap-1"><UserCheck size={12}/> {training.processOrganizer.name}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {activeTab === 'facilitator' && (
                                    <button 
                                        onClick={() => handleInitiateDelete(session.name)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 hover:bg-red-50 rounded transition-colors"
                                        title="Hapus Nilai Fasilitator Ini (Semua Sesi)"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                             </div>

                             {/* Session Details */}
                             <div className="p-4">
                                {/* Sub-Header Stats */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 border-b border-slate-50 pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-2">
                                            {session.overall.hasStar && (
                                                <div className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-1.5">
                                                    <span className="text-[9px] uppercase font-bold text-yellow-600 tracking-wider">BINTANG</span>
                                                    <span className="text-xs font-bold text-slate-800">{session.overall.starAvg}</span>
                                                </div>
                                            )}
                                            {session.overall.hasSlider && (
                                                <div className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1.5">
                                                    <span className="text-[9px] uppercase font-bold text-blue-600 tracking-wider">SKALA</span>
                                                    <span className="text-xs font-bold text-slate-800">{session.overall.sliderAvg}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">
                                            {session.items.length} Responden
                                        </span>
                                    </div>
                                </div>

                                {/* Grid of Scores */}
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {questions.map(q => {
                                        const avg = getAverage(session.items, q.id);
                                        const label = getLabel(avg, q.type);
                                        const labelColor = getLabelColor(avg, q.type);
                                        
                                        return (
                                        <div key={q.id} className="bg-white border border-slate-100 rounded-lg p-2.5 shadow-sm flex flex-col h-full">
                                            <p className="text-[11px] font-bold text-slate-700 mb-1.5 line-clamp-2 h-[28px] leading-snug" title={q.label}>{q.label}</p>
                                            
                                            <div className="mt-auto">
                                                {q.type === 'text' ? (
                                                    <div className="bg-slate-50 rounded-lg p-2 max-h-32 overflow-y-auto space-y-2 custom-scrollbar border border-slate-100">
                                                        {getTextAnswers(session.items, q.id).length > 0 ? (
                                                            getTextAnswers(session.items, q.id).map((ans, idx) => (
                                                                <div key={idx} className="flex gap-1.5 text-[10px] text-slate-600 leading-relaxed border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                                                    <Quote size={10} className="text-slate-400 min-w-[10px] mt-0.5" />
                                                                    <p className="italic">{ans}</p>
                                                                </div>
                                                            ))
                                                        ) : ( <span className="text-[10px] text-slate-400">Tidak ada jawaban</span> )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between pt-1">
                                                        <span className="text-lg font-bold text-slate-800 tracking-tight">{avg}</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${labelColor}`}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                             </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-6">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="text-red-600" size={24}/>
                        </div>
                        <h3 className="text-center font-bold text-slate-800 text-lg mb-2">Hapus Hasil Penilaian?</h3>
                        <p className="text-center text-slate-500 text-sm mb-6">
                            Anda akan menghapus seluruh data penilaian untuk fasilitator <strong>{targetToDelete}</strong> dalam pelatihan ini. Tindakan ini tidak dapat dibatalkan.
                        </p>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kode Otorisasi (Sandi)</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="password" 
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                                        placeholder="Masukkan sandi..."
                                        autoFocus
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                                <button 
                                    onClick={() => { setIsDeleteModalOpen(false); setTargetToDelete(null); }} 
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition"
                                >
                                    Batal
                                </button>
                                <button 
                                    onClick={handleDeleteConfirm} 
                                    disabled={isDeleting || !deletePassword}
                                    className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? 'Menghapus...' : 'Hapus Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
