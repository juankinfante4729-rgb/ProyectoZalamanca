import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Filter, 
  PlusCircle, 
  CheckCircle, 
  AlertCircle,
  Search,
  Users,
  BarChart3,
  RefreshCw,
  Download,
  Check,
  PieChart as PieIcon,
  Clock,
  Hourglass,
  ChevronDown,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Home,
  RotateCcw
} from 'lucide-react';

/**
 * NOTA PARA EL LOGOTIPO:
 * Asegúrate de que 'Alcazar.png' esté en la carpeta 'public/'.
 */
const logo = "/Alcazar.png";

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';

const getEnv = (key, fallback = '') => {
  try {
    const value = import.meta.env[key];
    return value || fallback;
  } catch (e) {
    return fallback;
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5;

let firebaseApp, auth, db;
if (isConfigValid) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  } catch (error) {
    console.error("Error inicializando Firebase:", error);
  }
}

const appId = getEnv('VITE_APP_ID', 'residencial-docs-v1');

const STAGES = [1, 2, 3, 4];
const DOC_STATUS = { PENDIENTE: 'Pendiente', REVISION: 'Revisión', OK: 'OK' };
const INITIAL_HOUSES_COUNT = 114;

const getStageForHouse = (num) => {
  if (num >= 1 && num <= 34) return 1;
  if (num >= 35 && num <= 62) return 2;
  if (num >= 63 && num <= 88) return 3;
  if (num >= 89 && num <= 114) return 4;
  return 1;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(isConfigValid);
  const [activeTab, setActiveTab] = useState('control');
  const [toast, setToast] = useState({ show: false, message: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- FILTROS AVANZADOS ---
  const [filterStage, setFilterStage] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterFachada, setFilterFachada] = useState('Todos');
  const [filterPredial, setFilterPredial] = useState('Todos');
  const [filterGravamen, setFilterGravamen] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // --- ORDENAMIENTO ---
  const [sortConfig, setSortConfig] = useState({ key: 'numero', direction: 'asc' });

  // --- PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Estados del Formulario
  const [formHouse, setFormHouse] = useState({
    id: '', numero: '', etapa: 1, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente'
  });
  const [houseSearchQuery, setHouseSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const clearFilters = () => {
    setFilterStage('Todas');
    setFilterStatus('Todos');
    setFilterFachada('Todos');
    setFilterPredial('Todos');
    setFilterGravamen('Todos');
    setSearchTerm('');
    setCurrentPage(1);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ show: false, message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const login = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error");
      }
    };
    login();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const housesCol = collection(db, 'artifacts', appId, 'public', 'data', 'houses');
    const q = query(housesCol);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        seedDatabase();
      } else {
        const housesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHouses(housesData.sort((a, b) => a.numero - b.numero));
        setLoading(false);
      }
    }, (err) => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const seedDatabase = async () => {
    if (!db) return;
    setLoading(true);
    const batch = writeBatch(db);
    for (let i = 1; i <= INITIAL_HOUSES_COUNT; i++) {
      const etapa = getStageForHouse(i);
      const houseRef = doc(db, 'artifacts', appId, 'public', 'data', 'houses', `casa-${i}`);
      batch.set(houseRef, {
        numero: i, etapa, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente', updatedAt: Date.now()
      });
    }
    await batch.commit();
  };

  const handleUpdateHouse = async (e) => {
    e.preventDefault();
    if (!formHouse.id || !db) return;
    try {
      const houseRef = doc(db, 'artifacts', appId, 'public', 'data', 'houses', formHouse.id);
      await setDoc(houseRef, { ...formHouse, updatedAt: Date.now() }, { merge: true });
      setToast({ show: true, message: `Casa #${formHouse.numero} actualizada.` });
      setFormHouse({ id: '', numero: '', etapa: 1, doc_fachada: 'Pendiente', doc_predial: 'Pendiente', doc_gravamen: 'Pendiente' });
      setHouseSearchQuery('');
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } catch (err) { 
      setToast({ show: true, message: 'Error al actualizar.' });
    }
  };

  const processedHouses = useMemo(() => {
    let result = houses.filter(h => {
      const stageMatch = filterStage === 'Todas' || h.etapa.toString() === filterStage.replace('Etapa ', '');
      const hStatus = (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE';
      const statusMatch = filterStatus === 'Todos' || hStatus === filterStatus;
      const fachadaMatch = filterFachada === 'Todos' || h.doc_fachada === filterFachada;
      const predialMatch = filterPredial === 'Todos' || h.doc_predial === filterPredial;
      const gravamenMatch = filterGravamen === 'Todos' || h.doc_gravamen === filterGravamen;
      const searchMatch = h.numero.toString().includes(searchTerm);
      return stageMatch && statusMatch && fachadaMatch && predialMatch && gravamenMatch && searchMatch;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (sortConfig.key === 'numero') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [houses, filterStage, filterStatus, filterFachada, filterPredial, filterGravamen, searchTerm, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStage, filterStatus, filterFachada, filterPredial, filterGravamen, searchTerm, sortConfig]);

  const paginatedHouses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedHouses.slice(startIndex, startIndex + itemsPerPage);
  }, [processedHouses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedHouses.length / itemsPerPage);

  const houseOptions = useMemo(() => {
    return houses.filter(h => h.numero.toString().includes(houseSearchQuery));
  }, [houses, houseSearchQuery]);

  const stats = useMemo(() => {
    const source = processedHouses; 
    const totalFiltered = source.length || 0;
    const completas = source.filter(h => (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK')).length;
    const avance = totalFiltered > 0 ? ((completas / totalFiltered) * 100).toFixed(1) : 0;
    
    const stageData = [1, 2, 3, 4].map(s => {
      const stageHouses = source.filter(h => h.etapa === s);
      const totalS = stageHouses.length;
      const comp = stageHouses.filter(h => (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK')).length;
      return { stage: s, comp, total: totalS };
    });

    const docStats = {
      fachada: source.filter(h => h.doc_fachada !== 'OK').length,
      predial: source.filter(h => h.doc_predial !== 'OK').length,
      gravamen: source.filter(h => h.doc_gravamen !== 'OK').length,
    };
    
    return { total: totalFiltered, completas, avance, stageData, docStats };
  }, [processedHouses]);

  const exportToCSV = () => {
    const headers = ["Casa", "Etapa", "Fachada", "Predial", "Gravamen", "Estado Final"];
    const rows = processedHouses.map(h => [
      h.numero, h.etapa, h.doc_fachada, h.doc_predial, h.doc_gravamen,
      (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Alcazar_Salamanca.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = filterStage !== 'Todas' || filterStatus !== 'Todos' || filterFachada !== 'Todos' || filterPredial !== 'Todos' || filterGravamen !== 'Todos' || searchTerm !== '';

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-600 font-sans overflow-hidden">
      
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-100 flex flex-col items-center relative">
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-slate-400 lg:hidden"><X size={20} /></button>
          <div className="w-full max-w-[150px] mb-2">
            <img src={logo} alt="Alcázar" className="w-full h-auto object-contain mx-auto" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            <div className="hidden text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Alcázar de Salamanca</div>
          </div>
          <p className="text-[#4F67EE] text-[9px] font-bold uppercase tracking-[0.2em] opacity-70 mt-3">Gestión de Documentos</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-100">
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Filter size={12} /> Filtros de Análisis
              </h3>
              {hasActiveFilters && (
                <button 
                  onClick={clearFilters}
                  className="text-[9px] font-bold text-[#4F67EE] uppercase hover:underline flex items-center gap-1 animate-in fade-in"
                >
                  <RotateCcw size={10} /> Limpiar
                </button>
              )}
            </div>
            <div className="space-y-3">
              <FilterSelect label="Etapa" value={filterStage} onChange={setFilterStage} options={['Todas', ...STAGES.map(s => `Etapa ${s}`)]} />
              <FilterSelect label="Estatus General" value={filterStatus} onChange={setFilterStatus} options={['Todos', 'COMPLETO', 'PENDIENTE']} />
              <div className="pt-2 space-y-3 border-t border-slate-50">
                <FilterSelect label="Foto Fachada" value={filterFachada} onChange={setFilterFachada} options={['Todos', ...Object.values(DOC_STATUS)]} />
                <FilterSelect label="Impuesto Predial" value={filterPredial} onChange={setFilterPredial} options={['Todos', ...Object.values(DOC_STATUS)]} />
                <FilterSelect label="Cert. Gravamen" value={filterGravamen} onChange={setFilterGravamen} options={['Todos', ...Object.values(DOC_STATUS)]} />
              </div>
            </div>
          </section>

          <form onSubmit={handleUpdateHouse} className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><PlusCircle size={12} /> Actualizar Casa</h3>
            <div className="space-y-4">
              <div className="relative" ref={dropdownRef}>
                <input 
                  type="text"
                  placeholder="Buscar casa..."
                  value={formHouse.numero ? `Casa #${formHouse.numero}` : houseSearchQuery}
                  onChange={(e) => {
                    if (formHouse.numero) { setFormHouse({ ...formHouse, id: '', numero: '' }); }
                    setHouseSearchQuery(e.target.value.replace(/[^0-9]/g, ''));
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full bg-blue-50/50 border border-blue-100 text-[#4F67EE] p-2.5 rounded-xl text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {isDropdownOpen && !formHouse.id && (
                  <div className="absolute z-[60] w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-48 overflow-y-auto scrollbar-thin">
                    {houseOptions.map(h => (
                      <div key={h.id} onClick={() => { setFormHouse({ ...h }); setIsDropdownOpen(false); }} className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-xs flex justify-between border-b border-slate-50 last:border-none group transition-colors">
                        <span className="font-medium text-slate-700">Casa #{h.numero}</span>
                        <span className="text-[9px] font-bold text-slate-400 group-hover:text-[#4F67EE]">Etapa {h.etapa}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {['fachada', 'predial', 'gravamen'].map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase ml-1">
                    {key === 'fachada' ? '1. Foto Fachada' : key === 'predial' ? '2. Impuesto Predial' : '3. Cert. Gravamen'}
                  </label>
                  <div className="relative">
                    <select value={formHouse[`doc_${key}`]} onChange={e => setFormHouse({...formHouse, [`doc_${key}`]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs appearance-none text-slate-600 font-medium outline-none">
                      {Object.values(DOC_STATUS).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              ))}
              <button type="submit" disabled={!formHouse.id} className="w-full bg-[#4F67EE] hover:bg-blue-700 disabled:bg-slate-200 text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 shadow-blue-100">Guardar Cambios</button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-100 mt-auto">
            <button onClick={exportToCSV} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 text-[10px] font-semibold uppercase tracking-wider py-3 bg-slate-50 rounded-2xl transition-all"><Download size={14} /> Exportar Reporte</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 lg:hidden hover:bg-slate-50 rounded-xl"><Menu size={22} /></button>
            <div className="flex gap-2 md:gap-8">
              {['control', 'dashboard'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)} 
                  className={`h-16 px-1 text-[9px] sm:text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'text-[#4F67EE] border-[#4F67EE]' : 'text-slate-300 border-transparent hover:text-slate-600'}`}
                >
                  {tab === 'control' ? (window.innerWidth < 640 ? 'Reg.' : 'Registro') : (window.innerWidth < 640 ? 'Dash.' : 'Análisis')}
                </button>
              ))}
            </div>
          </div>
          
          {/* MEJORA: Búsqueda siempre visible en móvil con ancho adaptativo */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={13} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-9 pr-3 py-1.5 bg-[#F1F5F9] border-none rounded-full text-[10px] md:text-[11px] font-medium w-24 sm:w-48 md:w-60 outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 transition-all" 
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8FAFC]">
          {activeTab === 'control' ? (
            <div className="space-y-3 max-w-6xl mx-auto">
              <div className="flex justify-between items-center px-2">
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidades: {processedHouses.length}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Ver:</span>
                  <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="bg-white border border-slate-200 text-[10px] font-bold rounded-lg px-2 py-1 outline-none cursor-pointer">
                    {[10, 25, 50, 114].map(n => <option key={n} value={n}>{n === 114 ? 'Todas' : n}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-[1rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-semibold uppercase tracking-widest border-b border-slate-100">
                        <SortableHeader label="Etapa" sortKey="etapa" sortConfig={sortConfig} onClick={requestSort} />
                        <SortableHeader label="Casa" sortKey="numero" sortConfig={sortConfig} onClick={requestSort} />
                        <SortableHeader label="Fachada" sortKey="doc_fachada" sortConfig={sortConfig} onClick={requestSort} />
                        <SortableHeader label="Predial" sortKey="doc_predial" sortConfig={sortConfig} onClick={requestSort} />
                        <SortableHeader label="Gravamen" sortKey="doc_gravamen" sortConfig={sortConfig} onClick={requestSort} />
                        <th className="py-3 px-5 text-center font-bold text-slate-400">Estado Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm font-normal">
                      {paginatedHouses.map(h => {
                        const status = (h.doc_fachada === 'OK' && h.doc_predial === 'OK' && h.doc_gravamen === 'OK') ? 'COMPLETO' : 'PENDIENTE';
                        return (
                          <tr key={h.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-2.5 px-5 whitespace-nowrap">
                                <span className="bg-blue-50/60 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-tight">Etapa {h.etapa}</span>
                            </td>
                            <td className="py-2.5 px-5 font-medium text-slate-700 text-sm tracking-tight">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-blue-50 rounded-md text-[#4F67EE] shrink-0 border border-blue-100/50">
                                        <Home size={13} />
                                    </div>
                                    #{h.numero}
                                </div>
                            </td>
                            <td className="py-2.5 px-5"><StatusChip status={h.doc_fachada} /></td>
                            <td className="py-2.5 px-5"><StatusChip status={h.doc_predial} /></td>
                            <td className="py-2.5 px-5"><StatusChip status={h.doc_gravamen} /></td>
                            <td className="py-2.5 px-5 text-center"><StatusChipFinal status={status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {processedHouses.length === 0 && <div className="p-16 text-center text-slate-400 text-sm italic">Sin resultados.</div>}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:text-[#4F67EE] transition-colors"><ChevronLeft size={16} /></button>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Página {currentPage} de {totalPages}</span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 disabled:opacity-30 hover:text-[#4F67EE] transition-colors"><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-700 pb-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <KPICard title="Unidades Filtradas" value={stats.total} icon={<Users className="text-blue-500" size={18} />} />
                <KPICard title="Expedientes OK" value={stats.completas} icon={<CheckCircle className="text-emerald-500" size={18} />} />
                <KPICard title="Avance de Vista" value={`${stats.avance}%`} icon={<BarChart3 className="text-purple-500" size={18} />} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 md:p-8 rounded-[1.25rem] border border-slate-100 shadow-sm">
                  <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2"><BarChart3 size={14} /> Avance por Etapa</h4>
                  <div className="space-y-5">
                    {stats.stageData.map(s => (
                      <div key={s.stage} className="space-y-2 group">
                        <div className="flex justify-between text-[10px] font-medium uppercase tracking-tight">
                          <span className="text-slate-500">Etapa {s.stage}</span>
                          <span className="text-[#4F67EE] font-bold">{s.comp} / {s.total} <span className="text-slate-300 font-normal ml-1">listos</span></span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden flex border border-slate-100/50">
                          <div className="h-full bg-[#4F67EE] rounded-full transition-all duration-1000 ease-out shadow-sm shadow-blue-200" style={{ width: `${s.total > 0 ? (s.comp/s.total)*100 : 0}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[1.25rem] border border-slate-100 shadow-sm flex flex-col items-center">
                  <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-6 self-start">Resumen Global</h4>
                  <div className="relative w-32 h-32 md:w-40 md:h-40 mb-6 hover:scale-105 transition-transform duration-300">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="50%" cy="50%" r="42%" stroke="#F8FAFC" strokeWidth="12" fill="transparent" />
                      <circle cx="50%" cy="50%" r="42%" stroke="#10b981" strokeWidth="12" fill="transparent" strokeDasharray="264" strokeDashoffset={264 * (1 - stats.avance / 100)} strokeLinecap="round" className="transition-all duration-1000 ease-in-out" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tighter leading-none">{stats.avance}%</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avance</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 text-[9px] font-medium uppercase tracking-widest">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> <span className="text-slate-600">Listos</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-100"></div> <span className="text-slate-400">Pendientes</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 md:p-8 rounded-[1.25rem] border border-slate-100 shadow-sm">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-widest mb-8 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-500" /> Documentos Faltantes (Cuello de Botella)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <DocStatItem label="Fachada Frontal" count={stats.docStats.fachada} total={stats.total} color="bg-rose-500" icon={<Home size={14} className="text-rose-500" />} />
                  <DocStatItem label="Impuesto Predial" count={stats.docStats.predial} total={stats.total} color="bg-orange-500" icon={<CheckCircle size={14} className="text-orange-500" />} />
                  <DocStatItem label="Cert. Gravamen" count={stats.docStats.gravamen} total={stats.total} color="bg-amber-500" icon={<Hourglass size={14} className="text-amber-500" />} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// --- COMPONENTES AUXILIARES ---

const SortableHeader = ({ label, sortKey, sortConfig, onClick }) => {
  const isActive = sortConfig.key === sortKey;
  return (
    <th 
      className="py-3 px-5 font-bold cursor-pointer group hover:bg-slate-100 transition-colors select-none"
      onClick={() => onClick(sortKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <div className="text-slate-300 group-hover:text-slate-500 transition-colors">
          {!isActive ? <ArrowUpDown size={11} /> : sortConfig.direction === 'asc' ? <ArrowUp size={11} className="text-[#4F67EE]" /> : <ArrowDown size={11} className="text-[#4F67EE]" />}
        </div>
      </div>
    </th>
  );
};

const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="space-y-1">
    <label className="text-[11px] font-medium text-slate-500 ml-1">{label}</label>
    <div className="relative">
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className="w-full bg-[#F1F5F9] border-none p-2 rounded-xl text-xs outline-none focus:ring-2 ring-blue-500/10 transition-all cursor-pointer appearance-none text-slate-700 font-medium"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt.includes('Ver') ? opt : opt === 'Todas' || opt === 'Todos' ? `Ver ${opt}` : opt}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

const StatusChip = ({ status }) => {
  const base = "px-2 py-1 rounded-xl border text-[9px] font-normal uppercase tracking-tight flex items-center gap-1.5 w-fit transition-all shadow-sm whitespace-nowrap";
  if (status === 'OK') return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}><CheckCircle size={11} /> {status}</span>;
  if (status === 'Revisión') return <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}><Clock size={11} /> {status}</span>;
  return <span className={`${base} bg-rose-50 text-rose-700 border-rose-200`}><AlertCircle size={11} /> {status}</span>;
};

const StatusChipFinal = ({ status }) => {
  const isComplete = status === 'COMPLETO';
  const base = "px-4 py-1.5 rounded-2xl text-[9px] font-medium uppercase tracking-widest border flex items-center gap-2 justify-center mx-auto w-fit shadow-sm transition-all whitespace-nowrap";
  if (isComplete) return <span className={`${base} bg-emerald-500 text-white border-emerald-600 shadow-emerald-100`}><CheckCircle size={13} /> Listo</span>;
  return <span className={`${base} bg-rose-50 text-rose-700 border-rose-200`}><Hourglass size={13} /> Pendiente</span>;
};

const KPICard = ({ title, value, icon }) => (
  <div className="bg-white p-4 rounded-[1rem] border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:translate-y-[-2px] group">
    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-white shadow-inner group-hover:bg-white transition-colors shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[8px] md:text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
      <p className="text-xl md:text-2xl font-bold text-slate-800 tracking-tighter leading-none">{value}</p>
    </div>
  </div>
);

const DocStatItem = ({ label, count, total, color, icon }) => {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
              {icon}
              <p className="text-[10px] font-semibold text-slate-400 uppercase">{label}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800 tracking-tight">{count} <span className="text-sm font-medium text-slate-400">faltan</span></p>
        </div>
        <span className="text-[11px] font-bold text-slate-300">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
        <div className={`${color} h-full transition-all duration-1000 ease-in-out`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

export default App;