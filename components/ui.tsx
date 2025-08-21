import React, { useState, useRef, useEffect } from 'react';
import { Home, ClipboardList, PackagePlus, FileText, Box, Drumstick, Leaf, Wine, Calendar as CalendarIcon, BarChart, Bot, Wrench, X, Menu, Bell, AlertTriangle, ShoppingCart, RotateCcw, Info, PlusCircle, Trash2, Check, Scaling } from 'lucide-react';
import { ViewType, NotificationType, Product, Movement, GeminiAction, AppPermissions } from '../types';
import { auth } from '../services/firebaseService';
import { DESTINATION_OPTIONS, UNIT_OPTIONS, REQUISITION_DEPARTMENTS, CATEGORIES } from '../constants';

// --- Sidebar & Mobile Nav ---

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    name: ViewType;
    currentView: ViewType;
    setView: (view: ViewType) => void;
    setIsOpen: (isOpen: boolean) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, name, currentView, setView, setIsOpen }) => (
    <button
        onClick={() => { setView(name); setIsOpen(false); }}
        className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-all duration-300 transform hover:translate-x-2 text-text-primary hover:bg-bg-tertiary ${
            currentView === name ? 'bg-[var(--color-primary)] text-[var(--color-primary-text-on-brand)]' : ''
        }`}
    >
        {icon}
        <span className="ml-3 font-semibold">{label}</span>
    </button>
);

interface SidebarProps {
    view: ViewType;
    setView: (view: ViewType) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    permissions: AppPermissions;
}

export const Sidebar: React.FC<SidebarProps> = ({ view, setView, isOpen, setIsOpen, permissions }) => {
    const navItems: { icon: React.ReactNode; label: string; name: ViewType; requiredPermission?: keyof AppPermissions }[] = [
        { icon: <Home size={20} />, label: "Inicio", name: "dashboard" },
        { icon: <ClipboardList size={20} />, label: "Requisiciones", name: "requisitions" },
        { icon: <PackagePlus size={20} />, label: "Pedidos", name: "orders" },
        { icon: <FileText size={20} />, label: "Facturas", name: "invoices" },
        { icon: <Box size={20} />, label: "Despensa", name: "pantry" },
        { icon: <Drumstick size={20} />, label: "Carnes", name: "meats" },
        { icon: <Leaf size={20} />, label: "Verduras", name: "vegetables" },
        { icon: <Wine size={20} />, label: "Licores", name: "licores" },
        { icon: <Scaling size={20} />, label: "Producciones", name: "productions" },
        { icon: <CalendarIcon size={20} />, label: "Calendario", name: "calendar" },
        { icon: <BarChart size={20} />, label: "Estadísticas", name: "stats" },
        { icon: <FileText size={20} />, label: "Reportes", name: "reports" },
        { icon: <Bot size={20} />, label: "Asistente IA", name: "chatbot" },
        { icon: <Wrench size={20} />, label: "Ajustes", name: "settings", requiredPermission: 'canAccessSettings' },
    ];
    
    return (
        <nav id="sidebar" className={`fixed md:relative top-0 left-0 w-64 bg-bg-secondary p-4 flex flex-col h-screen z-40 transform transition-transform md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto print-hidden`}>
            <div className="flex items-center justify-between mb-10 px-2">
                <div className="flex items-center">
                    <img src="https://placehold.co/40x40/facc15/1a1a1a?text=LL" alt="Logo Asados Los Llanos" className="rounded-full mr-3" />
                    <h1 className="text-xl font-bold text-text-primary">Asados Los Llanos</h1>
                </div>
                <button onClick={() => setIsOpen(false)} className="md:hidden text-text-secondary hover:text-text-primary">
                    <X size={24} />
                </button>
            </div>
            <div className="space-y-2">
                {navItems.map(item => 
                    (item.requiredPermission === undefined || permissions[item.requiredPermission]) &&
                    <NavItem key={item.name} {...item} currentView={view} setView={setView} setIsOpen={setIsOpen} />
                )}
            </div>
             <div className="mt-auto px-2 text-xs text-text-secondary">
                <p>ID de Sesión:</p>
                <p className="break-words">{auth.currentUser?.uid || 'N/A'}</p>
            </div>
        </nav>
    );
};


interface MobileNavProps {
    onMenuClick: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onMenuClick }) => (
    <div className="md:hidden bg-bg-secondary p-4 flex justify-between items-center sticky top-0 z-30 print-hidden">
        <div className="flex items-center">
            <img src="https://placehold.co/32x32/facc15/1a1a1a?text=LL" alt="Logo Asados Los Llanos" className="rounded-full mr-3" />
            <h1 className="text-lg font-bold text-text-primary">Asados Los Llanos</h1>
        </div>
        <button onClick={onMenuClick} className="text-text-primary">
            <Menu size={24} />
        </button>
    </div>
);


// --- Header ---

interface HeaderProps {
    title: React.ReactNode;
    subtitle?: string;
    children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({title, subtitle, children}) => (
    <header id="page-header" className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hidden">
        <div>
            <h2 className="text-3xl font-bold text-[var(--color-primary)] flex items-center gap-3">{title}</h2>
            {subtitle && <p className="text-text-secondary">{subtitle}</p>}
        </div>
        <div className="w-full md:w-auto">{children}</div>
    </header>
);

// --- Notification ---
interface NotificationProps {
    notification: NotificationType;
    onClear: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ notification, onClear }) => {
    if (!notification.message) return null;

    useEffect(() => {
        const timer = setTimeout(() => {
            onClear();
        }, 3000);
        return () => clearTimeout(timer);
    }, [notification, onClear]);

    const bgColor = notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : 'bg-blue-500';

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-lg text-white shadow-lg z-50 ${bgColor} animate-slideInFromRight print-hidden`}>
            {notification.message}
        </div>
    );
};

