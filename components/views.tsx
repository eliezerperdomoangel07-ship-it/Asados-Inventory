import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Sun, Moon, UserCheck, Shield, HardHat, Crown, Ban, Calendar as CalendarIcon, Search, Plus, Minus, Trash2, Bot, Bell, ArrowDown, ArrowUp, ShoppingCart, AlertTriangle, Info, Clock, Box, Drumstick, X, Wand2, ChevronLeft, ChevronRight, ClipboardList, Utensils, GlassWater, Pizza, IceCream, Building2, Wrench, Users, FileText, Upload, Check, Send, PlusCircle, ChevronsUpDown, PackagePlus, Leaf, Wine, Contact, Printer, Menu, Copy, AlertCircle, RotateCcw, BarChart as BarChartIcon, Scaling, ChefHat, Palette, ShieldCheck, Lock, Unlock } from 'lucide-react';
import { Product, Requisition, RequisitionItem, Invoice, InvoiceItem, Movement, Provider, NotificationType, ViewType, GeminiAction, Production, ProductionOutput, AppSettings, AppPermissions, UserRole } from '../types';
import { UNIT_OPTIONS, DESTINATION_OPTIONS, REQUISITION_DEPARTMENTS, CATEGORIES } from '../constants';
import { Header, ActionConfirmationCard, LowAndOutOfStockModal, StockStatusModal, AllProductsModal } from './ui';
import { Timestamp, auth } from '../services/firebaseService';
import { generateShoppingRecommendation, getChatbotResponse } from '../services/geminiService';


// --- AddProductForm Component ---
interface AddProductFormProps {
    onAddProduct: (product: Omit<Product, 'id' | 'history' | 'createdAt'>) => void;
    onDone: () => void;
    category: string;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}
