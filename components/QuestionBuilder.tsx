import React, { useState } from 'react';
import { Question, QuestionType } from '../types';
import { Plus, Trash2, GripVertical, Star, Sliders, Type, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  title: string;
}

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({ questions, onChange, title }) => {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<QuestionType>('star');

  const addQuestion = () => {
    if (!newLabel.trim()) return;
    const newQ: Question = {
      id: uuidv4(),
      label: newLabel,
      type: newType,
    };
    onChange([...questions, newQ]);
    setNewLabel('');
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter(q => q.id !== id));
  };

  const updateQuestionType = (id: string, newType: QuestionType) => {
    const updatedQuestions = questions.map(q => 
        q.id === id ? { ...q, type: newType } : q
    );
    onChange(updatedQuestions);
  };

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">{title}</h3>
      
      <div className="space-y-2 mb-6">
        {questions.length === 0 && (
          <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-sm text-slate-400 bg-slate-50">
            Belum ada pertanyaan. Tambahkan di bawah.
          </div>
        )}
        {questions.map((q, idx) => (
          <div key={q.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm group hover:border-indigo-300 transition">
            <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-500 text-xs font-mono font-medium">{idx + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{q.label}</p>
            </div>
            
            {/* Dropdown Type Selector */}
            <div className="relative group/select">
                <select
                    value={q.type}
                    onChange={(e) => updateQuestionType(q.id, e.target.value as QuestionType)}
                    className="appearance-none bg-slate-50 border border-slate-200 hover:border-indigo-300 text-slate-600 text-xs font-medium rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors"
                >
                    <option value="star">★ Rating Bintang</option>
                    <option value="slider">⸺ Skala 1-100</option>
                    <option value="text">¶ Isian Teks</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 group-hover/select:text-indigo-500 transition-colors">
                    <ChevronDown size={14} />
                </div>
            </div>

            <button
              onClick={() => removeQuestion(q.id)}
              className="text-slate-300 hover:text-red-500 p-1.5 transition"
              title="Hapus"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
         <p className="text-xs font-semibold text-slate-500 mb-3 uppercase">Tambah Variabel Baru</p>
         <div className="flex flex-col md:flex-row gap-3">
            <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Tulis pertanyaan disini..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
            />
            <div className="flex gap-2 w-full md:w-auto">
                <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as QuestionType)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white min-w-[140px]"
                >
                    <option value="star">★ Bintang</option>
                    <option value="slider">⸺ Geser (0-100)</option>
                    <option value="text">¶ Teks</option>
                </select>
                <button
                onClick={addQuestion}
                disabled={!newLabel.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                <Plus size={16} /> Tambah
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};