// --- Modals ---

interface ConfirmModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
    confirmDisabled?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ show, onClose, onConfirm, title, children, confirmDisabled = false }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn print-hidden">
            <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-sm animate-scaleIn shadow-lg">
                <h3 className="text-xl font-bold text-[var(--color-primary)] mb-4">{title}</h3>
                <div className="text-text-secondary mb-6">{children}</div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-transform active:scale-95">Cancelar</button>
                    <button onClick={onConfirm} disabled={confirmDisabled} className="bg-red-600 font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-transform active:scale-95 disabled:bg-gray-500 disabled:cursor-not-allowed">Confirmar</button>
                </div>
            </div>
        </div>
    );
};


interface AllProductsModalProps {
    show: boolean;
    onClose: () => void;
    products: Product[];
}

export const AllProductsModal: React.FC<AllProductsModalProps> = ({ show, onClose, products }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn print-hidden">
            <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-lg animate-scaleIn shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] flex items-center gap-2">
                        <ShoppingCart /> Todos los Productos
                    </h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {products.length > 0 ? products.map(p => (
                        <li key={p.id} className="flex justify-between items-center p-3 bg-bg-primary rounded-md">
                            <div>
                                <span className="font-medium text-text-primary">{p.name}</span>
                                <p className="text-xs text-text-secondary">{p.category}</p>
                            </div>
                            <span className="font-bold text-text-primary">
                                {p.quantity} <span className="text-sm text-text-secondary">{p.unit}</span>
                            </span>
                        </li>
                    )) : (
                        <p className="text-text-secondary text-center py-8">No hay productos en el inventario.</p>
                    )}
                </ul>
            </div>
        </div>
    );
};

interface StockStatusModalProps {
    show: boolean;
    onClose: () => void;
    products: Product[];
    status: 'Stock Óptimo' | 'Stock Bajo' | 'Agotado' | null;
}
export const StockStatusModal: React.FC<StockStatusModalProps> = ({ show, onClose, products, status }) => {
    if (!show || !status) return null;

    const getStatusProducts = () => {
        switch (status) {
            case 'Stock Óptimo':
                return products.filter(p => p.quantity > p.minStock);
            case 'Stock Bajo':
                return products.filter(p => p.quantity <= p.minStock && p.quantity > 0);
            case 'Agotado':
                return products.filter(p => p.quantity === 0);
            default:
                return [];
        }
    };

    const statusProducts = getStatusProducts();
    const title = `Productos con ${status}`;
    const titleIcon = {
        'Stock Óptimo': <ShoppingCart className="text-green-500" />,
        'Stock Bajo': <Bell className="text-yellow-500" />,
        'Agotado': <AlertTriangle className="text-red-500" />
    }[status];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn print-hidden">
            <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-lg animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] flex items-center gap-2">
                        {titleIcon} {title}
                    </h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>
                <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {statusProducts.length > 0 ? statusProducts.map(p => (
                        <li key={p.id} className="flex justify-between items-center p-3 bg-bg-primary rounded-md">
                            <div>
                                <span className="font-medium text-text-primary">{p.name}</span>
                                <p className="text-xs text-text-secondary">{p.category}</p>
                            </div>
                            <span className="font-bold text-text-primary">
                                {p.quantity} <span className="text-sm text-text-secondary">{p.unit}</span>
                            </span>
                        </li>
                    )) : (
                        <p className="text-text-secondary text-center py-8">No hay productos en este estado.</p>
                    )}
                </ul>
            </div>
        </div>
    );
};


interface LowAndOutOfStockModalProps {
    show: boolean;
    onClose: () => void;
    products: Product[];
    category?: string;
}

