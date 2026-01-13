
import React, { useEffect, useState, useRef } from 'react';
import { getTrainings, getResponses } from '../services/storageService';
import { exportToPDF, exportToExcel, exportToWord } from '../services/exportService';
import { Training } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, FileText, ChevronDown, Printer, FileIcon, FileSpreadsheet, Calendar, BookOpen, Search } from 'lucide-react';

export const GuestDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [exportDropdownId, setExportDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [guestInfo, setGuestInfo] = useState({ name: '', inst: '' });

  useEffect(() => {
    // Check session
    if (sessionStorage.getItem('isGuest') !== 'true') {
        navigate('/guest');
        return;
    }
    setGuestInfo({
        name: sessionStorage.getItem('guestName') || 'Tamu',
        inst: sessionStorage.getItem('guestInst') || '-'
    });
    
    const init = async () => {
        const fetchedTrainings = await getTrainings();
        setTrainings(fetchedTrainings);

        const counts: Record<string, number> = {};
        await Promise.all(fetchedTrainings.map(async (t) => {
            const res = await getResponses(t.id);
            counts[t.id] = res.length;
        }));
        setResponseCounts(counts);
    };
    init();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('isGuest');
    sessionStorage.removeItem('guestName');
    sessionStorage.removeItem('guestInst');
    navigate('/guest');
  };

  const formatDateID = (dateStr: string) => {
     if (!dateStr) return '';
     return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const filteredTrainings = trainings.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <nav className="bg-emerald-800 text-white sticky top-0 z-40 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-white"><BookOpen size={18}/></div>
                      <div className="flex flex-col">
                          <span className="font-bold text-lg text-white leading-none">SIMEP <span className="text-emerald-300">Tamu</span></span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden md:block text-right">
                        <div className="text-sm font-bold">{guestInfo.name}</div>
                        <div className="text-xs text-emerald-300">{guestInfo.inst}</div>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 text-emerald-100 hover:text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition"><LogOut size={18} /> <span className="hidden sm:inline">Keluar</span></button>
                  </div>
              </div>
          </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
         <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Laporan Evaluasi</h2>
                <p className="text-slate-500 text-sm">Akses laporan hasil evaluasi pelatihan.</p>
            </div>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                    type="text" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    placeholder="Cari pelatihan..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
            </div>
         </div>

         <div className="bg-white rounded-2xl shadow-sm border">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">Judul Pelatihan & Periode</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Responden</th>
                            <th className="px-6 py-4 text-right font-semibold text-slate-700">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredTrainings.length > 0 ? (
                            filteredTrainings.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 text-sm mb-1">{t.title}</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded">
                                            <Calendar size={12}/>
                                            <span>{formatDateID(t.startDate)} - {formatDateID(t.endDate)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold">{responseCounts[t.id] || 0} Respon</span></td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3" ref={dropdownRef}>
                                            <Link to={`/admin/results/${t.id}`} className="text-emerald-600 font-bold hover:underline">Lihat Detail</Link>
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
                            ))
                        ) : (
                            <tr><td colSpan={3} className="text-center py-8 text-slate-400 italic">Tidak ada data pelatihan.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
         </div>
      </main>
    </div>
  );
};
