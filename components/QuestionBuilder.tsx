
import React, { useState } from 'react';
import { Question, QuestionType } from '../types';
import { Plus, Trash2, GripVertical, Star, Sliders, Type, ChevronDown, Edit2, Check, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  title: string;
}

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({ questions, onChange, title }) => {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<QuestionType>('star');

  // State for Editing Existing Items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState('');

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
    if (confirm("Hapus variabel ini?")) {
        onChange(questions.filter(q => q.id !== id));
    }
  };

  const updateQuestionType = (id: string, newType: QuestionType) => {
    const updatedQuestions = questions.map(q => 
        q.id === id ? { ...q, type: newType } : q
    );
    onChange(updatedQuestions);
  };

  // --- EDIT HANDLERS ---
  const startEdit = (q: Question) => {
      setEditingId(q.id);
      setEditLabelText(q.label);
  };

  const cancelEdit = () => {
      setEditingId(null);
      setEditLabelText('');
  };

  const saveEdit = () => {
      if (!editLabelText.trim()) return;
      const updatedQuestions = questions.map(q => 
          q.id === editingId ? { ...q, label: editLabelText } : q
      );
      onChange(updatedQuestions);
      setEditingId(null);
      setEditLabelText('');
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
          <div key={q.id} className={`flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm transition ${editingId === q.id ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-slate-200 group hover:border-indigo-300'}`}>
            <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-500 text-xs font-mono font-medium shrink-0">{idx + 1}</span>
            
            <div className="flex-1 min-w-0">
                {editingId === q.id ? (
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            value={editLabelText} 
                            onChange={(e) => setEditLabelText(e.target.value)}
                            className="flex-1 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                            onKeyDown={(e) => { if(e.key === 'Enter') saveEdit(); else if(e.key === 'Escape') cancelEdit(); }}
                        />
                        <button onClick={saveEdit} className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200" title="Simpan"><Check size={14}/></button>
                        <button onClick={cancelEdit} className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200" title="Batal"><X size={14}/></button>
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-slate-800 truncate" title={q.label}>{q.label}</p>
                )}
            </div>
            
            {/* Dropdown Type Selector */}
            <div className="relative group/select shrink-0">
                <select
                    value={q.type}
                    onChange={(e) => updateQuestionType(q.id, e.target.value as QuestionType)}
                    className="appearance-none bg-slate-50 border border-slate-200 hover:border-indigo-300 text-slate-600 text-xs font-medium rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors w-[130px]"
                >
                    <option value="star">★ Bintang</option>
                    <option value="slider">⸺ Skala 1-100</option>
                    <option value="text">¶ Isian Teks</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 group-hover/select:text-indigo-500 transition-colors">
                    <ChevronDown size={14} />
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                {editingId !== q.id && (
                    <button
                        onClick={() => startEdit(q)}
                        className="text-slate-300 hover:text-indigo-600 p-1.5 transition rounded hover:bg-indigo-50"
                        title="Edit Uraian"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                <button
                onClick={() => removeQuestion(q.id)}
                className="text-slate-300 hover:text-red-500 p-1.5 transition rounded hover:bg-red-50"
                title="Hapus"
                >
                <Trash2 size={16} />
                </button>
            </div>
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
