import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import * as Views from './components/views';
import { Sidebar, MobileNav, Notification, ConfirmModal, MovementDetailModal, ProductOutputModal } from './components/ui';
import { Product, Requisition, RequisitionItem, Invoice, Provider, ViewType, NotificationType, Movement, Production, AppSettings, AppPermissions } from './types';
import { 
    auth, db, appId, seedDatabase,
    Timestamp, serverTimestamp
} from './services/firebaseService';

const defaultSettings: AppSettings = {
    theme: 'dark',
    role: 'jefe'
};

const getPermissionsFromRole = (role: AppSettings['role']): AppPermissions => {
    switch (role) {
        case 'jefe':
            return {
                canAccessSettings: true,
                canDeleteProducts: true,
                canProcessRequisitions: true,
                canCreateProductions: true,
                canManuallyAdjustStock: true,
                canViewFullHistory: true,
            };
        case 'inventario':
            return {
                canAccessSettings: false,
                canDeleteProducts: true,
                canProcessRequisitions: true,
                canCreateProductions: true,
                canManuallyAdjustStock: true,
                canViewFullHistory: true,
            };
        case 'almacenista':
            return {
                canAccessSettings: false,
                canDeleteProducts: false,
                canProcessRequisitions: true,
                canCreateProductions: true,
                canManuallyAdjustStock: false, // Key restriction
                canViewFullHistory: false,
            };
        default:
            // Default to most restrictive for safety
            return getPermissionsFromRole('almacenista');
    }
};