const AddProductForm: React.FC<AddProductFormProps> = ({ onAddProduct, onDone, category: initialCategory, showNotification }) => {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('unidades');
    const [customUnit, setCustomUnit] = useState('');
    const [minStock, setMinStock] = useState('5');
    const [category, setCategory] = useState(initialCategory);
    
    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setUnit(value);
        if (value !== 'otro') {
            setCustomUnit('');
        }
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*\.?\d*$/.test(value)) {
            setQuantity(value);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalUnit = unit === 'otro' ? customUnit.trim() : unit;
        if (!name || !quantity || !finalUnit) {
            showNotification('Por favor, completa todos los campos requeridos.', 'error');
            return;
        }
        onAddProduct({ name, quantity: parseFloat(quantity), unit: finalUnit, minStock: parseFloat(minStock), category });
        setName(''); setQuantity(''); setUnit('unidades'); setMinStock('5'); setCustomUnit('');
        onDone();
    };
    
    return (
        <div className="glass-panel p-4 rounded-lg my-4 animate-fadeIn">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 lg:col-span-1">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Nombre del Producto</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-bg-secondary text-text-primary p-2 rounded-md border border-[var(--color-border)]" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Categoría</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-bg-secondary text-text-primary p-2 rounded-md border border-[var(--color-border)]">
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Cantidad Inicial</label>
                    <input type="text" inputMode="decimal" value={quantity} onChange={handleQuantityChange} className="w-full bg-bg-secondary text-text-primary p-2 rounded-md border border-[var(--color-border)]" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Unidad</label>
                     <select value={unit} onChange={handleUnitChange} className="w-full bg-bg-secondary text-text-primary p-2 rounded-md border border-[var(--color-border)]">
                        {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        <option value="otro">Otro...</option>
                    </select>
                </div>
                {unit === 'otro' && (
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Unidad Personalizada</label>
                        <input type="text" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className="w-full bg-bg-secondary text-text-primary p-2 rounded-md border border-[var(--color-border)]" required />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Stock Mínimo</label>
                    <input type="text" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full bg-bg-secondary text-text-primary p-2 rounded-md border border-[var(--color-border)]" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-transform active:scale-95">Guardar Producto</button>
                </div>
            </form>
        </div>
    );
};

// --- ProductItem Component ---
interface ProductItemProps {
    product: Product;
    onUpdateQuantity: (id: string, amount: number, unit: string, destination: string) => void;
    onDeleteProduct: (id: string, name: string) => void;
    onShowOutputModal: (product: Product) => void;
    permissions: AppPermissions;
}
const ProductItem: React.FC<ProductItemProps> = ({ product, onUpdateQuantity, onDeleteProduct, onShowOutputModal, permissions }) => {
    const { canDeleteProducts, canManuallyAdjustStock } = permissions;
    
    const stockPercentage = Math.min((product.quantity / (product.minStock * 2)) * 100, 100);
    const isCritical = product.quantity > 0 && product.quantity <= product.minStock / 2;
    const isLowStock = product.quantity > 0 && product.quantity <= product.minStock;
    const isOutOfStock = product.quantity === 0;

    let progressBarColor = 'bg-green-500';
    if (isLowStock) progressBarColor = 'bg-yellow-500';
    if (isCritical) progressBarColor = 'bg-orange-500';
    if (isOutOfStock) progressBarColor = 'bg-red-500';
    
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const handleMouseUp = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const handleMouseDown = (amount: number) => {
        if (amount < 0) {
            onShowOutputModal(product);
        } else {
            onUpdateQuantity(product.id, amount, product.unit, 'ajuste_manual_entrada');
            timeoutRef.current = window.setTimeout(() => {
                intervalRef.current = window.setInterval(() => {
                    onUpdateQuantity(product.id, amount, product.unit, 'ajuste_manual_entrada');
                }, 100); 
            }, 500);
        }
    };

    useEffect(() => {
        return () => handleMouseUp();
    }, []);

    return (
        <tr className="border-b border-[var(--color-border)] hover:bg-bg-tertiary transition-transform duration-200 hover:scale-[1.02]">
            <td className="p-3 font-medium">
                <div className="flex items-center">
                    {product.name}
                    {isLowStock && <AlertTriangle className="ml-2 text-yellow-500" size={16} />}
                     {isOutOfStock && <AlertTriangle className="ml-2 text-red-500" size={16} />}
                </div>
                <p className="text-xs text-text-secondary">Mínimo: {product.minStock} {product.unit}</p>
            </td>
            <td className="p-3 align-middle" style={{minWidth: '150px'}}>
                <div className="flex items-center justify-start gap-2">
                    <span className={`font-mono text-lg font-bold ${isLowStock ? 'text-yellow-400' : 'text-text-primary'} ${isOutOfStock ? 'text-red-500' : ''}`}>
                        {product.quantity}
                    </span>
                    <span className="text-sm text-text-secondary">{product.unit}</span>
                </div>
                <div className="w-full bg-bg-primary rounded-full h-1.5 mt-1 overflow-hidden">
                    <div className={`${progressBarColor} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${stockPercentage}%` }}></div>
                </div>
            </td>
            <td className="p-3">
                <div className="flex justify-center items-center gap-2">
                    <button 
                        onMouseDown={() => handleMouseDown(-1)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        className="bg-red-600 p-2 rounded-full hover:bg-red-700 select-none transition-transform active:scale-90 text-white">
                        <Minus size={16} />
                    </button>
                    <button 
                        onMouseDown={() => handleMouseDown(1)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        disabled={!canManuallyAdjustStock}
                        title={canManuallyAdjustStock ? "Ajuste manual de entrada" : "Permiso de ajuste manual denegado"}
                        className="bg-green-600 p-2 rounded-full hover:bg-green-700 select-none transition-transform active:scale-90 text-white disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {canManuallyAdjustStock ? <Plus size={16} /> : <Lock size={16}/>}
                    </button>
                </div>
            </td>
            <td className="p-3 text-center">
                <button 
                    onClick={() => onDeleteProduct(product.id, product.name)} 
                    disabled={!canDeleteProducts}
                    className="text-text-secondary hover:text-red-500 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                    title={canDeleteProducts ? "Eliminar producto" : "Permiso para eliminar denegado"}
                >
                    {canDeleteProducts ? <Trash2 size={20} /> : <Lock size={20} />}
                </button>
            </td>
        </tr>
    );
};

// --- RecentMovements Component ---
interface RecentMovementsProps {
    products: Product[];
    category: string;
    onMovementClick: (movement: Movement) => void;
}
const RecentMovements: React.FC<RecentMovementsProps> = ({ products, category, onMovementClick }) => {
    const recentMovements = useMemo(() => {
        return products
            .filter(p => p.category === category)
            .flatMap(p => (p.history || []).map(h => ({ ...h, productName: p.name, productId: p.id })))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 15);
    }, [products, category]);

    return (
        <div className="glass-panel p-6 rounded-2xl mt-8">
            <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Movimientos Recientes en {category}</h3>
            <ul className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentMovements.length > 0 ? recentMovements.map((m, i) => (
                    <li 
                        key={`${m.date}-${i}`}
                        onClick={() => !m.cancelled && onMovementClick(m)}
                        className={`flex justify-between items-center p-2 bg-bg-primary rounded-md animate-fadeIn ${m.cancelled ? 'opacity-50' : 'cursor-pointer hover:bg-bg-tertiary'}`}
                    >
                        <div>
                            <p className="font-medium">
                                {m.productName}{' '}
                                {m.destination && !['salida_manual', 'ajuste_manual_entrada'].includes(m.destination) && (
                                    <span className="text-xs text-[var(--color-primary)]">({m.destination})</span>
                                )}
                            </p>
                            <p className="text-xs text-text-secondary">{new Date(m.date).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                        </div>
                        <div className="text-right">
                             <div className={`font-bold ${m.type === 'entrada' ? 'text-green-500' : 'text-red-500'}`}>
                                {m.type === 'entrada' ? '+' : '-'}{Math.abs(m.amount)} <span className="text-xs text-text-secondary">({m.unit})</span>
                            </div>
                            {m.cancelled && <span className="text-xs text-red-500 font-bold">(Anulado)</span>}
                        </div>
                    </li>
                )) : <p className="text-text-secondary text-center py-8">No hay movimientos recientes en esta categoría.</p>}
            </ul>
        </div>
    );
};


// --- Views ---

interface CommonViewProps {
    products: Product[];
    onUpdateQuantity: (id: string, amount: number, unit: string, destination: string) => Promise<void>;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
    onMovementClick: (movement: Movement) => void;
    permissions: AppPermissions;
}

export const DashboardView: React.FC<CommonViewProps & { setView: (view: ViewType) => void; requisitions: Requisition[]; }> = ({ products, setView, requisitions, onUpdateQuantity, showNotification, onMovementClick, permissions }) => {
    const [showLowStockModal, setShowLowStockModal] = useState(false);
    const [showAllProductsModal, setShowAllProductsModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [transactionUnit, setTransactionUnit] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [showDestinationSelector, setShowDestinationSelector] = useState(false);
    const [destination, setDestination] = useState(DESTINATION_OPTIONS[0]);

    const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;
    const pendingRequisitionsCount = requisitions.filter(r => r.status === 'pending').length;

    const recentMovements = useMemo(() => {
        return products
            .flatMap(p => (p.history || []).map(h => ({ ...h, productName: p.name, productId: p.id })))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);
    }, [products]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term) {
            setSearchResults(
                products.filter(p => p.name.toLowerCase().includes(term.toLowerCase())).slice(0, 5)
            );
        } else {
            setSearchResults([]);
            setSelectedProduct(null);
        }
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setTransactionUnit(product.unit);
        setSearchTerm(product.name);
        setSearchResults([]);
    };

    const resetForm = () => {
        setSearchTerm('');
        setSelectedProduct(null);
        setQuantity('1');
        setShowDestinationSelector(false);
        setDestination(DESTINATION_OPTIONS[0]);
        setTransactionUnit('');
    };
    
    const handleQuickUpdate = async (amount: number) => {
        if (!selectedProduct) {
            showNotification("Por favor, selecciona un producto.", "error");
            return;
        }
        const parsedQuantity = parseFloat(quantity);
        if (!parsedQuantity || parsedQuantity <= 0) {
            showNotification("Por favor, especifica una cantidad válida.", "error");
            return;
        }

        if (amount > 0) {
            if (!permissions.canManuallyAdjustStock) {
                showNotification("No tienes permiso para realizar ajustes manuales de entrada.", "error");
                return;
            }
            await onUpdateQuantity(selectedProduct.id, parsedQuantity, transactionUnit, 'ajuste_manual_entrada');
            resetForm();
        } else {
            setShowDestinationSelector(true);
        }
    };

    const handleConfirmOutput = async () => {
        if (!selectedProduct) return;
        const parsedQuantity = parseFloat(quantity);
        if (!parsedQuantity || parsedQuantity <= 0) {
            showNotification("Por favor, especifica una cantidad válida.", "error");
            return;
        }
        const finalDestination = destination === 'Nada' ? 'salida_manual' : destination;
        await onUpdateQuantity(selectedProduct.id, -1 * parsedQuantity, transactionUnit, finalDestination);
        resetForm();
    };
    
    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*\.?\d*$/.test(value)) {
            setQuantity(value);
        }
    };

    return (
        <div>
            <Header title="Inicio Rápido" subtitle="Un vistazo general a tu inventario y acciones rápidas." />
            <LowAndOutOfStockModal show={showLowStockModal} onClose={() => setShowLowStockModal(false)} products={products} />
            <AllProductsModal show={showAllProductsModal} onClose={() => setShowAllProductsModal(false)} products={products} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                 <div onClick={() => setShowAllProductsModal(true)} className="glass-panel p-6 rounded-2xl flex items-center justify-between text-left cursor-pointer relative overflow-hidden card-3d">
                    <div>
                        <p className="text-text-secondary text-sm">Productos Totales</p>
                        <p className="text-3xl font-bold">{products.length}</p>
                    </div>
                    <ShoppingCart className="text-[var(--color-primary)]" size={32} />
                    <ShoppingCart className="absolute -right-4 -bottom-4 text-[var(--color-primary)] opacity-10" size={100} />
                </div>
                <div onClick={() => setShowLowStockModal(true)} className="glass-panel p-6 rounded-2xl flex items-center justify-between text-left cursor-pointer relative overflow-hidden card-3d" style={lowStockCount > 0 ? {'--tw-shadow-color': 'hsl(0, 80%, 60%)', boxShadow: '0 0 20px -5px var(--tw-shadow-color)'} as React.CSSProperties : {}}>
                    <div>
                        <p className="text-text-secondary text-sm">Alertas de Stock General</p>
                        <p className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{lowStockCount}</p>
                    </div>
                    <Bell className={lowStockCount > 0 ? 'text-red-500' : 'text-green-500'} size={32} />
                    <Bell className="absolute -right-4 -bottom-4 text-red-500 opacity-10" size={100} />
                </div>
                <div onClick={() => setView('requisitions')} className="glass-panel p-6 rounded-2xl flex items-center justify-between text-left cursor-pointer relative overflow-hidden card-3d">
                    <div>
                        <p className="text-text-secondary text-sm">Requisiciones Pendientes</p>
                        <p className={`text-3xl font-bold ${pendingRequisitionsCount > 0 ? 'text-[var(--color-primary)]' : 'text-green-500'}`}>{pendingRequisitionsCount}</p>
                    </div>
                    <ClipboardList className={pendingRequisitionsCount > 0 ? 'text-[var(--color-primary)]' : 'text-green-500'} size={32} />
                     <ClipboardList className="absolute -right-4 -bottom-4 text-[var(--color-primary)] opacity-10" size={100} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Ajuste Rápido de Stock</h3>
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-text-secondary mb-1">Buscar Producto</label>
                            <input type="text" value={searchTerm} onChange={handleSearchChange} placeholder="Escribe para buscar..." className="bg-bg-primary w-full pr-4 pl-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" disabled={showDestinationSelector} />
                            {searchResults.length > 0 && (
                                <ul className="absolute z-10 w-full bg-bg-tertiary border border-[var(--color-border)] rounded-lg mt-1 max-h-60 overflow-y-auto">
                                    {searchResults.map(p => (
                                        <li key={p.id} onClick={() => handleSelectProduct(p)} className="px-4 py-2 hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-text-on-brand)] cursor-pointer">{p.name}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-text-secondary mb-1">Cantidad</label>
                           <div className="flex items-center gap-2">
                                <input type="text" inputMode="decimal" value={quantity} onChange={handleQuantityChange} className="bg-bg-primary w-full pr-4 pl-4 py-2 rounded-lg border border-[var(--color-border)]" disabled={showDestinationSelector} />
                                <select value={transactionUnit} onChange={(e) => setTransactionUnit(e.target.value)} className="bg-bg-primary py-2 px-4 rounded-lg border border-[var(--color-border)] text-text-primary" disabled={!selectedProduct || showDestinationSelector}>
                                    <option value="" disabled>Unidad</option>
                                    {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    {selectedProduct && !UNIT_OPTIONS.includes(selectedProduct.unit) && <option value={selectedProduct.unit}>{selectedProduct.unit}</option>}
                                </select>
                           </div>
                        </div>
                        
                        {!showDestinationSelector ? (
                            <div className="flex gap-4">
                                <button onClick={() => handleQuickUpdate(1)} disabled={!selectedProduct || !permissions.canManuallyAdjustStock} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed">
                                    <ArrowUp size={18} /> Entrada
                                </button>
                                <button onClick={() => handleQuickUpdate(-1)} disabled={!selectedProduct} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed">
                                    <ArrowDown size={18} /> Salida
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 bg-bg-primary rounded-lg animate-fadeIn">
                                <h4 className="text-lg font-semibold text-[var(--color-primary)] mb-3">Seleccionar Destino de Salida</h4>
                                <select value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-bg-secondary p-2 rounded-md border border-[var(--color-border)] mb-4">
                                    {DESTINATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <div className="flex gap-4">
                                    <button onClick={handleConfirmOutput} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700">Confirmar Salida</button>
                                    <button onClick={resetForm} className="w-full bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700">Cancelar</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Movimientos Recientes</h3>
                    <ul className="space-y-3 max-h-[300px] overflow-y-auto">
                        {recentMovements.length > 0 ? recentMovements.map((m, i) => (
                            <li 
                                key={`${m.date}-${i}`}
                                onClick={() => !m.cancelled && onMovementClick(m)}
                                className={`flex justify-between items-center p-2 bg-bg-primary rounded-md ${m.cancelled ? 'opacity-50' : 'cursor-pointer hover:bg-bg-tertiary'}`}
                            >
                                <div>
                                    <p className="font-medium">
                                        {m.productName}{' '}
                                        {m.destination && !['salida_manual', 'ajuste_manual_entrada'].includes(m.destination) && (
                                            <span className="text-xs text-[var(--color-primary)]">({m.destination})</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-text-secondary">{new Date(m.date).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${m.type === 'entrada' ? 'text-green-500' : 'text-red-500'}`}>
                                        {m.type === 'entrada' ? '+' : '-'}{Math.abs(m.amount)} <span className="text-xs text-text-secondary">({m.unit})</span>
                                    </div>
                                    {m.cancelled && <span className="text-xs text-red-500 font-bold">(Anulado)</span>}
                                </div>
                            </li>
                        )) : <p className="text-text-secondary text-center py-8">No hay movimientos recientes.</p>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export const CategoryView: React.FC<CommonViewProps & { 
    category: string; 
    onDeleteProduct: (id: string, name: string) => void; 
    onAddProduct: (product: Omit<Product, 'id' | 'history' | 'createdAt'>) => void; 
}> = ({ products, category, onUpdateQuantity, onDeleteProduct, onAddProduct, showNotification, onMovementClick, permissions }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStockModal, setShowLowStockModal] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    
    const [outputModalState, setOutputModalState] = useState<{ show: boolean; product: Product | null }>({ show: false, product: null });

    const handleShowOutputModal = (product: Product) => {
        setOutputModalState({ show: true, product });
    };

    const handleConfirmOutput = (productId: string, amount: number, unit: string, destination: string) => {
        const finalDestination = destination === 'Nada' ? 'salida_manual' : destination;
        onUpdateQuantity(productId, -amount, unit, finalDestination);
        setOutputModalState({ show: false, product: null });
    };

    const filteredProducts = products.filter(p => p.category === category);
    const searchedProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const lowStockCount = filteredProducts.filter(p => p.quantity <= p.minStock).length;

    return (
        <div>
            <Header title={category} subtitle={`Gestiona los productos de ${category.toLowerCase()}`} />
            <LowAndOutOfStockModal show={showLowStockModal} onClose={() => setShowLowStockModal(false)} products={filteredProducts} category={category} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-text-secondary text-sm">Productos en {category}</p>
                        <p className="text-2xl font-bold">{filteredProducts.length}</p>
                    </div>
                    <ShoppingCart className="text-[var(--color-primary)]" size={28} />
                </div>
                <button onClick={() => setShowLowStockModal(true)} className="glass-panel p-4 rounded-2xl flex items-center justify-between text-left">
                    <div>
                        <p className="text-text-secondary text-sm">Alertas de Stock</p>
                        <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{lowStockCount}</p>
                    </div>
                    <Bell className={lowStockCount > 0 ? 'text-red-500' : 'text-green-500'} size={28} />
                </button>
            </div>

            <div className="glass-panel p-4 rounded-2xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-bg-primary w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                        />
                    </div>
                     <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-4 rounded-lg hover:bg-[var(--color-primary-hover)] transition-all duration-200 w-full md:w-auto flex items-center gap-2 active:scale-95"
                    >
                        <PlusCircle size={18} /> {showAddForm ? 'Cerrar Formulario' : 'Añadir Producto'}
                    </button>
                </div>
                {showAddForm && <AddProductForm onAddProduct={onAddProduct} onDone={() => setShowAddForm(false)} category={category} showNotification={showNotification} />}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="p-3">Producto</th>
                                <th className="p-3 text-left">Stock Actual</th>
                                <th className="p-3 text-center">Ajuste Rápido</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchedProducts.map(product => (
                                <ProductItem
                                    key={product.id}
                                    product={product}
                                    onUpdateQuantity={onUpdateQuantity}
                                    onDeleteProduct={onDeleteProduct}
                                    onShowOutputModal={handleShowOutputModal}
                                    permissions={permissions}
                                />
                            ))}
                        </tbody>
                    </table>
                     {searchedProducts.length === 0 && <p className="text-center text-text-secondary py-8">No hay productos que coincidan con la búsqueda.</p>}
                </div>
            </div>
            <RecentMovements products={products} category={category} onMovementClick={onMovementClick} />
        </div>
    );
};

// --- Requisitions Components ---
interface RequisitionCardProps {
    requisition: Requisition;
    onProcess: (requisitionId: string, processedItems: any) => void;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
    canProcess: boolean;
}
const RequisitionCard: React.FC<RequisitionCardProps> = ({ requisition, onProcess, showNotification, canProcess }) => {
    const [processedItems, setProcessedItems] = useState<{ [key: string]: { deliveredQuantity: string, observation: string } }>({});

    useEffect(() => {
        const initialItems: { [key: string]: { deliveredQuantity: string, observation: string } } = {};
        requisition.items.forEach(item => {
            initialItems[item.productId] = {
                deliveredQuantity: '',
                observation: ''
            };
        });
        setProcessedItems(initialItems);
    }, [requisition]);

    const handleItemChange = (itemId: string, field: 'deliveredQuantity' | 'observation', value: string) => {
        setProcessedItems(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], [field]: value }
        }));
    };

    const handleSubmit = () => {
        for (const item of requisition.items) {
            const deliveredQty = processedItems[item.productId]?.deliveredQuantity;
            if (deliveredQty === undefined || deliveredQty === '' || Number(deliveredQty) < 0) {
                showNotification(`Por favor, ingresa una cantidad válida (0 o más) para ${item.productName}.`, 'error');
                return;
            }
        }
        onProcess(requisition.id, processedItems);
    };
    
    const getDepartmentIcon = (department: string) => {
        switch(department) {
            case 'Cocina': return <Drumstick className="text-[var(--color-primary)]"/>;
            case 'Barra': return <GlassWater className="text-blue-400"/>;
            case 'Pizzería': return <Pizza className="text-orange-400"/>;
            case 'Heladería': return <IceCream className="text-pink-400"/>;
            case 'Licores': return <Wine className="text-purple-400"/>;
            case 'Sushi': return <Utensils className="text-red-400"/>;
            case 'Mantenimiento': return <Wrench className="text-gray-400"/>;
            case 'Meseros': return <Users className="text-teal-400"/>;
            default: return <Building2 />;
        }
    };

    return (
        <div className="glass-panel p-4 rounded-2xl relative animate-fadeIn">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-[var(--color-primary)] rounded-l-2xl"></div>
            <div className="pl-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        {getDepartmentIcon(requisition.department)}
                        <h3 className="text-xl font-bold">{requisition.department}</h3>
                    </div>
                    <span className="text-sm text-text-secondary">
                        {requisition.createdAt?.toDate().toLocaleDateString('es-VE')}
                    </span>
                </div>

                <div className="space-y-3">
                    {requisition.items.map(item => {
                        const isCompleted = requisition.status === 'completed';
                        const notFullyDelivered = isCompleted && item.deliveredQuantity! < item.requestedQuantity;
                        
                        return (
                            <div key={item.productId} className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-bg-primary rounded-md items-center ${notFullyDelivered ? 'border border-red-500' : ''}`}>
                                <div>
                                    <p className="font-semibold">{item.productName}</p>
                                    <p className="text-sm text-text-secondary">Solicitado: {item.requestedQuantity} {item.unit}</p>
                                </div>
                                {isCompleted ? (
                                    <>
                                        <div>
                                            <p className={`text-sm ${notFullyDelivered ? 'text-red-400' : 'text-text-primary'}`}>
                                                Entregado: <span className="font-bold">{item.deliveredQuantity} {item.unit}</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-text-secondary italic">{item.observation || 'Sin observaciones'}</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="number"
                                            placeholder="Cant. Entregada"
                                            value={processedItems[item.productId]?.deliveredQuantity ?? ''}
                                            onChange={(e) => handleItemChange(item.productId, 'deliveredQuantity', e.target.value)}
                                            className="bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Observación (opcional)"
                                            value={processedItems[item.productId]?.observation ?? ''}
                                            onChange={(e) => handleItemChange(item.productId, 'observation', e.target.value)}
                                            className="bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]"
                                        />
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {requisition.status === 'pending' && (
                    <div className="mt-4 flex justify-end">
                        <button 
                            onClick={handleSubmit} 
                            disabled={!canProcess}
                            className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-transform active:scale-95 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            title={canProcess ? "Procesar requisición" : "Permiso para procesar denegado"}
                        >
                            {canProcess ? 'Procesar Requisición' : <Lock size={18}/>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface CreateRequisitionModalProps {
    onClose: () => void;
    products: Product[];
    onCreate: (data: any) => void;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}
const CreateRequisitionModal: React.FC<CreateRequisitionModalProps> = ({ onClose, products, onCreate, showNotification }) => {
    const [department, setDepartment] = useState('Cocina');
    const [items, setItems] = useState<Omit<RequisitionItem, 'productId' | 'deliveredQuantity' | 'observation'>[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term) {
            setSearchResults(
                products.filter(p => 
                    p.name.toLowerCase().includes(term.toLowerCase()) &&
                    !items.some(i => i.productName === p.name)
                ).slice(0, 5)
            );
        } else {
            setSearchResults([]);
        }
    };

    const handleAddItem = (product: Product) => {
        setItems([...items, { productName: product.name, requestedQuantity: 1, unit: product.unit }]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleItemChange = (index: number, field: 'requestedQuantity' | 'unit', value: string | number) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };
    
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        if (!department) {
            showNotification('Por favor, selecciona un departamento.', 'error');
            return;
        }
        if (items.length === 0) {
            showNotification('Añade al menos un producto a la requisición.', 'error');
            return;
        }
        onCreate({ department, items });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="glass-panel rounded-lg p-6 w-full max-w-2xl animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)]">Crear Requisición Manual</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Departamento</label>
                        <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]">
                            {REQUISITION_DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {items.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-bg-primary rounded-md">
                                <span className="flex-grow font-semibold">{item.productName}</span>
                                <input 
                                    type="number" 
                                    value={item.requestedQuantity}
                                    onChange={e => handleItemChange(index, 'requestedQuantity', Number(e.target.value))}
                                    className="w-20 bg-bg-secondary p-1 rounded-md text-center"
                                />
                                <select 
                                    value={item.unit} 
                                    onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                    className="bg-bg-secondary p-1 rounded-md"
                                >
                                    {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-400"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>

                    <div className="relative">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Añadir Producto</label>
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder="Buscar producto para añadir..."
                            className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]"
                        />
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-bg-tertiary border border-[var(--color-border)] rounded-lg mt-1 max-h-48 overflow-y-auto">
                                {searchResults.map(p => (
                                    <li key={p.id} onClick={() => handleAddItem(p)} className="px-4 py-2 hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-text-on-brand)] cursor-pointer">{p.name}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSubmit} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-transform active:scale-95">
                        Crear Requisición
                    </button>
                </div>
            </div>
        </div>
    );
};

export const RequisitionsView: React.FC<{
    products: Product[],
    requisitions: Requisition[],
    showNotification: (m: string, t: NotificationType['type']) => void,
    handleProcessRequisition: (id: string, items: any) => void,
    handleCreateRequisition: (data: any) => void,
    permissions: AppPermissions,
}> = ({ products, requisitions, showNotification, handleProcessRequisition, handleCreateRequisition, permissions }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('pending');

    const filteredRequisitions = requisitions
        .filter(r => r.status === filter)
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    return (
        <div>
            <Header title="Requisiciones" subtitle="Gestiona las solicitudes de los diferentes departamentos del restaurante.">
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-4 rounded-lg hover:bg-[var(--color-primary-hover)] flex items-center gap-2 transition-transform active:scale-95"
                >
                    <PlusCircle size={18} /> Crear Requisición Manual
                </button>
            </Header>

            {showCreateModal && (
                <CreateRequisitionModal 
                    onClose={() => setShowCreateModal(false)}
                    products={products}
                    onCreate={handleCreateRequisition}
                    showNotification={showNotification}
                />
            )}
            
            <div className="mb-6 flex gap-2 p-1 bg-bg-secondary rounded-lg w-full md:w-1/3">
                <button onClick={() => setFilter('pending')} className={`w-full p-2 rounded-md font-semibold transition-colors ${filter === 'pending' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)]' : 'hover:bg-bg-tertiary'}`}>Pendientes</button>
                <button onClick={() => setFilter('completed')} className={`w-full p-2 rounded-md font-semibold transition-colors ${filter === 'completed' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)]' : 'hover:bg-bg-tertiary'}`}>Completados</button>
            </div>

            <div className="space-y-6">
                {filteredRequisitions.length > 0 ? filteredRequisitions.map(req => (
                    <RequisitionCard 
                        key={req.id} 
                        requisition={req} 
                        onProcess={handleProcessRequisition}
                        showNotification={showNotification}
                        canProcess={permissions.canProcessRequisitions}
                    />
                )) : (
                    <div className="text-center py-16 glass-panel rounded-2xl">
                        <p className="text-text-secondary">No hay requisiciones en estado "{filter}".</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Invoices Components ---
interface InvoiceDetailModalProps {
    show: boolean;
    onClose: () => void;
    invoice: Invoice;
    onUpdateStatus: (id: string, status: 'paid' | 'pending') => void;
}
const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ show, onClose, invoice, onUpdateStatus }) => {
    if (!show) return null;

    const handleMarkAsPaid = () => {
        onUpdateStatus(invoice.id, 'paid');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="glass-panel rounded-lg p-6 w-full max-w-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b border-[var(--color-border)] pb-4">
                    <div>
                        <h3 className="text-2xl font-bold text-[var(--color-primary)]">Detalle de Factura</h3>
                        <p className="text-text-secondary">Proveedor: <span className="font-semibold text-text-primary">{invoice.provider}</span></p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <p className="text-sm text-text-secondary">Nº de Factura</p>
                        <p className="font-mono text-text-primary">{invoice.invoiceNumber}</p>
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Fecha</p>
                        <p className="text-text-primary">{invoice.date.toDate().toLocaleDateString('es-VE')}</p>
                    </div>
                    <div>
                        <p className="text-sm text-text-secondary">Estado</p>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${invoice.status === 'paid' ? 'bg-green-500 text-black' : 'bg-yellow-500 text-black'}`}>
                            {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                        </span>
                    </div>
                </div>

                <h4 className="text-lg font-semibold text-[var(--color-primary)] mt-6 mb-2">Items</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-4 border border-[var(--color-border)] rounded-lg p-2">
                    {(invoice.items || []).map((item, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2 p-2 bg-bg-primary rounded-md">
                            <span className="font-semibold">{item.productName}</span>
                            <span className="text-center">{item.quantity} {item.unit}</span>
                            <span className="text-right font-mono">${(item.price ? (item.quantity * item.price) : 0).toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                {invoice.source === 'whatsapp' && invoice.rawText && (
                    <div className="mt-6">
                        <h4 className="text-lg font-semibold text-[var(--color-primary)] mb-2">Texto Original (WhatsApp)</h4>
                        <p className="bg-bg-primary p-3 rounded-md text-text-secondary italic whitespace-pre-wrap">{invoice.rawText}</p>
                    </div>
                )}

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-[var(--color-border)]">
                    <div>
                        {invoice.status === 'pending' && (
                            <button 
                                onClick={handleMarkAsPaid}
                                className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-transform active:scale-95 flex items-center gap-2"
                            >
                                <Check size={18} /> Marcar como Pagada
                            </button>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-text-secondary">Monto Total</p>
                        <p className="text-3xl font-bold text-[var(--color-primary)]">${invoice.totalAmount.toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface CreateInvoiceModalProps {
    onClose: () => void;
    onCreate: (data: Omit<Invoice, 'id'>) => Promise<void>;
    showNotification: (m: string, t: NotificationType['type']) => void;
}
const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ onClose, onCreate, showNotification }) => {
    const [provider, setProvider] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<(Omit<InvoiceItem, 'price'> & {price: string})[]>([{ productName: '', quantity: 1, unit: 'unidades', price: '' }]);
    const [status, setStatus] = useState<'pending' | 'paid'>('pending');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleItemChange = (index: number, field: keyof (Omit<InvoiceItem, 'price'> & {price: string}), value: string) => {
        const newItems = [...items];
        const itemToUpdate = { ...newItems[index] };

        if (field === 'price' || field === 'quantity') {
            if (/^\d*\.?\d*$/.test(value)) {
                (itemToUpdate as any)[field] = value;
                newItems[index] = itemToUpdate;
                setItems(newItems);
            }
        } else {
            (itemToUpdate as any)[field] = value;
            newItems[index] = itemToUpdate;
            setItems(newItems);
        }
    };

    const handleAddItem = () => {
        setItems([...items, { productName: '', quantity: 1, unit: 'unidades', price: '' }]);
    };
    
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.price)), 0);
    }, [items]);

    const handleSubmit = async () => {
        if (!provider || !invoiceNumber || items.some(i => !i.productName || !i.price || Number(i.price) <= 0)) {
            showNotification('Completa todos los campos requeridos de la factura y los items (producto y precio).', 'error');
            return;
        }

        setIsSubmitting(true);
        
        try {
            await onCreate({
                provider,
                invoiceNumber,
                date: Timestamp.fromDate(new Date(date)),
                items: items.map(item => ({...item, price: Number(item.price), quantity: Number(item.quantity)})),
                totalAmount,
                status,
                source: 'manual',
            });
            onClose();
        } catch (error) {
            console.error("Error creating invoice:", error);
            showNotification('Error al guardar la factura.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="glass-panel rounded-lg p-6 w-full max-w-4xl animate-scaleIn max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)]">Crear Nueva Factura</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input type="text" placeholder="Proveedor" value={provider} onChange={e => setProvider(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]" />
                    <input type="text" placeholder="Número de Factura" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]" />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]" />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-4">
                    {items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-bg-primary rounded-md">
                            <input type="text" placeholder="Producto" value={item.productName} onChange={e => handleItemChange(index, 'productName', e.target.value)} className="col-span-5 bg-bg-secondary p-1 rounded-md" />
                            <input type="text" inputMode="decimal" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', String(e.target.value))} className="col-span-2 bg-bg-secondary p-1 rounded-md text-center" />
                            <select value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)} className="col-span-2 bg-bg-secondary p-1 rounded-md">
                                {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <div className="col-span-2 relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                                <input type="text" inputMode="decimal" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} className="bg-bg-secondary p-1 pl-5 rounded-md text-right w-full" />
                            </div>
                            <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-400 justify-self-center"><Trash2 size={18}/></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddItem} className="text-[var(--color-primary)] text-sm flex items-center gap-1 mb-4 hover:text-[var(--color-primary-hover)]"><PlusCircle size={16}/> Añadir Item</button>

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-[var(--color-border)]">
                    <div>
                        <label className="mr-2">Estado:</label>
                        <select value={status} onChange={e => setStatus(e.target.value as 'pending' | 'paid')} className="bg-bg-primary p-2 rounded-md border border-[var(--color-border)]">
                            <option value="pending">Pendiente</option>
                            <option value="paid">Pagada</option>
                        </select>
                    </div>
                    <div className="text-right">
                        <p className="text-text-secondary">Total</p>
                        <p className="text-2xl font-bold text-[var(--color-primary)]">${totalAmount.toFixed(2)}</p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-transform active:scale-95 disabled:bg-gray-500 disabled:cursor-wait">
                        {isSubmitting ? 'Guardando...' : 'Guardar Factura'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const InvoicesView: React.FC<{
    invoices: Invoice[];
    handleCreateInvoice: (data: Omit<Invoice, 'id'>) => Promise<void>;
    handleUpdateInvoiceStatus: (id: string, status: 'paid' | 'pending') => void;
    showNotification: (m: string, t: NotificationType['type']) => void;
}> = ({ invoices, handleCreateInvoice, handleUpdateInvoiceStatus, showNotification }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    return (
        <div>
            <Header title="Facturas" subtitle="Registra y consulta las facturas de tus proveedores.">
                 <button 
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-4 rounded-lg hover:bg-[var(--color-primary-hover)] flex items-center gap-2 transition-transform active:scale-95"
                >
                    <PlusCircle size={18} /> Crear Factura
                </button>
            </Header>
            {showCreateModal && <CreateInvoiceModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateInvoice} showNotification={showNotification} />}
            {selectedInvoice && <InvoiceDetailModal show={!!selectedInvoice} onClose={() => setSelectedInvoice(null)} invoice={selectedInvoice} onUpdateStatus={handleUpdateInvoiceStatus} />}

            <div className="glass-panel p-4 rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="p-3">Nº Factura</th>
                                <th className="p-3">Proveedor</th>
                                <th className="p-3">Fecha</th>
                                <th className="p-3 text-right">Monto Total</th>
                                <th className="p-3 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(invoice => (
                                <tr key={invoice.id} className="border-b border-[var(--color-border)] hover:bg-bg-tertiary cursor-pointer transition-colors" onClick={() => setSelectedInvoice(invoice)}>
                                    <td className="p-3 font-mono">{invoice.invoiceNumber}</td>
                                    <td className="p-3 font-medium">{invoice.provider}</td>
                                    <td className="p-3">{invoice.date.toDate().toLocaleDateString('es-VE')}</td>
                                    <td className="p-3 font-mono text-right">${invoice.totalAmount.toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${invoice.status === 'paid' ? 'bg-green-500 text-black' : 'bg-yellow-500 text-black'}`}>
                                            {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {invoices.length === 0 && <p className="text-center text-text-secondary py-8">No hay facturas registradas.</p>}
                </div>
            </div>
        </div>
    );
};

export const OrdersView: React.FC<{
    products: Product[],
    providers: Provider[],
    handleSaveOrUpdateProvider: (name: string, phone: string) => void,
    showNotification: (m: string, t: NotificationType['type']) => void,
}> = ({ products, providers, handleSaveOrUpdateProvider, showNotification }) => {
    const [orderItems, setOrderItems] = useState<{productName: string, quantity: number, unit: string}[]>([]);
    const [recommendations, setRecommendations] = useState<{productName: string, quantity: number, unit: string}[]>([]);
    const [providerName, setProviderName] = useState('');
    const [providerPhone, setProviderPhone] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);

    const generateRecommendations = (filterType: 'carnes' | 'verduras' | 'viveres' | 'licores') => {
        let lowStockProducts: Product[];
        const veggieNames = ['Tomate', 'Lechuga', 'Cebolla'];

        switch (filterType) {
            case 'carnes':
                lowStockProducts = products.filter(p => p.category === 'Carnes' && p.quantity <= p.minStock);
                break;
            case 'verduras':
                lowStockProducts = products.filter(p => p.category === 'Verduras' && p.quantity <= p.minStock);
                break;
            case 'viveres':
                lowStockProducts = products.filter(p => p.category === 'Despensa' && !veggieNames.includes(p.name) && p.quantity <= p.minStock);
                break;
            case 'licores':
                lowStockProducts = products.filter(p => p.category === 'Licores' && p.quantity <= p.minStock);
                break;
        }

        if (lowStockProducts.length === 0) {
            showNotification(`No hay productos con bajo stock para la categoría de ${filterType}.`, 'info');
            return;
        }

        const newRecs = lowStockProducts.map(p => ({
            productName: p.name,
            quantity: (p.minStock - p.quantity) > 0 ? Math.ceil(p.minStock - p.quantity) + p.minStock : p.minStock,
            unit: p.unit
        }));
        setRecommendations(newRecs);
        showNotification(`${newRecs.length} recomendaciones generadas.`, 'success');
    };
    
    const addRecommendationToOrder = (rec: {productName: string, quantity: number, unit: string}) => {
        if (!orderItems.some(item => item.productName === rec.productName)) {
            setOrderItems(prev => [...prev, rec]);
            setRecommendations(prev => prev.filter(item => item.productName !== rec.productName));
        }
    };
    
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term) {
            setSearchResults(
                products.filter(p => 
                    p.name.toLowerCase().includes(term.toLowerCase()) &&
                    !orderItems.some(item => item.productName === p.name)
                ).slice(0, 5)
            );
        } else {
            setSearchResults([]);
        }
    };
    
    const handleAddItem = (product: Product) => {
        setOrderItems([...orderItems, { productName: product.name, quantity: 1, unit: product.unit }]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleSendWhatsApp = () => {
        if (!providerPhone || !providerName) {
            showNotification('Por favor, introduce el nombre y número de WhatsApp del proveedor.', 'error');
            return;
        }
        if (orderItems.length === 0) {
            showNotification('No hay items en el pedido para enviar.', 'error');
            return;
        }

        handleSaveOrUpdateProvider(providerName, providerPhone);

        let message = `*PEDIDO PARA ${providerName.toUpperCase()}*\n\n`;
        message += 'Hola, te envío el siguiente pedido:\n';
        orderItems.forEach(item => {
            message += `\n- ${item.quantity} ${item.unit} de ${item.productName}`;
        });
        message += '\n\nGracias.';

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${providerPhone}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleSelectProvider = (provider: Provider) => {
        setProviderName(provider.name);
        setProviderPhone(provider.phone);
    };

    return (
        <div>
            <Header title="Pedidos a Proveedores" subtitle="Genera y envía tus órdenes de compra." />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-[var(--color-primary)] mb-2">Crear Pedido Personalizado</h3>
                        <div className="p-4 bg-bg-primary rounded-lg">
                            <h4 className="font-semibold mb-3">Sugerencias de Pedido</h4>
                             <div className="flex flex-wrap gap-2 mb-4">
                                <button onClick={() => generateRecommendations('carnes')} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 flex items-center gap-2 transition-transform active:scale-95"><Drumstick size={18} /> Carnes</button>
                                <button onClick={() => generateRecommendations('verduras')} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-transform active:scale-95"><Leaf size={18} /> Verduras</button>
                                <button onClick={() => generateRecommendations('viveres')} className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 flex items-center gap-2 transition-transform active:scale-95"><Box size={18} /> Víveres</button>
                                <button onClick={() => generateRecommendations('licores')} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-transform active:scale-95"><Wine size={18} /> Licores</button>
                            </div>
                            {recommendations.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {recommendations.map((rec, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-bg-secondary rounded-md">
                                            <span>{rec.productName} ({rec.quantity} {rec.unit})</span>
                                            <button onClick={() => addRecommendationToOrder(rec)} className="p-1 bg-green-600 rounded-full text-white"><Plus size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                             <div className="relative">
                                <label className="block text-sm font-medium text-text-secondary mb-1">Buscar y Añadir Producto Manualmente</label>
                                <input 
                                    type="text" 
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    placeholder="Buscar cualquier producto..."
                                    className="w-full bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]"
                                />
                                {searchResults.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-bg-tertiary border border-[var(--color-border)] rounded-lg mt-1 max-h-48 overflow-y-auto">
                                        {searchResults.map(p => (
                                            <li key={p.id} onClick={() => handleAddItem(p)} className="px-4 py-2 hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-text-on-brand)] cursor-pointer">{p.name}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-primary)] mt-6 mb-4">Lista de Pedido Final</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                        {orderItems.length > 0 ? orderItems.map((item, index) => (
                             <div key={index} className="flex items-center gap-2 p-2 bg-bg-primary rounded-md">
                                <span className="flex-grow font-semibold">{item.productName}</span>
                                <input 
                                    type="number" 
                                    value={item.quantity}
                                    onChange={(e) => {
                                        const newItems = [...orderItems];
                                        newItems[index].quantity = Number(e.target.value);
                                        setOrderItems(newItems);
                                    }}
                                    className="w-24 bg-bg-secondary p-1 rounded-md text-center"
                                />
                                 <span className="text-text-secondary w-20 text-center">{item.unit}</span>
                                <button onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-400"><Trash2 size={18}/></button>
                            </div>
                        )) : (
                            <p className="text-text-secondary text-center py-12">Tu lista de pedido está vacía.</p>
                        )}
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl self-start">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] mb-4">Enviar Pedido</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nombre del Proveedor" value={providerName} onChange={e => setProviderName(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]" />
                        <input type="text" placeholder="Nº WhatsApp (ej: 58412...)" value={providerPhone} onChange={e => setProviderPhone(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]" />
                        
                        {providers.length > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-text-secondary mb-2">Proveedores Recientes</h4>
                                <div className="space-y-2">
                                    {providers.map(p => (
                                        <button key={p.id} onClick={() => handleSelectProvider(p)} className="w-full text-left p-2 bg-bg-primary rounded-md hover:bg-bg-tertiary flex items-center gap-2">
                                            <Contact size={16} />
                                            <div>
                                                <p className="font-semibold">{p.name}</p>
                                                <p className="text-xs text-text-secondary">{p.phone}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <button onClick={handleSendWhatsApp} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-transform active:scale-95">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99 0-3.902-.539-5.587-1.52l-6.19 1.669zm4.615-6.397.31.188c1.473.896 3.206 1.362 5.029 1.363 5.473 0 9.9-4.427 9.903-9.9 0-2.639-1.037-5.124-2.9-6.988-1.863-1.864-4.349-2.9-6.988-2.9-5.473 0-9.9 4.428-9.9 9.902.001 2.021.59 3.965 1.699 5.688l.189.311-1.181 4.325 4.327-1.18z"/></svg>
                            Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Productions Components ---
interface CreateProductionFormProps {
    products: Product[];
    onCreateProduction: (data: any) => Promise<void>;
    showNotification: (m: string, t: NotificationType['type']) => void;
    onClose: () => void;
}
const CreateProductionForm: React.FC<CreateProductionFormProps> = ({ products, onCreateProduction, showNotification, onClose }) => {
    const [rawMaterialId, setRawMaterialId] = useState<string>('');
    const [quantityUsed, setQuantityUsed] = useState('');
    const [outputs, setOutputs] = useState<Partial<ProductionOutput>[]>([{ productName: '', quantity: undefined, unit: 'kg', category: 'Producción' }]);
    const [waste, setWaste] = useState({ quantity: '', unit: 'g' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const meatProducts = useMemo(() => products.filter(p => p.category === "Carnes"), [products]);
    const selectedRawMaterial = useMemo(() => products.find(p => p.id === rawMaterialId), [products, rawMaterialId]);

    const handleOutputChange = (index: number, field: keyof ProductionOutput, value: any) => {
        const newOutputs = [...outputs];
        (newOutputs[index] as any)[field] = value;
        setOutputs(newOutputs);
    };

    const addOutput = () => {
        setOutputs([...outputs, { productName: '', quantity: undefined, unit: 'kg', category: 'Producción' }]);
    };
    
    const removeOutput = (index: number) => {
        setOutputs(outputs.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRawMaterial || !quantityUsed || outputs.some(o => !o.productName || !o.quantity || o.quantity <= 0)) {
            showNotification('Por favor, completa todos los campos requeridos.', 'error');
            return;
        }
        
        const usedQty = parseFloat(quantityUsed);
        if (usedQty > selectedRawMaterial.quantity) {
            showNotification('No puedes usar más materia prima de la que tienes en stock.', 'error');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await onCreateProduction({
                rawMaterialId: selectedRawMaterial.id,
                rawMaterialName: selectedRawMaterial.name,
                rawMaterialUnit: selectedRawMaterial.unit,
                rawMaterialQuantityUsed: usedQty,
                outputs: outputs.map(o => ({...o, quantity: Number(o.quantity)})),
                waste: { quantity: Number(waste.quantity) || 0, unit: waste.unit },
            });
            onClose();
        } catch (error) {
            console.error(error);
            showNotification((error as Error).message || 'Error al crear la producción.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="glass-panel p-4 rounded-lg my-4 animate-fadeIn">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h4 className="text-lg font-semibold text-[var(--color-primary)] mb-2">1. Materia Prima</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Seleccionar Producto de Carne</label>
                            <select value={rawMaterialId} onChange={e => setRawMaterialId(e.target.value)} className="w-full bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]">
                                <option value="" disabled>-- Elige un producto --</option>
                                {meatProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</option>)}
                            </select>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-text-secondary mb-1">Cantidad a Usar ({selectedRawMaterial?.unit})</label>
                             <input type="number" step="any" value={quantityUsed} onChange={e => setQuantityUsed(e.target.value)} className="w-full bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]" />
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="text-lg font-semibold text-[var(--color-primary)] mb-2">2. Productos Resultantes</h4>
                    <div className="space-y-3">
                        {outputs.map((output, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 p-2 bg-bg-secondary rounded-md items-center">
                                <input type="text" placeholder="Nombre Producto Final" value={output.productName} onChange={e => handleOutputChange(index, 'productName', e.target.value)} className="col-span-4 bg-bg-primary p-2 rounded-md" />
                                <input type="number" step="any" placeholder="Cant." value={output.quantity || ''} onChange={e => handleOutputChange(index, 'quantity', parseFloat(e.target.value))} className="col-span-2 bg-bg-primary p-2 rounded-md" />
                                <select value={output.unit} onChange={e => handleOutputChange(index, 'unit', e.target.value)} className="col-span-2 bg-bg-primary p-2 rounded-md">
                                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <select value={output.category} onChange={e => handleOutputChange(index, 'category', e.target.value)} className="col-span-3 bg-bg-primary p-2 rounded-md">
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button type="button" onClick={() => removeOutput(index)} className="text-red-500 hover:text-red-400"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addOutput} className="mt-2 text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"><PlusCircle size={16} /> Añadir otro producto</button>
                </div>

                <div>
                    <h4 className="text-lg font-semibold text-[var(--color-primary)] mb-2">3. Merma (Opcional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="number" step="any" placeholder="Cantidad de merma" value={waste.quantity} onChange={e => setWaste({...waste, quantity: e.target.value})} className="bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]" />
                         <select value={waste.unit} onChange={e => setWaste({...waste, unit: e.target.value})} className="bg-bg-secondary p-2 rounded-md border border-[var(--color-border)]">
                            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-[var(--color-border)]">
                    <button type="button" onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg hover:bg-gray-700">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="bg-green-600 font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-500">
                        {isSubmitting ? 'Procesando...' : 'Confirmar Producción'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export const ProductionsView: React.FC<CommonViewProps & {
    productions: Production[],
    handleCreateProduction: (data: any) => Promise<void>,
}> = ({ products, productions, showNotification, handleCreateProduction, permissions }) => {
    const [showCreateForm, setShowCreateForm] = useState(false);

    const sortedProductions = useMemo(() => 
        [...productions].sort((a, b) => b.date.seconds - a.date.seconds), 
    [productions]);

    return (
        <div>
            <Header title={<><Scaling /> Producciones</>} subtitle="Registra y consulta el procesamiento de materia prima.">
                <button
                    onClick={() => setShowCreateForm(prev => !prev)}
                    disabled={!permissions.canCreateProductions}
                    className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-4 rounded-lg hover:bg-[var(--color-primary-hover)] flex items-center gap-2 transition-transform active:scale-95 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    title={permissions.canCreateProductions ? "Registrar nueva producción" : "Permiso para crear producciones denegado"}
                >
                    {permissions.canCreateProductions ? <PlusCircle size={18} /> : <Lock size={18} />}
                    {showCreateForm ? 'Cerrar Formulario' : 'Registrar Producción'}
                </button>
            </Header>

            {showCreateForm && (
                <CreateProductionForm
                    products={products}
                    onCreateProduction={handleCreateProduction}
                    showNotification={showNotification}
                    onClose={() => setShowCreateForm(false)}
                />
            )}
            
            <div className="glass-panel p-4 rounded-2xl">
                <h3 className="text-xl font-bold mb-4">Historial de Producciones</h3>
                 <div className="space-y-4">
                    {sortedProductions.length > 0 ? sortedProductions.map(prod => (
                        <div key={prod.id} className="bg-bg-primary p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                                <p className="font-bold text-lg">{new Date(prod.date.seconds * 1000).toLocaleString('es-VE')}</p>
                                <div className="text-right">
                                    <p className="text-sm text-text-secondary">Materia Prima</p>
                                    <p className="font-semibold">{prod.rawMaterialName}</p>
                                    <p className="font-mono text-red-400">-{prod.rawMaterialQuantityUsed} {prod.rawMaterialUnit}</p>
                                </div>
                            </div>
                            <h4 className="font-semibold text-[var(--color-primary)]">Resultados:</h4>
                            <ul className="list-disc list-inside pl-2 text-sm space-y-1 my-2">
                                {prod.outputs.map((out, i) => (
                                    <li key={i}>{out.productName}: <span className="font-mono text-green-400">+{out.quantity} {out.unit}</span></li>
                                ))}
                            </ul>
                             {prod.waste.quantity > 0 && <p className="text-xs text-gray-500">Merma: {prod.waste.quantity} {prod.waste.unit}</p>}
                        </div>
                    )) : (
                        <p className="text-center text-text-secondary py-16">No hay registros de producción.</p>
                    )}
                </div>
            </div>
        </div>
    );
};


interface DayDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    movements: Movement[];
    date: Date | null;
    onMovementClick: (movement: Movement) => void;
}
const DayDetailModal: React.FC<DayDetailModalProps> = ({ isOpen, onClose, movements, date, onMovementClick }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="glass-panel rounded-lg p-6 w-full max-w-2xl animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)]">
                        Movimientos del {date?.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {movements.length > 0 ? movements.map((m, i) => (
                        <li 
                            key={`${m.date}-${i}`}
                            onClick={() => {
                                if (!m.cancelled) {
                                    onMovementClick(m);
                                    onClose();
                                }
                            }}
                            className={`flex justify-between items-center p-3 bg-bg-primary rounded-md ${m.cancelled ? 'opacity-50' : 'cursor-pointer hover:bg-bg-tertiary'}`}
                        >
                            <div>
                                <p className="font-medium">
                                    {m.productName}{' '}
                                    {m.destination && m.destination !== 'salida_manual' && (
                                        <span className="text-xs text-[var(--color-primary)]">({m.destination})</span>
                                    )}
                                </p>
                                <p className="text-xs text-text-secondary">{new Date(m.date).toLocaleString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                            </div>
                            <div className="text-right">
                                <div className={`font-bold text-lg ${m.type === 'entrada' ? 'text-green-500' : 'text-red-500'}`}>
                                    {m.type === 'entrada' ? '+' : '-'}{m.amount} <span className="text-xs text-text-secondary">({m.unit})</span>
                                </div>
                                {m.cancelled && <span className="text-xs text-red-500 font-bold">(Anulado)</span>}
                            </div>
                        </li>
                    )) : (
                        <p className="text-text-secondary text-center py-8">No hubo movimientos este día.</p>
                    )}
                </ul>
            </div>
        </div>
    );
};
export const CalendarView: React.FC<{ products: Product[], onMovementClick: (m: Movement) => void }> = ({ products, onMovementClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [selectedDayMovements, setSelectedDayMovements] = useState<Movement[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const allMovements = useMemo(() => 
        products.flatMap(p => 
            (p.history || []).map(h => ({
                ...h,
                productName: p.name,
                productId: p.id,
                category: p.category,
                dateObj: new Date(h.date)
            }))
        ), [products]);

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        return day;
    });

    const handleDayClick = (day: Date) => {
        const dayString = day.toISOString().split('T')[0];
        const movements = allMovements
            .filter(m => m.dateObj.toISOString().split('T')[0] === dayString)
            .sort((a,b) => b.dateObj.getTime() - a.dateObj.getTime());
        setSelectedDayMovements(movements);
        setSelectedDate(day);
        setIsDayModalOpen(true);
    };
    
    const changeWeek = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + amount * 7);
        setCurrentDate(newDate);
    };

    return (
        <div>
            <Header title="Calendario de Movimientos" subtitle="Visualiza las entradas y salidas de inventario por día." />
            <DayDetailModal 
                isOpen={isDayModalOpen} 
                onClose={() => setIsDayModalOpen(false)} 
                movements={selectedDayMovements} 
                date={selectedDate}
                onMovementClick={onMovementClick}
            />
            <div className="glass-panel p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeWeek(-1)} className="p-2 rounded-full hover:bg-bg-tertiary"><ChevronLeft /></button>
                    <h3 className="text-xl font-bold text-[var(--color-primary)]">
                        {currentDate.toLocaleString('es-VE', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                    </h3>
                    <button onClick={() => changeWeek(1)} className="p-2 rounded-full hover:bg-bg-tertiary"><ChevronRight /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="font-bold text-text-secondary py-2">{day}</div>
                    ))}
                    {weekDays.map(day => {
                        const dayString = day.toISOString().split('T')[0];
                        const movementsOnDay = allMovements.filter(m => m.dateObj.toISOString().split('T')[0] === dayString && m.type === 'entrada');
                        
                        const hasMeatMovement = movementsOnDay.some(m => m.category === 'Carnes');
                        const hasVeggieMovement = movementsOnDay.some(m => ['Tomate', 'Lechuga', 'Cebolla'].includes(m.productName || ''));
                        const hasSanCarlosMovement = movementsOnDay.some(m => ['Aceite', 'Arroz', 'Chorizo', 'Harina P.A.N.'].includes(m.productName || ''));

                        const isToday = dayString === new Date().toISOString().split('T')[0];
                        
                        return (
                            <div key={dayString} onClick={() => handleDayClick(day)} className="bg-bg-primary rounded-lg p-2 h-32 flex flex-col justify-between cursor-pointer hover:bg-bg-tertiary transition-colors">
                                <div className="flex justify-between items-start">
                                    <p className={`font-bold ${isToday ? 'text-[var(--color-primary)]' : ''}`}>{day.getDate()}</p>
                                    <div className="flex flex-col items-end gap-1 mt-1">
                                        {hasMeatMovement && <div className="w-2 h-2 bg-red-500 rounded-full" title="Carnes"></div>}
                                        {hasVeggieMovement && <div className="w-2 h-2 bg-green-500 rounded-full" title="Verduras"></div>}
                                        {hasSanCarlosMovement && <div className="w-2 h-2 bg-yellow-400 rounded-full" title="Camión San Carlos"></div>}
                                    </div>
                                </div>
                                <div className="text-xs text-right">
                                    {/* Additional info can go here */}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const StatsView: React.FC<CommonViewProps> = ({ products, showNotification }) => {
    const [daysForRecommendation, setDaysForRecommendation] = useState(7);
    const [recommendation, setRecommendation] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<'Stock Óptimo' | 'Stock Bajo' | 'Agotado' | null>(null);
    
    const today = new Date();
    today.setHours(0,0,0,0);

    const dailyData = useMemo(() => products.reduce((acc, product) => {
        if (!product.history) return acc;
        product.history.forEach(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0,0,0,0);
            if (entryDate.getTime() === today.getTime()) {
                if (entry.type === 'entrada') acc.entradas += entry.amount;
                if (entry.type === 'salida') acc.salidas += Math.abs(entry.amount);
            }
        });
        return acc;
    }, { entradas: 0, salidas: 0 }), [products, today]);

    const stockStatusData = useMemo(() => [
        { name: 'Stock Óptimo', value: products.filter(p => p.quantity > p.minStock).length },
        { name: 'Stock Bajo', value: products.filter(p => p.quantity <= p.minStock && p.quantity > 0).length },
        { name: 'Agotado', value: products.filter(p => p.quantity === 0).length },
    ], [products]);
    
    const topMovedProducts = useMemo(() => [...products].sort((a, b) => (b.history?.length || 0) - (a.history?.length || 0)).slice(0, 5), [products]);

    const consumptionForecast = useMemo(() => {
        return products.map(product => {
            const salidas = product.history?.filter(h => h.type === 'salida' && !h.cancelled) || [];
            if (salidas.length < 2) return { ...product, daysRemaining: Infinity };

            const sortedSalidas = salidas.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const firstDate = new Date(sortedSalidas[0].date);
            const lastDate = new Date(sortedSalidas[sortedSalidas.length - 1].date);
            const daysElapsed = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
            
            const totalConsumed = sortedSalidas.reduce((sum, h) => sum + h.amount, 0);
            const dailyConsumption = totalConsumed / daysElapsed;

            if (dailyConsumption <= 0) return { ...product, daysRemaining: Infinity };

            const daysRemaining = product.quantity / dailyConsumption;
            return { ...product, daysRemaining };
        })
        .filter(p => p.daysRemaining !== Infinity && p.quantity > 0)
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 5);
    }, [products]);

    const COLORS = ['#4ade80', '#facc15', '#ef4444'];

    const handleGenerateRecommendation = async () => {
        setIsGenerating(true);
        setRecommendation('');
        try {
            const result = await generateShoppingRecommendation(daysForRecommendation, products);
            setRecommendation(result);
        } catch (error) {
            console.error("Error generating recommendation:", error);
            showNotification('Hubo un error al conectar con el asistente.', 'error');
            setRecommendation('Hubo un error al conectar con el asistente. Por favor, inténtalo de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handlePieClick = (data: any) => {
        setSelectedStatus(data.name);
        setShowStatusModal(true);
    };

    return (
        <div>
            <Header title={<><BarChartIcon size={28} className="inline-block" /> Estadísticas y Recomendaciones</>} subtitle="Analiza el rendimiento y obtén predicciones para tu inventario."/>
            <StockStatusModal 
                show={showStatusModal} 
                onClose={() => setShowStatusModal(false)} 
                products={products} 
                status={selectedStatus} 
            />
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="glass-panel p-6 rounded-2xl lg:col-span-1">
                        <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Movimientos del Día</h3>
                        <div className="flex justify-around text-center">
                            <div>
                                <p className="text-text-secondary">Entradas</p>
                                <p className="text-3xl font-bold text-green-500 flex items-center justify-center gap-2">
                                    <ArrowUp /> {dailyData.entradas.toFixed(2)}
                                </p>
                            </div>
                            <div>
                                <p className="text-text-secondary">Salidas</p>
                                <p className="text-3xl font-bold text-red-500 flex items-center justify-center gap-2">
                                    <ArrowDown /> {dailyData.salidas.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
                        <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Estado General del Stock</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie 
                                    data={stockStatusData} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius={80} 
                                    label
                                    onClick={handlePieClick}
                                    className="cursor-pointer"
                                >
                                    {stockStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Predicción de Agotamiento</h3>
                        {consumptionForecast.length > 0 ? (
                            <ul className="space-y-4">
                                {consumptionForecast.map(p => (
                                    <li key={p.id} className="flex items-center justify-between p-3 bg-bg-primary rounded-md">
                                        <span className="font-medium">{p.name}</span>
                                        <div className="text-right">
                                            <span className="font-bold text-yellow-400 flex items-center gap-2">
                                                <Clock size={16} />
                                                ~{Math.floor(p.daysRemaining)} días
                                            </span>
                                            <span className="text-xs text-text-secondary">Quedan {p.quantity} {p.unit}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-text-secondary text-center py-8">No hay suficientes datos de consumo para hacer una predicción.</p>
                        )}
                    </div>
                    <div className="glass-panel p-6 rounded-2xl">
                        <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)]">Top 5 Productos con más movimiento</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={topMovedProducts} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis type="number" stroke="var(--color-text-secondary)" />
                                <YAxis dataKey="name" type="category" stroke="var(--color-text-secondary)" width={100} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }} />
                                <Legend />
                                <Bar dataKey={(p) => p.history?.length || 0} name="Nº de Movimientos" fill="var(--color-primary)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold mb-4 text-[var(--color-primary)] flex items-center gap-2"><Wand2 /> Recomendación de Compra con IA</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                        <label htmlFor="days" className="text-text-secondary">Comprar para los próximos</label>
                        <input
                            id="days"
                            type="number"
                            value={daysForRecommendation}
                            onChange={(e) => setDaysForRecommendation(Number(e.target.value))}
                            min="1"
                            className="bg-bg-primary w-20 text-center p-2 rounded-lg border border-[var(--color-border)]"
                        />
                        <label htmlFor="days" className="text-text-secondary">días</label>
                        <button onClick={handleGenerateRecommendation} disabled={isGenerating} className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-6 rounded-lg hover:bg-[var(--color-primary-hover)] disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                            {isGenerating ? 'Generando...' : 'Generar'}
                        </button>
                    </div>
                    {isGenerating && <p className="text-center text-[var(--color-primary)]">Analizando datos, por favor espera...</p>}
                    {recommendation && (
                        <div className="mt-4 p-4 bg-bg-primary rounded-lg border border-[var(--color-border)]">
                           <pre className="whitespace-pre-wrap font-sans text-text-primary">{recommendation}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ReportsView: React.FC<{ products: Product[] }> = ({ products }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [inventoryReport, setInventoryReport] = useState<{title: string, data: {[key: string]: Product[]}} | null>(null);

    const getWeekRange = (date: Date) => {
        const start = new Date(date);
        start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1)); // Monday is start of week
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
    };

    const changeWeek = (amount: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + amount * 7);
        setCurrentDate(newDate);
    };
    
    const weeklyReportData = useMemo(() => {
        const { start, end } = getWeekRange(currentDate);
        const report: {[category: string]: {[productName: string]: {entradas: number, salidas: number, unit: string}}} = {};
        
        products.forEach(product => {
            const relevantHistory = (product.history || []).filter(h => {
                const hDate = new Date(h.date);
                return hDate >= start && hDate <= end && !h.cancelled;
            });
            
            if (relevantHistory.length > 0) {
                if (!report[product.category]) {
                    report[product.category] = {};
                }
                
                const productSummary = relevantHistory.reduce((summary, move) => {
                    if (move.type === 'entrada') {
                        summary.entradas += move.amount;
                    } else if (move.type === 'salida') {
                        summary.salidas += move.amount;
                    }
                    return summary;
                }, { entradas: 0, salidas: 0, unit: product.unit });
                
                if (productSummary.entradas > 0 || productSummary.salidas > 0) {
                    report[product.category][product.name] = productSummary;
                }
            }
        });
        
        return report;
    }, [products, currentDate]);
    
    const generateInventoryReport = (category: string | null = null) => {
        const title = category ? `Inventario de ${category}` : 'Inventario Total';
        let filteredProducts = category ? products.filter(p => p.category === category) : products;

        const data = filteredProducts.reduce((acc, product) => {
            if (!acc[product.category]) {
                acc[product.category] = [];
            }
            acc[product.category].push(product);
            return acc;
        }, {} as {[key: string]: Product[]});

        setInventoryReport({ title, data });
    };

    const { start, end } = getWeekRange(currentDate);
    const dateRangeString = `${start.toLocaleDateString('es-VE')} - ${end.toLocaleDateString('es-VE')}`;

    return (
        <div>
            <Header title="Reportes" subtitle="Genera reportes semanales y de inventario actual." >
                 <button 
                    onClick={() => window.print()}
                    className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-4 rounded-lg hover:bg-[var(--color-primary-hover)] flex items-center justify-center gap-2 transition-transform active:scale-95 print-hidden"
                >
                    <Printer size={18} /> Imprimir
                </button>
            </Header>
            <div id="report-content">
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4 print-hidden">
                        <button onClick={() => changeWeek(-1)} className="p-2 rounded-full hover:bg-bg-tertiary"><ChevronLeft /></button>
                        <h3 className="text-lg font-bold text-text-primary text-center">
                            Semana del {dateRangeString}
                        </h3>
                        <button onClick={() => changeWeek(1)} className="p-2 rounded-full hover:bg-bg-tertiary"><ChevronRight /></button>
                    </div>
                    <div className="print-block hidden mb-6 text-center">
                        <h1 className="text-2xl font-bold">Reporte Semanal de Movimientos</h1>
                        <h2 className="text-lg">Asados Los Llanos</h2>
                        <p>{dateRangeString}</p>
                    </div>
                    {Object.keys(weeklyReportData).length > 0 ? (
                        Object.keys(weeklyReportData).sort().map(category => (
                            <div key={category} className="mb-8 page-break">
                                <h3 className="text-2xl font-bold text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] pb-2 mb-4">{category}</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-600">
                                                <th className="p-2">Producto</th>
                                                <th className="p-2 text-center">Entradas</th>
                                                <th className="p-2 text-center">Salidas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(weeklyReportData[category]).sort().map(productName => {
                                                const data = weeklyReportData[category][productName];
                                                return (
                                                    <tr key={productName} className="border-b border-gray-700">
                                                        <td className="p-2 font-medium">{productName}</td>
                                                        <td className="p-2 text-center font-mono text-green-400">
                                                            {data.entradas > 0 ? `+${data.entradas.toFixed(2)} ${data.unit}` : '-'}
                                                        </td>
                                                        <td className="p-2 text-center font-mono text-red-400">
                                                            {data.salidas > 0 ? `-${data.salidas.toFixed(2)} ${data.unit}` : '-'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16">
                            <p className="text-text-secondary text-lg">No se encontraron movimientos para esta semana.</p>
                        </div>
                    )}
                </div>

                <div className="glass-panel p-6 rounded-2xl mt-8">
                    <h3 className="text-2xl font-bold text-[var(--color-primary)] mb-4">Reportes de Inventario Actual</h3>
                    <div className="flex flex-wrap gap-4 mb-6 print-hidden">
                        <button onClick={() => generateInventoryReport()} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Inventario Total</button>
                        <button onClick={() => generateInventoryReport('Despensa')} className="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700">Despensa</button>
                        <button onClick={() => generateInventoryReport('Carnes')} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700">Carnes</button>
                        <button onClick={() => generateInventoryReport('Verduras')} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Verduras</button>
                        <button onClick={() => generateInventoryReport('Licores')} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">Licores</button>
                    </div>

                    {inventoryReport && (
                        <div className="page-break">
                            <h3 className="text-2xl font-bold text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] pb-2 mb-4">{inventoryReport.title}</h3>
                            {Object.keys(inventoryReport.data).sort().map(category => (
                                <div key={category} className="mb-6">
                                    <h4 className="text-xl font-semibold text-text-primary mb-2">{category}</h4>
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-600">
                                                <th className="p-2">Producto</th>
                                                <th className="p-2 text-right">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryReport.data[category].sort((a,b) => a.name.localeCompare(b.name)).map(product => (
                                                <tr key={product.id} className="border-b border-gray-700">
                                                    <td className="p-2">{product.name}</td>
                                                    <td className="p-2 text-right font-mono">{product.quantity} {product.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ChatbotView: React.FC<CommonViewProps & {
    invoices: Invoice[],
    handleCreateInvoice: (invoiceData: Omit<Invoice, 'id'>) => Promise<void>,
    handleCreateRequisition: (reqData: { department: string, items: any[] }) => Promise<void>,
}> = ({ products, invoices, showNotification, onUpdateQuantity, handleCreateInvoice, handleCreateRequisition }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const today = new Date().toISOString().split('T')[0];
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // Initial message
        if (messages.length === 0) {
            setMessages([{ id: Date.now(), sender: 'bot', text: '¡Hola! Soy tu asistente de inventario. Ahora puedo realizar acciones por ti. ¿En qué te ayudo?' }]);
        }
    }, []);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = { id: Date.now(), sender: 'user', text: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages); 
        setInput('');
        setLoading(true);

        try {
            const response = await getChatbotResponse(input, products, invoices);

            if (response.action) {
                const confirmationMessage = { id: Date.now() + 1, sender: 'bot', type: 'action_confirmation', action: response.action };
                setMessages([...newMessages, confirmationMessage]);
            } else {
                const botMessage = { id: Date.now() + 1, sender: 'bot', text: response.text };
                setMessages([...newMessages, botMessage]);
            }
        } catch(e) {
            console.error(e);
            const errorMessage = { id: Date.now() + 1, sender: 'bot', text: 'Hubo un error al conectar con el asistente.' };
            setMessages([...newMessages, errorMessage]);
        } finally {
            setLoading(false);
        }
    };
    
    const handleConfirmAction = async (action: GeminiAction) => {
        setLoading(true);
        const { name, args } = action;
        let resultMessage = '';

        try {
            switch (name) {
                case 'add_stock': {
                    const { productName, quantity, unit } = args;
                    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
                    if (!product) throw new Error(`Producto "${productName}" no encontrado.`);
                    await onUpdateQuantity(product.id, quantity, unit, 'chatbot_entrada');
                    resultMessage = `✅ Entrada registrada: ${quantity} ${unit} de ${productName}.`;
                    break;
                }
                case 'remove_stock': {
                    const { productName, quantity, unit, destination } = args;
                    const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
                    if (!product) throw new Error(`Producto "${productName}" no encontrado.`);
                    if (product.quantity < quantity) throw new Error(`Stock insuficiente para "${productName}". Quedan ${product.quantity}.`);
                    await onUpdateQuantity(product.id, -quantity, unit, destination || 'salida_chatbot');
                    resultMessage = `✅ Salida registrada: ${quantity} ${unit} de ${productName}.`;
                    break;
                }
                case 'create_invoice':
                    await handleCreateInvoice({
                        ...args,
                        date: Timestamp.now(),
                        status: 'pending',
                        source: 'ia_chatbot',
                    });
                    resultMessage = `✅ Factura #${args.invoiceNumber} para ${args.provider} creada.`;
                    break;
                case 'create_requisition':
                    await handleCreateRequisition(args);
                    resultMessage = `✅ Requisición para ${args.department} creada.`;
                    break;
                default:
                    throw new Error(`Acción "${name}" desconocida o no implementada.`);
            }
            showNotification(resultMessage, 'success');
        } catch (error) {
            const err = error as Error;
            resultMessage = `❌ ${err.message}` || '❌ Ocurrió un error al ejecutar la acción.';
            showNotification(resultMessage, 'error');
        }

        const finalMessages = messages
            .filter(m => m.type !== 'action_confirmation')
            .concat({ id: Date.now(), sender: 'bot', text: resultMessage });
        
        setMessages(finalMessages);
        setLoading(false);
    };

    const handleCancelAction = () => {
        const finalMessages = messages.filter(m => m.type !== 'action_confirmation');
        finalMessages.push({ id: Date.now(), sender: 'bot', text: 'Acción cancelada.' });
        setMessages(finalMessages);
    };

    return (
        <div>
            <Header title="Asistente Virtual IA" subtitle="Consulta o da órdenes directas para gestionar tu inventario."/>
            <div className="glass-panel rounded-2xl h-[75vh] flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={msg.id || index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end animate-slideInFromRight' : 'justify-start animate-slideInFromLeft'}`}>
                            {msg.sender === 'bot' && msg.type !== 'action_confirmation' && <Bot className="text-[var(--color-primary)] flex-shrink-0 self-end" />}
                            
                            {msg.type === 'action_confirmation' ? (
                                <ActionConfirmationCard
                                    action={msg.action}
                                    onConfirm={() => handleConfirmAction(msg.action)}
                                    onCancel={handleCancelAction}
                                />
                            ) : (
                                <div className={`max-w-lg p-3 rounded-lg ${msg.sender === 'user' ? 'bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)]' : 'bg-bg-primary'}`}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-bg-primary animate-pulse">...</div></div>}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-[var(--color-border-glass)]">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ej: 'Crea una factura para...' o 'Dale entrada a...'"
                            className="flex-1 bg-bg-primary p-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            disabled={loading}
                        />
                        <button onClick={handleSend} disabled={loading} className="bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)] font-bold py-2 px-4 rounded-lg hover:bg-[var(--color-primary-hover)] disabled:bg-gray-500 transition-transform active:scale-95">
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SettingsView: React.FC<{ 
    showNotification: (msg: string, type: NotificationType['type']) => void;
    settings: AppSettings;
    setSettings: (settings: AppSettings) => void;
}> = ({ showNotification, settings, setSettings }) => {

    const handleThemeChange = (theme: AppSettings['theme']) => {
        setSettings({ ...settings, theme });
    };

    const handleRoleChange = (role: AppSettings['role']) => {
        setSettings({ ...settings, role });
        showNotification(`Rol cambiado a "${role.charAt(0).toUpperCase() + role.slice(1)}". Los permisos se han actualizado.`, 'info');
    };

    const roleConfig = {
        jefe: {
            name: "Jefe",
            icon: Crown,
            color: "text-yellow-400",
            description: "Acceso total a la aplicación. Puede gestionar inventario, usuarios, y configuraciones."
        },
        inventario: {
            name: "Inventario",
            icon: Shield,
            color: "text-blue-400",
            description: "Control total sobre el inventario y operaciones. No puede cambiar ajustes de la app ni roles."
        },
        almacenista: {
            name: "Almacenista",
            icon: HardHat,
            color: "text-orange-400",
            description: "Acceso a tareas operativas: entradas/salidas justificadas, pedidos y producción. Sin ajustes manuales."
        }
    };

    return (
        <div>
            <Header title="Ajustes y Permisos" subtitle="Gestiona la apariencia y el rol de usuario para esta sesión." />
            <div className="space-y-8">
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] mb-4 flex items-center gap-2"><Palette/> Apariencia Visual</h3>
                    <p className="text-text-secondary mb-4">Elige entre un tema claro u oscuro. El color de acento amarillo de la marca se mantendrá siempre.</p>
                     <div className="flex items-center gap-4">
                        <button onClick={() => handleThemeChange('dark')} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${settings.theme === 'dark' ? 'border-[var(--color-primary)]' : 'border-transparent'}`}>
                            <Moon /> Modo Noche
                        </button>
                        <button onClick={() => handleThemeChange('light')} className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${settings.theme === 'light' ? 'border-[var(--color-primary)]' : 'border-transparent'}`}>
                            <Sun /> Modo Día
                        </button>
                    </div>
                </div>
                
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] mb-2 flex items-center gap-2"><UserCheck /> Gestión de Roles (Simulado)</h3>
                    <p className="text-text-secondary mb-4">
                        Cambia el rol para ver cómo se ajustan los permisos en la aplicación. Solo el "Jefe" puede ver y usar esta sección.
                    </p>
                    
                    <div className="mb-6">
                        <label htmlFor="role-select" className="block text-sm font-medium text-text-secondary mb-1">Seleccionar Rol Actual:</label>
                        <select
                            id="role-select"
                            value={settings.role}
                            onChange={e => handleRoleChange(e.target.value as UserRole)}
                            className="w-full md:w-1/3 bg-bg-primary p-2 rounded-md border border-[var(--color-border)]"
                        >
                            <option value="jefe">Jefe</option>
                            <option value="inventario">Inventario</option>
                            <option value="almacenista">Almacenista</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.keys(roleConfig).map(roleKey => {
                            const config = roleConfig[roleKey as UserRole];
                            return (
                                <div key={roleKey} className={`p-4 rounded-lg border-2 ${settings.role === roleKey ? 'border-[var(--color-primary)] bg-bg-primary' : 'border-transparent bg-bg-primary'}`}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <config.icon className={`${config.color}`} size={24} />
                                        <h4 className={`text-lg font-bold ${config.color}`}>{config.name}</h4>
                                    </div>
                                    <p className="text-sm text-text-secondary">{config.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2"><Ban/> Zona de Administración (Simulada)</h3>
                    <p className="text-text-secondary mb-4">
                        En una aplicación real, aquí el "Jefe" podría gestionar usuarios, cambiar sus roles permanentemente o restringir su acceso.
                    </p>
                    <div className="p-4 bg-bg-primary rounded-lg border border-dashed border-[var(--color-border)]">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">Usuario: Vendedor_01</p>
                                <p className="text-sm text-text-secondary">Rol actual: Almacenista</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2 bg-blue-600 rounded-md hover:bg-blue-700" title="Editar Rol"><UserCheck size={18} /></button>
                                <button className="p-2 bg-red-600 rounded-md hover:bg-red-700" title="Banear Usuario"><Ban size={18} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};