export const LowAndOutOfStockModal: React.FC<LowAndOutOfStockModalProps> = ({ show, onClose, products, category }) => {
    if (!show) return null;

    const lowStockProducts = products.filter(p => {
        const isLow = p.quantity <= p.minStock && p.quantity > 0;
        return category ? isLow && p.category === category : isLow;
    });

    const outOfStockProducts = products.filter(p => {
        const isOutOfStock = p.quantity === 0;
        return category ? isOutOfStock && p.category === category : isOutOfStock;
    });

    const title = `Alerta de Stock${category ? ` en ${category}` : ''}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn print-hidden">
            <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-lg animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] flex items-center gap-2">
                        <Bell className="text-yellow-500" /> {title}
                    </h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                        <X size={24} />
                    </button>
                </div>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {outOfStockProducts.length > 0 && (
                        <div>
                            <h4 className="text-lg font-semibold text-red-500 mb-2 flex items-center gap-2">
                                <AlertTriangle size={20} /> Agotados ({outOfStockProducts.length})
                            </h4>
                            <ul className="space-y-2">
                                {outOfStockProducts.map(p => (
                                    <li key={p.id} className="flex justify-between items-center p-3 bg-bg-primary rounded-md">
                                        <div>
                                            <span className="font-medium text-text-primary">{p.name}</span>
                                            <p className="text-xs text-text-secondary">{p.category}</p>
                                        </div>
                                        <span className="font-bold text-red-500">
                                            AGOTADO
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {lowStockProducts.length > 0 && (
                         <div>
                            <h4 className="text-lg font-semibold text-yellow-500 mb-2 mt-4">
                                Bajo Stock ({lowStockProducts.length})
                            </h4>
                            <ul className="space-y-2">
                                {lowStockProducts.map(p => (
                                    <li key={p.id} className="flex justify-between items-center p-3 bg-bg-primary rounded-md">
                                        <div>
                                            <span className="font-medium text-text-primary">{p.name}</span>
                                            <p className="text-xs text-text-secondary">Mínimo: {p.minStock}</p>
                                        </div>
                                        <span className="font-bold text-yellow-500">
                                            {p.quantity} <span className="text-sm text-text-secondary">{p.unit}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                     {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
                        <p className="text-text-secondary text-center py-8">No hay productos con bajo stock o agotados.</p>
                     )}
                </div>
            </div>
        </div>
    );
};

interface MovementDetailModalProps {
    show: boolean;
    onClose: () => void;
    movement: Movement | null;
    product: Product | null;
    onCancelMovement: (productId: string, movement: Movement) => void;
}
export const MovementDetailModal: React.FC<MovementDetailModalProps> = ({ show, onClose, movement, product, onCancelMovement }) => {
    if (!show || !movement || !product) return null;

    const isEntrada = movement.type === 'entrada';
    const title = isEntrada ? 'Detalle de Entrada' : 'Detalle de Salida';
    const buttonText = isEntrada ? 'Anular Entrada' : 'Anular Salida';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn print-hidden">
            <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-md animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)] flex items-center gap-2">
                        <Info size={22} /> {title}
                    </h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>
                <div className="space-y-3 text-text-secondary">
                    <p><strong>Producto:</strong> <span className="text-text-primary">{product.name}</span></p>
                    <p><strong>Tipo:</strong> <span className={`font-bold ${isEntrada ? 'text-green-400' : 'text-red-400'}`}>{movement.type.toUpperCase()}</span></p>
                    <p><strong>Cantidad:</strong> <span className="font-mono text-text-primary">{movement.amount} {movement.unit}</span></p>
                    <p><strong>Fecha:</strong> <span className="text-text-primary">{new Date(movement.date).toLocaleString('es-VE')}</span></p>
                    {movement.source && <p><strong>Origen:</strong> <span className="text-text-primary">{movement.source}</span></p>}
                    {movement.destination && <p><strong>Destino:</strong> <span className="text-text-primary">{movement.destination}</span></p>}
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--color-border)] text-sm">
                    <p className="text-text-secondary">Stock actual del producto: <span className="font-bold text-text-primary">{product.quantity} {product.unit}</span></p>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg hover:bg-gray-700">Cerrar</button>
                    <button 
                        onClick={() => onCancelMovement(product.id, movement)} 
                        className="bg-red-600 font-bold py-2 px-4 rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                        <RotateCcw size={18} /> {buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
};


interface ProductOutputModalProps {
    product: Product | null;
    onClose: () => void;
    onConfirm: (productId: string, amount: number, unit: string, destination: string) => void;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ProductOutputModal: React.FC<ProductOutputModalProps> = ({ product, onClose, onConfirm, showNotification }) => {
    const [quantity, setQuantity] = useState('1');
    const [destination, setDestination] = useState(DESTINATION_OPTIONS[1]); // Default to 'Cocina'

    useEffect(() => {
        if (product) {
            setQuantity('1');
            setDestination(DESTINATION_OPTIONS[1]);
        }
    }, [product]);

    if (!product) return null;

    const handleConfirm = () => {
        const amount = parseFloat(quantity);
        if (isNaN(amount) || amount <= 0) {
            showNotification('Por favor, introduce una cantidad válida.', 'error');
            return;
        }
        if (amount > product.quantity) {
            showNotification(`Stock insuficiente. Solo quedan ${product.quantity} ${product.unit}.`, 'error');
            return;
        }
        onConfirm(product.id, amount, product.unit, destination);
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*\.?\d*$/.test(value)) {
            setQuantity(value);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="bg-bg-secondary rounded-lg p-6 w-full max-w-md animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[var(--color-primary)]">Registrar Salida de Producto</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary"><X size={24} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Producto</label>
                        <p className="bg-bg-primary p-2 rounded-md border border-[var(--color-border)]">{product.name}</p>
                        <p className="text-xs text-text-secondary mt-1">Stock actual: {product.quantity} {product.unit}</p>
                    </div>
                     <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-text-secondary mb-1">Cantidad a Retirar</label>
                        <input id="quantity" type="text" inputMode="decimal" value={quantity} onChange={handleQuantityChange} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]" />
                    </div>
                    <div>
                        <label htmlFor="destination" className="block text-sm font-medium text-text-secondary mb-1">Destino</label>
                        <select id="destination" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-bg-primary p-2 rounded-md border border-[var(--color-border)]">
                            {DESTINATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-600 font-bold py-2 px-4 rounded-lg hover:bg-gray-700">Cancelar</button>
                    <button onClick={handleConfirm} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700">
                        Confirmar Salida
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ActionConfirmationCardProps {
  action: GeminiAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({ action, onConfirm, onCancel }) => {
    const { name, args } = action;

    const renderDetails = () => {
        switch (name) {
            case 'add_stock':
                return (
                    <div>
                        <p><strong>Producto:</strong> {args.productName}</p>
                        <p><strong>Cantidad:</strong> <span className="text-green-400 font-bold">+{args.quantity} {args.unit}</span></p>
                    </div>
                );
            case 'remove_stock':
                return (
                    <div>
                        <p><strong>Producto:</strong> {args.productName}</p>
                        <p><strong>Cantidad:</strong> <span className="text-red-400 font-bold">-{args.quantity} {args.unit}</span></p>
                        <p><strong>Destino:</strong> {args.destination}</p>
                    </div>
                );
            case 'create_invoice':
                return (
                     <div>
                        <p><strong>Proveedor:</strong> {args.provider}</p>
                        <p><strong>Nº Factura:</strong> {args.invoiceNumber}</p>
                        <p><strong>Total:</strong> <span className="font-bold">${args.totalAmount?.toFixed(2)}</span></p>
                        <p className="mt-2 font-semibold">Items:</p>
                        <ul className="list-disc list-inside text-sm">
                            {args.items?.map((item: any, i: number) => <li key={i}>{item.quantity} {item.unit} de {item.productName}</li>)}
                        </ul>
                    </div>
                );
            case 'create_requisition':
                 return (
                    <div>
                        <p><strong>Departamento:</strong> {args.department}</p>
                        <p className="mt-2 font-semibold">Items a solicitar:</p>
                        <ul className="list-disc list-inside text-sm">
                            {args.items?.map((item: any, i: number) => <li key={i}>{item.quantity} {item.unit} de {item.productName}</li>)}
                        </ul>
                    </div>
                );
            default:
                return <p>Acción desconocida.</p>;
        }
    };

    const getTitle = () => {
        const titles: { [key: string]: string } = {
            add_stock: "Entrada de Stock",
            remove_stock: "Salida de Stock",
            create_invoice: "Crear Factura",
            create_requisition: "Crear Requisición"
        };
        return titles[name] || "Confirmar Acción";
    };

    return (
        <div className="max-w-lg p-4 rounded-lg bg-bg-secondary border border-[var(--color-primary)] shadow-lg">
            <div className="flex items-start gap-3">
                <AlertTriangle className="text-[var(--color-primary)] mt-1 flex-shrink-0" size={24}/>
                <div>
                    <h4 className="font-bold text-lg text-[var(--color-primary)]">Confirmar Acción: {getTitle()}</h4>
                    <p className="text-sm text-text-secondary mb-3">El asistente quiere realizar la siguiente acción. Por favor, revisa los detalles y confirma.</p>
                    <div className="bg-bg-primary p-3 rounded-md text-sm space-y-1 mb-4">
                        {renderDetails()}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={onCancel} className="bg-gray-600 font-bold py-2 px-4 rounded-lg hover:bg-gray-700">Cancelar</button>
                        <button onClick={onConfirm} className="bg-green-600 font-bold py-2 px-4 rounded-lg hover:bg-green-700">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};