export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [productions, setProductions] = useState<Production[]>([]);
    const [view, setView] = useState<ViewType>('dashboard');
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationType>({ message: '', type: 'success' });
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', children: null as React.ReactNode, onConfirm: () => {}, confirmDisabled: false });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const savedSettings = localStorage.getItem('appSettings');
            return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
        } catch (error) {
            return defaultSettings;
        }
    });
    
    const [movementModal, setMovementModal] = useState<{ show: boolean; movement: Movement | null; product: Product | null }>({ show: false, movement: null, product: null });
    
    const permissions = useMemo(() => getPermissionsFromRole(settings.role), [settings.role]);

    // --- Settings & Theme Effect ---
    useEffect(() => {
        localStorage.setItem('appSettings', JSON.stringify(settings));
        
        const body = document.body;
        if (settings.theme === 'light') {
            body.classList.add('light-theme');
        } else {
            body.classList.remove('light-theme');
        }
    }, [settings]);

    // --- Auth & Data Loading ---
    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                try {
                    await auth.signInAnonymously();
                } catch (error) {
                    console.error("Authentication Error:", error);
                    setLoading(false);
                }
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (user) {
            seedDatabase().catch(console.error);

            const productsQuery = db.collection(`artifacts/${appId}/public/data/inventory`);
            const unsubscribeProducts = productsQuery.onSnapshot((snapshot) => {
                const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
                productsData.sort((a, b) => a.name.localeCompare(b.name));
                setProducts(productsData);
                setLoading(false);
            }, (error) => console.error("Error fetching inventory: ", error));
            
            const reqsQuery = db.collection(`artifacts/${appId}/public/data/requisitions`);
            const unsubscribeReqs = reqsQuery.onSnapshot((snapshot) => {
                const reqsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));
                setRequisitions(reqsData);
            }, (error) => console.error("Error fetching requisitions: ", error));

            const invoicesQuery = db.collection(`artifacts/${appId}/public/data/invoices`);
            const unsubscribeInvoices = invoicesQuery.onSnapshot((snapshot) => {
                const invoicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
                invoicesData.sort((a, b) => b.date.seconds - a.date.seconds);
                setInvoices(invoicesData);
            }, (error) => console.error("Error fetching invoices: ", error));

            const providersQuery = db.collection(`artifacts/${appId}/public/data/providers`).orderBy("lastUsed", "desc").limit(5);
            const unsubscribeProviders = providersQuery.onSnapshot((snapshot) => {
                const providersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Provider));
                setProviders(providersData);
            }, (error) => console.error("Error fetching providers: ", error));
            
            const productionsQuery = db.collection(`artifacts/${appId}/public/data/productions`);
            const unsubscribeProductions = productionsQuery.onSnapshot((snapshot) => {
                const productionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Production));
                setProductions(productionsData);
            }, (error) => console.error("Error fetching productions: ", error));

            return () => {
                unsubscribeProducts();
                unsubscribeReqs();
                unsubscribeInvoices();
                unsubscribeProviders();
                unsubscribeProductions();
            };
        }
    }, [user]);

    // --- Handlers ---
    const showNotification = (message: string, type: NotificationType['type'] = 'success') => {
        setNotification({ message, type });
    };

    const handleCloseConfirmModal = () => {
        setConfirmModal({ show: false, title: '', children: null, onConfirm: () => {}, confirmDisabled: false });
    };
    
    const handleMovementClick = (movement: Movement) => {
        const product = products.find(p => p.id === movement.productId);
        if (product) {
            setMovementModal({ show: true, movement, product });
        }
    };

    const handleCancelMovement = async (productId: string, movementToCancel: Movement) => {
        if (movementToCancel.type.startsWith('anulacion_') || movementToCancel.cancelled) {
            showNotification('Este movimiento ya fue anulado o es una anulación.', 'error');
            setMovementModal({ show: false, movement: null, product: null });
            return;
        }

        const productRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc(productId);
        try {
            const productDoc = await productRef.get();
            if (!productDoc.exists) throw new Error("El producto no existe.");
            
            const product = productDoc.data() as Product;
            const adjustment = movementToCancel.type === 'entrada' ? -movementToCancel.amount : movementToCancel.amount;
            const newQuantity = product.quantity + adjustment;

            if (newQuantity < 0) {
                showNotification(`Anular este movimiento resultaría en stock negativo (${newQuantity}). Acción no permitida.`, 'error');
                return;
            }

            const newHistory = (product.history || []).map(h => {
                if (h.date === movementToCancel.date && h.amount === movementToCancel.amount && h.type === movementToCancel.type && !h.cancelled) {
                    return { ...h, cancelled: true };
                }
                return h;
            });
            
            const newMovementType = `anulacion_${movementToCancel.type}`;

            newHistory.push({
                type: newMovementType as 'anulacion_entrada' | 'anulacion_salida',
                amount: movementToCancel.amount,
                unit: movementToCancel.unit,
                date: new Date().toISOString(),
                cancelledMovementDate: movementToCancel.date,
                source: 'anulacion_manual'
            });

            await productRef.update({ quantity: newQuantity, history: newHistory });
            showNotification('Movimiento anulado con éxito.', 'success');
            setMovementModal({ show: false, movement: null, product: null });

        } catch (error) {
            const err = error as Error;
            console.error("Error cancelling movement:", err);
            showNotification(err.message || 'Error al anular el movimiento.', 'error');
        }
    };

    const handleAddProduct = async (productData: Omit<Product, 'id'|'history'|'createdAt'>) => {
        try {
            const newProduct = {
                ...productData,
                name: productData.name.trim(),
                quantity: Number(productData.quantity) || 0,
                minStock: Number(productData.minStock) || 5,
                history: [{ type: 'entrada', amount: Number(productData.quantity) || 0, unit: productData.unit, date: new Date().toISOString() }],
                createdAt: new Date().toISOString()
            };
            await db.collection(`artifacts/${appId}/public/data/inventory`).add(newProduct);
            showNotification(`Producto "${newProduct.name}" añadido.`, 'success');
        } catch (error) {
            console.error("Error adding product: ", error);
            showNotification('Error al añadir producto.', 'error');
        }
    };

    const handleUpdateQuantity = async (id: string, amount: number, transactionUnit: string, destinationOrSource = 'ajuste_manual') => {
        const product = products.find(p => p.id === id);
        if (!product) throw new Error(`Product with id ${id} not found.`);
        
        const newQuantity = product.quantity + amount;
        if (newQuantity < 0) {
            showNotification(`No hay suficiente stock de "${product.name}".`, 'error');
            throw new Error(`Not enough stock for ${product.name}.`);
        }

        const historyEntry: Partial<Movement> = {
            type: amount > 0 ? 'entrada' : 'salida',
            amount: Math.abs(amount),
            unit: transactionUnit,
            date: new Date().toISOString(),
        };
        
        if (amount < 0) {
            historyEntry.destination = destinationOrSource;
        } else {
            historyEntry.source = destinationOrSource;
        }

        const productRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc(id);
        try {
            await productRef.update({
                quantity: newQuantity,
                history: [...(product.history || []), historyEntry]
            });
            const action = amount > 0 ? 'Entrada' : 'Salida';
            if (!destinationOrSource.includes('ajuste_manual')) {
                 showNotification(`${action} registrada para "${product.name}".`, 'info');
            }
        } catch (error) {
            console.error("Error updating quantity:", error);
            showNotification('Error al actualizar el stock.', 'error');
            throw error;
        }
    };

    const handleDeleteProduct = (id: string, name: string) => {
        setConfirmModal({
            show: true,
            title: 'Eliminar Producto',
            children: <p>¿Estás seguro de que quieres eliminar <strong>{name}</strong>? Esta acción no se puede deshacer.</p>,
            onConfirm: async () => {
                try {
                    await db.collection(`artifacts/${appId}/public/data/inventory`).doc(id).delete();
                    showNotification(`Producto "${name}" eliminado.`, 'success');
                } catch (error) {
                    console.error("Error deleting product:", error);
                    showNotification('Error al eliminar producto.', 'error');
                }
                handleCloseConfirmModal();
            },
            confirmDisabled: !permissions.canDeleteProducts
        });
    };

    const handleCreateRequisition = async (requisitionData: { department: string; items: { productName: string; quantity: number; unit: string }[] }) => {
        try {
            const itemsWithIds = requisitionData.items.map(item => {
                const product = products.find(p => p.name.toLowerCase() === item.productName.toLowerCase());
                if (!product) throw new Error(`Producto no encontrado: ${item.productName}`);
                return { 
                    productId: product.id,
                    productName: product.name,
                    requestedQuantity: item.quantity,
                    unit: item.unit
                };
            });

            await db.collection(`artifacts/${appId}/public/data/requisitions`).add({
                department: requisitionData.department,
                items: itemsWithIds,
                status: 'pending',
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.uid || 'anonymous'
            });
            showNotification('Requisición creada con éxito.', 'success');
        } catch (error) {
            const err = error as Error;
            console.error("Error creating requisition:", err);
            showNotification(err.message || 'Error al crear la requisición.', 'error');
            throw error;
        }
    };

    const handleProcessRequisition = async (requisitionId: string, processedItems: { [productId: string]: { deliveredQuantity: string; observation: string } }) => {
        const batch = db.batch();
        const requisition = requisitions.find(r => r.id === requisitionId);
        if (!requisition) return;

        const updatedItems: RequisitionItem[] = [];

        for (const item of requisition.items) {
            const product = products.find(p => p.id === item.productId);
            const processedInfo = processedItems[item.productId];
            const deliveredQuantity = Number(processedInfo?.deliveredQuantity);

            if (isNaN(deliveredQuantity) || deliveredQuantity < 0) {
                 showNotification(`Cantidad inválida para ${item.productName}.`, 'error');
                 return;
            }

            if (product && deliveredQuantity > 0) {
                const newQuantity = product.quantity - deliveredQuantity;
                if (newQuantity < 0) {
                    showNotification(`Stock insuficiente para "${product.name}". No se puede procesar.`, 'error');
                    return;
                }
                
                const productRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc(product.id);
                const historyEntry: Movement = {
                    type: 'salida',
                    amount: deliveredQuantity,
                    unit: item.unit,
                    date: new Date().toISOString(),
                    destination: requisition.department
                };
                batch.update(productRef, {
                    quantity: newQuantity,
                    history: [...(product.history || []), historyEntry]
                });
            }
            
            updatedItems.push({ ...item, deliveredQuantity, observation: processedInfo?.observation || '' });
        }

        const requisitionRef = db.collection(`artifacts/${appId}/public/data/requisitions`).doc(requisitionId);
        batch.update(requisitionRef, { status: 'completed', processedAt: serverTimestamp(), items: updatedItems });

        try {
            await batch.commit();
            showNotification('Requisición procesada y stock actualizado.', 'success');
        } catch (error) {
            console.error("Error processing requisition:", error);
            showNotification('Error al procesar la requisición.', 'error');
        }
    };
    
    const handleCreateProduction = async (data: Omit<Production, 'id' | 'date' | 'createdBy'>) => {
        const batch = db.batch();

        // 1. Decrement raw material
        const rawMaterialRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc(data.rawMaterialId);
        const rawMaterialProduct = products.find(p => p.id === data.rawMaterialId);
        if (!rawMaterialProduct) throw new Error("Materia prima no encontrada.");

        const newRawMaterialQty = rawMaterialProduct.quantity - data.rawMaterialQuantityUsed;
        if (newRawMaterialQty < 0) throw new Error(`Stock insuficiente para ${data.rawMaterialName}`);
        
        const rawMaterialHistory: Movement = {
            type: 'salida',
            amount: data.rawMaterialQuantityUsed,
            unit: data.rawMaterialUnit,
            date: new Date().toISOString(),
            destination: 'Producción'
        };
        batch.update(rawMaterialRef, {
            quantity: newRawMaterialQty,
            history: [...(rawMaterialProduct.history || []), rawMaterialHistory]
        });

        // 2. Increment or create output products
        for (const output of data.outputs) {
            const existingProduct = products.find(p => p.name.toLowerCase() === output.productName.toLowerCase());
            
            if (existingProduct) {
                const productRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc(existingProduct.id);
                const newQty = existingProduct.quantity + output.quantity;
                const historyEntry: Movement = { type: 'entrada', amount: output.quantity, unit: output.unit, date: new Date().toISOString(), source: 'Producción' };
                batch.update(productRef, {
                    quantity: newQty,
                    history: [...(existingProduct.history || []), historyEntry]
                });
            } else {
                const newProductRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc();
                const newProduct: Omit<Product, 'id'> = {
                    name: output.productName,
                    quantity: output.quantity,
                    unit: output.unit,
                    category: output.category || 'Producción',
                    minStock: 0,
                    history: [{ type: 'entrada', amount: output.quantity, unit: output.unit, date: new Date().toISOString(), source: 'Producción' }],
                    createdAt: new Date().toISOString()
                };
                batch.set(newProductRef, newProduct);
            }
        }
        
        // 3. Create production record
        const productionRecordRef = db.collection(`artifacts/${appId}/public/data/productions`).doc();
        const newRecord: Omit<Production, 'id'> = {
            ...data,
            date: Timestamp.now(),
            createdBy: user?.uid || 'anonymous'
        };
        batch.set(productionRecordRef, newRecord);

        await batch.commit();
        showNotification('Producción registrada con éxito. El stock ha sido actualizado.', 'success');
    };

    const handleCreateInvoice = async (invoiceData: Omit<Invoice, 'id'>) => {
        try {
            await db.collection(`artifacts/${appId}/public/data/invoices`).add(invoiceData);
            showNotification(`Factura #${invoiceData.invoiceNumber} guardada con éxito.`, 'success');
        } catch (error) {
            console.error("Error creating final invoice:", error);
            showNotification('Error al guardar la factura.', 'error');
            throw error;
        }
    };

    const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: 'paid' | 'pending') => {
        const invoiceRef = db.collection(`artifacts/${appId}/public/data/invoices`).doc(invoiceId);
        try {
            await invoiceRef.update({ status: newStatus });
            showNotification('Estado de la factura actualizado.', 'success');
        } catch (error) {
            console.error("Error updating invoice status:", error);
            showNotification('Error al actualizar la factura.', 'error');
        }
    };

    const handleSaveOrUpdateProvider = async (name: string, phone: string) => {
        if (!name.trim() || !phone.trim()) return;
        const providersRef = db.collection(`artifacts/${appId}/public/data/providers`);
        const q = providersRef.where("phone", "==", phone).limit(1);
        
        try {
            const querySnapshot = await q.get();
            if (!querySnapshot.empty) {
                const providerDoc = querySnapshot.docs[0];
                await providerDoc.ref.update({ name: name, lastUsed: serverTimestamp(), useCount: (providerDoc.data().useCount || 0) + 1 });
            } else {
                await providersRef.add({ name, phone, lastUsed: serverTimestamp(), useCount: 1 });
            }
        } catch (error) {
            console.error("Error saving or updating provider: ", error);
            showNotification('Error al guardar el proveedor.', 'error');
        }
    };

    const renderView = () => {
        const commonProps = {
            products,
            onUpdateQuantity: handleUpdateQuantity,
            showNotification,
            onMovementClick: handleMovementClick,
            permissions
        };

        switch(view) {
            case 'dashboard':
                return <Views.DashboardView {...commonProps} setView={setView} requisitions={requisitions} />;
            case 'pantry':
                return <Views.CategoryView {...commonProps} category="Despensa" onDeleteProduct={handleDeleteProduct} onAddProduct={handleAddProduct} />;
            case 'meats':
                return <Views.CategoryView {...commonProps} category="Carnes" onDeleteProduct={handleDeleteProduct} onAddProduct={handleAddProduct} />;
            case 'vegetables':
                return <Views.CategoryView {...commonProps} category="Verduras" onDeleteProduct={handleDeleteProduct} onAddProduct={handleAddProduct} />;
            case 'licores':
                return <Views.CategoryView {...commonProps} category="Licores" onDeleteProduct={handleDeleteProduct} onAddProduct={handleAddProduct} />;
            case 'productions':
                return <Views.ProductionsView {...commonProps} productions={productions} handleCreateProduction={handleCreateProduction} />;
            case 'stats':
                 return <Views.StatsView {...commonProps} />;
            case 'chatbot':
                return <Views.ChatbotView {...commonProps} invoices={invoices} handleCreateInvoice={handleCreateInvoice} handleCreateRequisition={handleCreateRequisition} />;
            case 'settings':
                if (!permissions.canAccessSettings) {
                    setView('dashboard'); // Redirect if no permission
                    return null;
                }
                return <Views.SettingsView showNotification={showNotification} settings={settings} setSettings={setSettings} />;
            case 'requisitions':
                return <Views.RequisitionsView 
                    products={products}
                    requisitions={requisitions}
                    showNotification={showNotification}
                    handleProcessRequisition={handleProcessRequisition}
                    handleCreateRequisition={handleCreateRequisition}
                    permissions={permissions}
                />;
            case 'orders':
                 return <Views.OrdersView 
                    products={products}
                    providers={providers}
                    showNotification={showNotification}
                    handleSaveOrUpdateProvider={handleSaveOrUpdateProvider}
                 />;
            case 'invoices':
                return <Views.InvoicesView 
                    invoices={invoices}
                    showNotification={showNotification}
                    handleCreateInvoice={handleCreateInvoice}
                    handleUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                />;
            case 'calendar':
                return <Views.CalendarView products={products} onMovementClick={handleMovementClick} />;
            case 'reports':
                return <Views.ReportsView products={products} />;
            default:
                return <Views.DashboardView {...commonProps} setView={setView} requisitions={requisitions} />;
        }
    }

    return (
        <div className="min-h-screen font-sans text-text-primary md:flex">
            <Sidebar setView={setView} view={view} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} permissions={permissions} />
            <div className="flex-1 flex flex-col min-w-0 bg-bg-primary">
                <MobileNav onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="text-center text-[var(--color-primary)] text-xl animate-pulse">Cargando datos...</div>
                        </div>
                    ) : (
                        renderView()
                    )}
                </main>
            </div>
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden print-hidden"></div>}
            
            <Notification notification={notification} onClear={() => setNotification({ message: '', type: 'success' })} />
            <ConfirmModal 
                show={confirmModal.show}
                onClose={handleCloseConfirmModal}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                confirmDisabled={confirmModal.confirmDisabled}
            >
                {confirmModal.children}
            </ConfirmModal>
            <MovementDetailModal
                show={movementModal.show}
                onClose={() => setMovementModal({ show: false, movement: null, product: null })}
                movement={movementModal.movement}
                product={movementModal.product}
                onCancelMovement={handleCancelMovement}
            />
        </div>
    );
}