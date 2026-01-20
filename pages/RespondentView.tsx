
import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getTrainingById, saveResponse, saveTraining, getRespondentHistory, saveRespondentHistory, checkParticipantLimitReached } from '../services/storageService';
import { checkAndSendAutoReport } from '../services/whatsappService';
import { Training, Response } from '../types';
import { StarRating } from '../components/StarRating';
import { SliderRating } from '../components/SliderRating';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle, AlertOctagon, User, Layout, ChevronRight, Home, ArrowLeft, Lock, Calendar, CheckSquare, ShieldCheck, Clock, AlertCircle } from 'lucide-react';

type Tab = 'facilitator' | 'process';

export const RespondentView: React.FC = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const location = useLocation();
  const [training, setTraining] = useState<Training | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('facilitator');
  const [submitted, setSubmitted] = useState(false);

  // Check Admin/Bypass Mode
  const queryParams = new URLSearchParams(location.search);
  const isAdminMode = queryParams.get('mode') === 'admin';

  // History State
  const [submittedFacilitatorIds, setSubmittedFacilitatorIds] = useState<string[]>([]);

  // Form State
  const [facilitatorMode, setFacilitatorMode] = useState<'select' | 'custom'>('select');
  const [selectedFacilitatorId, setSelectedFacilitatorId] = useState('');
  const [customFacName, setCustomFacName] = useState('');
  const [customFacSubject, setCustomFacSubject] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  
  // Validation State
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const loadTraining = async () => {
      if (!trainingId) return;

      // 1. Try to find in local storage
      let data: Training | undefined = await getTrainingById(trainingId);

      // 2. Data extraction from URL for portability (Direct Access)
      const params = new URLSearchParams(location.search);
      const dataStr = params.get('data');
      if (dataStr) {
        try {
          const decodedJson = decodeURIComponent(escape(atob(dataStr)));
          const decodedTraining = JSON.parse(decodedJson);
          if (decodedTraining.id === trainingId) {
            data = decodedTraining as Training;
            // Crucial: Save to respondent's local storage so they don't need a code next time
            await saveTraining(data);
          }
        } catch (e) {
          console.error("Failed to parse training data from token", e);
        }
      }

      setTraining(data);
      
      // Load History
      if (trainingId) {
          setSubmittedFacilitatorIds(getRespondentHistory(trainingId));
      }

      setLoading(false);
    };

    loadTraining();
  }, [trainingId, location.search]);

  // Check if Process Evaluation is available
  const isProcessAvailable = () => {
    if (isAdminMode) return true; // BYPASS ADMIN MODE

    if (!training) return false;
    const targetDateStr = training.processEvaluationDate || training.endDate;
    if (!targetDateStr) return true;

    const today = new Date().toISOString().split('T')[0];
    return today >= targetDateStr;
  };

  const handleTabChange = (tab: Tab) => {
      if (tab === 'process' && !isProcessAvailable()) {
          alert(`Evaluasi Penyelenggaraan baru dapat diisi mulai tanggal ${new Date(training?.processEvaluationDate || training?.endDate || '').toLocaleDateString('id-ID')}.`);
          return;
      }
      setActiveTab(tab);
      setAnswers({});
      setValidationError(null);
  };

  const handleAnswerChange = (qId: string, val: string | number) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
    if (validationError) setValidationError(null); // Clear error on interaction
  };

  const resetForm = () => {
    setAnswers({});
    setValidationError(null);
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Refresh history
    if (training?.id) {
        setSubmittedFacilitatorIds(getRespondentHistory(training.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!training) return;
    setValidationError(null);

    let targetName = '';
    let targetSubject = '';
    let facId = '';

    // 1. VALIDATE CONTEXT (Facilitator Selection)
    if (activeTab === 'facilitator') {
      if (facilitatorMode === 'select') {
        const fac = training.facilitators.find(f => f.id === selectedFacilitatorId);
        if (!fac) {
            alert('Mohon pilih fasilitator terlebih dahulu.');
            return;
        }
        // Double check against history just in case (Ignore if Admin Mode)
        if (!isAdminMode && submittedFacilitatorIds.includes(fac.id)) {
            alert('Anda sudah menilai fasilitator ini sebelumnya.');
            return;
        }

        targetName = fac.name;
        targetSubject = fac.subject;
        facId = fac.id;
      } else {
        if (!customFacName || !customFacSubject) {
            alert('Mohon lengkapi nama dan materi fasilitator.');
            return;
        }
        targetName = customFacName;
        targetSubject = customFacSubject;
      }
    } else {
      targetName = "Proses Penyelenggaraan";
    }

    // 2. VALIDATE ANSWERS (Strict: All Must be Filled/Touched)
    const questionsToCheck = activeTab === 'facilitator' ? training.facilitatorQuestions : training.processQuestions;
    const missingFields = questionsToCheck.filter(q => {
        const val = answers[q.id];
        
        // Text: Must be non-empty string
        if (q.type === 'text') {
            return !val || String(val).trim() === '';
        }
        
        // Slider: Must be defined (user must interact with it)
        // If val is undefined, it means user didn't touch it (even if UI shows 45 default)
        if (q.type === 'slider') {
            return val === undefined || val === null;
        }
        
        // Star: Must be > 0
        return !val || val === 0;
    });

    if (missingFields.length > 0) {
        // Build detailed error message
        const errorList = missingFields.map(q => {
             // Calculate real index (1-based) from the original list
             const index = questionsToCheck.findIndex(item => item.id === q.id) + 1;
             
             let reason = "belum diisi";
             if (q.type === 'slider') reason = "belum digeser (wajib ubah dari posisi awal)";
             if (q.type === 'star') reason = "belum diberi bintang";
             if (q.type === 'text') reason = "saran/komentar belum ditulis";

             return `• Pertanyaan ${index} (${q.label}) : ${reason}`;
        }).join('\n');

        setValidationError(`Mohon lengkapi bagian berikut sebelum mengirim:\n${errorList}`);
        return;
    }

    // 3. CHECK LIMIT & SAVE
    // Logic: If Admin, always save. If Limit Reached, DO NOT SAVE but behave as if successful.
    
    let shouldSave = true;

    if (!isAdminMode && training.participantLimit && training.participantLimit > 0) {
        const isLimitReached = await checkParticipantLimitReached(
            training.id,
            training.participantLimit,
            activeTab,
            activeTab === 'facilitator' ? targetName : undefined,
            activeTab === 'facilitator' ? targetSubject : undefined
        );

        if (isLimitReached) {
            shouldSave = false;
            console.log('Participant limit reached. Response will not be saved to DB.');
        }
    }

    if (shouldSave) {
        const response: Response = {
          id: uuidv4(),
          trainingId: training.id,
          type: activeTab,
          targetName,
          targetSubject: activeTab === 'facilitator' ? targetSubject : undefined,
          answers,
          timestamp: Date.now()
        };

        saveResponse(response);
        
        // Automation only triggers if data is actually saved
        if (activeTab === 'facilitator' && facId) {
            checkAndSendAutoReport(training.id, facId, targetName, 'facilitator').catch(console.error);
        } else if (activeTab === 'process') {
            checkAndSendAutoReport(training.id, '', '', 'process').catch(console.error);
        }
    }

    // Always update local history (User experience: "I have done this")
    if (activeTab === 'facilitator' && facId) {
        saveRespondentHistory(training.id, facId);
    }
    
    setSubmitted(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Memuat data...</div>;

  if (!training) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-md">
          <AlertOctagon size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Data Tidak Ditemukan</h1>
          <p className="text-slate-500 mb-6">Link yang Anda gunakan mungkin tidak lengkap atau kedaluwarsa.</p>
          <Link to="/" className="text-indigo-600 font-medium hover:underline">Kembali ke Beranda</Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-50 mb-6 shadow-sm">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Terima Kasih!</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">Masukan Anda sangat berharga bagi peningkatan kualitas pelatihan kami.</p>
          
          <div className="space-y-3">
            <button
              onClick={resetForm}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-black transition shadow-lg transform hover:-translate-y-1"
            >
              Lanjut Penilaian Lainnya
            </button>
            <Link 
              to="/" 
              className="flex items-center justify-center w-full py-4 rounded-xl font-semibold text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              <Home size={18} className="mr-2" /> Kembali ke Halaman Depan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const questions = activeTab === 'facilitator' ? training.facilitatorQuestions : training.processQuestions;
  const processUnlocked = isProcessAvailable();

  // Helper Date Today (Local YYYY-MM-DD)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Filter facilitators logic:
  // 1. Must match Date (Auto) or be Manually Open (IGNORED IF ADMIN MODE)
  // 2. Must NOT match Manually Locked (IGNORED IF ADMIN MODE)
  // 3. Must check Time if exists (IGNORED IF ADMIN MODE)
  // 4. Must NOT be in submittedFacilitatorIds (History) (IGNORED IF ADMIN MODE)
  
  // First, find all technically available based on Admin/Date/Time
  const technicallyAvailable = training.facilitators.filter(f => {
      if (isAdminMode) return true; // BYPASS ALL CHECKS

      // Manual Override: If Explicitly Locked/Open, priority #1
      if (f.isOpen === false) return false; // Manual Lock
      if (f.isOpen === true) return true;   // Manual Open

      // Auto Logic: Check Date
      if (f.sessionDate !== todayStr) return false; // Not today

      // Auto Logic: Check Time (if set)
      if (f.sessionStartTime) {
          const [hours, minutes] = f.sessionStartTime.split(':').map(Number);
          const startDateTime = new Date();
          startDateTime.setHours(hours, minutes, 0, 0);

          if (today < startDateTime) return false; // Too early
      }

      return true;
  });

  // Then filter out the ones user already submitted
  const availableFacilitators = technicallyAvailable.filter(f => {
      if (isAdminMode) return true; // BYPASS HISTORY CHECK
      return !submittedFacilitatorIds.includes(f.id);
  });
  
  const allFacilitatorsDone = technicallyAvailable.length > 0 && availableFacilitators.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className={`h-64 w-full absolute top-0 left-0 z-0 ${isAdminMode ? 'bg-slate-800' : 'bg-indigo-600'}`}></div>
      
      {/* Top Nav */}
      <nav className="relative z-10 max-w-2xl mx-auto px-4 pt-6 pb-2 flex justify-between items-center">
         <Link to="/" className="flex items-center gap-2 text-indigo-100 hover:text-white transition-colors group">
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm group-hover:bg-white/20 transition">
              <ArrowLeft size={20} />
            </div>
            <span className="text-sm font-medium">Kembali</span>
         </Link>
         <div className="text-white/80 text-xs font-semibold tracking-wide uppercase">
            {isAdminMode ? <span className="flex items-center gap-1 text-yellow-400"><ShieldCheck size={14}/> ADMIN / BYPASS MODE</span> : 'SIMEP - Monitoring & Evaluasi'}
         </div>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-4">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-5 border border-indigo-50">
           <h1 className="text-xl font-bold text-slate-900 mb-1">{training.title}</h1>
           <p className="text-slate-500 text-xs mb-2">
              {new Date(training.startDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
           </p>
           {training.description && (
               <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                   {training.description}
               </div>
           )}
           {isAdminMode && (
               <div className="mt-3 bg-yellow-50 border border-yellow-200 p-2 rounded text-[10px] text-yellow-700 font-medium text-center">
                   Mode Admin Aktif: Semua fasilitator dan menu penyelenggaraan dibuka. Validasi riwayat dinonaktifkan.
               </div>
           )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-sm p-1.5 mb-5 flex gap-2 sticky top-4 z-20 border border-white/50">
           <button
             onClick={() => handleTabChange('facilitator')}
             className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'facilitator' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-indigo-50'}`}
           >
             <User size={16} /> Fasilitator
           </button>
           <button
             onClick={() => handleTabChange('process')}
             className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'process' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : !processUnlocked 
                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed opacity-80' 
                    : 'text-slate-500 hover:bg-indigo-50'
              }`}
           >
             {processUnlocked ? <Layout size={16} /> : <Lock size={14} />} 
             Penyelenggaraan
           </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Context Input */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
             {activeTab === 'facilitator' ? (
               <div className="space-y-3">
                 <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                    <button type="button" onClick={() => setFacilitatorMode('select')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${facilitatorMode === 'select' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Pilih Nama</button>
                    <button type="button" onClick={() => setFacilitatorMode('custom')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${facilitatorMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Tulis Manual</button>
                 </div>

                 {facilitatorMode === 'select' ? (
                   <div>
                     <label className="block text-xs font-bold text-slate-700 mb-1.5">Siapa Fasilitatornya?</label>
                     <div className="relative">
                        <select
                            value={selectedFacilitatorId}
                            onChange={(e) => setSelectedFacilitatorId(e.target.value)}
                            className="w-full appearance-none bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
                            disabled={availableFacilitators.length === 0}
                        >
                            <option value="">-- Pilih Nama --</option>
                            {availableFacilitators.map(f => (
                                <option key={f.id} value={f.id}>{f.name} - {f.subject}</option>
                            ))}
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={18}/>
                     </div>
                     
                     {/* Feedback Messages */}
                     {allFacilitatorsDone ? (
                         <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-2">
                             <CheckSquare className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                             <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                                 Terima kasih! Anda sudah menilai semua fasilitator yang tersedia untuk hari ini.
                                 <br/>Silakan cek tab <span className="font-bold">Penyelenggaraan</span> jika belum diisi.
                             </p>
                         </div>
                     ) : availableFacilitators.length === 0 ? (
                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                            <p className="flex items-center gap-1"><Calendar size={12}/> Fasilitator hanya muncul sesuai jadwal.</p>
                            <p className="flex items-center gap-1 italic opacity-80"><Clock size={12}/> Jika jadwal hari ini, pastikan waktu sesi sudah dimulai.</p>
                        </div>
                     ) : (
                         <p className="text-[10px] text-slate-400 mt-2 italic">* Fasilitator yang sudah Anda nilai tidak akan muncul dalam daftar ini.</p>
                     )}

                   </div>
                 ) : (
                    <div className="grid gap-3">
                        <input type="text" value={customFacName} onChange={(e) => setCustomFacName(e.target.value)} placeholder="Nama Lengkap Fasilitator" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 shadow-sm" />
                        <input type="text" value={customFacSubject} onChange={(e) => setCustomFacSubject(e.target.value)} placeholder="Materi yang diajarkan" className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 shadow-sm" />
                    </div>
                 )}
               </div>
             ) : (
                <div className="text-center py-2">
                    <h3 className="font-bold text-base text-slate-800">Evaluasi Proses</h3>
                    <p className="text-slate-500 text-xs">Berikan penilaian Anda mengenai fasilitas dan layanan.</p>
                </div>
             )}
          </div>

          {/* Questions List */}
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm p-4 border border-slate-100 transition-shadow hover:shadow-md">
                <div className="mb-2">
                    <span className="text-indigo-600 font-bold text-[10px] uppercase tracking-wider mb-0.5 block">Pertanyaan {idx + 1}</span>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">{q.label}</h3>
                </div>

                <div className="pt-1">
                    {q.type === 'star' && (
                        <StarRating 
                            value={answers[q.id] as number || 0} 
                            onChange={(val) => handleAnswerChange(q.id, val)} 
                        />
                    )}
                    {q.type === 'slider' && (
                        <SliderRating 
                            value={answers[q.id] as number || 0} 
                            onChange={(val) => handleAnswerChange(q.id, val)} 
                        />
                    )}
                    {q.type === 'text' && (
                        <textarea
                            rows={3}
                            value={answers[q.id] || ''}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 resize-none shadow-sm placeholder:text-slate-400"
                            placeholder="Ketik jawaban Anda disini..."
                        />
                    )}
                </div>
            </div>
          ))}

          <div className="pt-4 pb-12">
            {/* Validation Notice */}
            {validationError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-3 animate-pulse">
                    <AlertCircle className="shrink-0 mt-0.5 text-red-600" size={16} />
                    <div className="whitespace-pre-wrap font-medium leading-relaxed">
                        {validationError}
                    </div>
                </div>
            )}

            <button
                type="submit"
                disabled={activeTab === 'facilitator' && facilitatorMode === 'select' && availableFacilitators.length === 0}
                className="w-full bg-indigo-600 text-white font-bold text-base py-3.5 rounded-xl shadow-lg shadow-indigo-300 hover:bg-indigo-700 hover:shadow-xl transition-all transform active:scale-95 disabled:bg-slate-300 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed"
            >
                Kirim Evaluasi
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-4">SIMEP &copy; 2025</p>
          </div>

        </form>
      </main>
    </div>
  );
};
