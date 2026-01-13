
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTrainingById, getResponses } from '../services/storageService';
import { Training, Response } from '../types';
import { MessageSquare, Calendar, User, BookOpen, ArrowLeft, Quote } from 'lucide-react';

export const CommentsView: React.FC = () => {
  const { trainingId, facilitatorId } = useParams<{ trainingId: string; facilitatorId: string }>();
  const [training, setTraining] = useState<Training | undefined>(undefined);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (trainingId) {
        const tData = await getTrainingById(trainingId);
        const rData = await getResponses(trainingId);
        setTraining(tData);
        setResponses(rData);
        setLoading(false);
      }
    };
    fetchData();
  }, [trainingId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Memuat Pesan...</div>;
  if (!training || !facilitatorId) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">Data tidak ditemukan.</div>;

  // Find the facilitator details
  const facilitator = training.facilitators.find(f => f.id === facilitatorId);
  if (!facilitator) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">Fasilitator tidak ditemukan.</div>;

  // Filter responses for this facilitator
  const facilitatorResponses = responses.filter(r => 
    r.type === 'facilitator' && 
    r.targetName === facilitator.name && 
    r.targetSubject === facilitator.subject
  );

  // Get only text questions
  const textQuestions = training.facilitatorQuestions.filter(q => q.type === 'text');

  // Helper date format
  const formatDateID = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="bg-indigo-600 pb-20 pt-10 px-4">
        <div className="max-w-3xl mx-auto text-white">
            <div className="flex items-center gap-2 mb-4 opacity-80">
                <Link to="/" className="hover:bg-white/20 p-1 rounded transition"><ArrowLeft size={20}/></Link>
                <span className="text-sm font-medium tracking-wide uppercase">Kotak Pesan Responden</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{facilitator.name}</h1>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-indigo-100 text-sm">
                <div className="flex items-center gap-2"><BookOpen size={16}/> <span>{facilitator.subject}</span></div>
                <div className="flex items-center gap-2"><Calendar size={16}/> <span>{formatDateID(facilitator.sessionDate)}</span></div>
            </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-10 pb-20">
        <div className="bg-white rounded-2xl shadow-xl border border-indigo-50 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="text-indigo-600" size={20}/>
                    Daftar Pesan Masuk
                </h2>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                    {facilitatorResponses.length} Responden
                </span>
            </div>

            <div className="divide-y divide-slate-100">
                {textQuestions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">Tidak ada pertanyaan isian teks dalam evaluasi ini.</div>
                ) : (
                    textQuestions.map(question => {
                        // Extract answers for this question
                        const answers = facilitatorResponses
                            .map(r => r.answers[question.id])
                            .filter(a => typeof a === 'string' && a.trim() !== '') as string[];

                        return (
                            <div key={question.id} className="p-6">
                                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide border-l-4 border-indigo-500 pl-3">
                                    {question.label}
                                </h3>
                                
                                {answers.length > 0 ? (
                                    <div className="space-y-3">
                                        {answers.map((ans, idx) => (
                                            <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100 relative group hover:border-indigo-200 transition-colors">
                                                <Quote size={24} className="absolute top-2 left-2 text-slate-200 group-hover:text-indigo-100 transition-colors" />
                                                <p className="relative z-10 text-slate-700 text-sm leading-relaxed pl-4 italic">
                                                    "{ans}"
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                                        Belum ada pesan untuk kategori ini.
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-xs text-slate-400">Pesan ini bersifat anonim dari responden pelatihan {training.title}.</p>
            </div>
        </div>
      </div>
    </div>
  );
};
