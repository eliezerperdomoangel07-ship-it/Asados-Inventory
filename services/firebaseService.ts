import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// --- Firebase Configuration ---
// These will be replaced by the build environment.
// Using placeholders to prevent app crash when environment variables are not set.
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "api-key-placeholder",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "project-id.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "project-id",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "project-id.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "sender-id",
    appId: process.env.FIREBASE_APP_ID || "app-id"
};
export const appId = process.env.APP_ID || 'default-asados-app';

const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "api-key-placeholder";

let app: firebase.app.App;
let db: firebase.firestore.Firestore;
let auth: firebase.auth.Auth;
let Timestamp: typeof firebase.firestore.Timestamp;
let serverTimestamp: () => firebase.firestore.FieldValue | Date;


if (isFirebaseConfigured) {
    // --- Initialize Real Firebase ---
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    Timestamp = firebase.firestore.Timestamp;
    serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;
} else {
    // --- MOCK IMPLEMENTATION for Demo Mode ---
    console.warn("Firebase API key not provided or is a placeholder. Running in offline/demo mode. No data will be saved.");

    auth = {
        onAuthStateChanged: (callback: any) => {
            setTimeout(() => callback({ uid: 'demo-user-uid', isAnonymous: true }), 50); // Simulate async
            return () => {}; // Return an unsubscribe function
        },
        signInAnonymously: () => Promise.resolve({
            user: { uid: 'demo-user-uid', isAnonymous: true }
        }),
        currentUser: { uid: 'demo-user-uid' },
    } as any;

    db = {
        collection: (path: string) => ({
            onSnapshot: (callback: any) => {
                setTimeout(() => callback({ docs: [], empty: true, forEach: () => {} }), 50);
                return () => {};
            },
            get: () => Promise.resolve({ docs: [], empty: true, forEach: () => {} }),
            add: (data: any) => {
                console.log(`[DEMO MODE] Would add to ${path}:`, data);
                return Promise.resolve({ id: `mock-${Date.now()}` });
            },
            doc: (docId: string) => ({
                delete: () => {
                    console.log(`[DEMO MODE] Would delete ${path}/${docId}`);
                    return Promise.resolve();
                },
                update: (data: any) => {
                    console.log(`[DEMO MODE] Would update ${path}/${docId}:`, data);
                    return Promise.resolve();
                },
                get: () => Promise.resolve({ exists: false, data: () => undefined }),
                set: (data: any) => {
                    console.log(`[DEMO MODE] Would set ${path}/${docId}:`, data);
                    return Promise.resolve();
                },
            }),
            where: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [], empty: true, forEach: () => {} }) }) }),
            orderBy: () => ({ limit: () => ({ onSnapshot: (cb: any) => { setTimeout(() => cb({ docs: [], empty: true }), 50); return () => {}; } }) })
        }),
        batch: () => ({
            set: () => {}, update: () => {},
            commit: () => {
                console.log(`[DEMO MODE] Batch commit`);
                return Promise.resolve();
            },
        }),
    } as any;
    
    Timestamp = {
        now: () => new Date(),
        fromDate: (date: Date) => date,
        toDate: () => new Date(),
    } as any;

    serverTimestamp = () => new Date();
}


// --- Sample Data Seeding ---
export const seedDatabase = async () => {
    if (!isFirebaseConfigured) {
        console.log("[DEMO MODE] Skipping database seeding.");
        return;
    }
    // Seed Products
    const productsCollectionRef = db.collection(`artifacts/${appId}/public/data/inventory`);
    let productsSnapshot = await productsCollectionRef.get();
    if (productsSnapshot.empty) {
        console.log("No products found. Seeding database...");
        const batch = db.batch();
        const sampleProducts = [
            // Carnes
            { name: 'Suprema de Pollo', quantity: 25, unit: 'kg', minStock: 10, category: 'Carnes' },
            { name: 'Lomito', quantity: 15, unit: 'kg', minStock: 5, category: 'Carnes' },
            { name: 'Lomo de Cerdo', quantity: 12, unit: 'kg', minStock: 5, category: 'Carnes' },
            { name: 'Solomo', quantity: 18, unit: 'kg', minStock: 8, category: 'Carnes' },
            { name: 'Carne para Hamburguesa', quantity: 20.75, unit: 'kg', minStock: 5, category: 'Carnes' },
            { name: 'Chorizo', quantity: 15, unit: 'kg', minStock: 4, category: 'Carnes' },
            { name: 'Carne de Parrilla (Punta)', quantity: 0, unit: 'kg', minStock: 5, category: 'Carnes' },
            
            // Verduras
            { name: 'Tomate', quantity: 15.5, unit: 'kg', minStock: 4, category: 'Verduras' },
            { name: 'Lechuga', quantity: 0, unit: 'cestas', minStock: 2, category: 'Verduras' },
            { name: 'Cebolla', quantity: 2, unit: 'sacos', minStock: 1, category: 'Verduras' },

            // Despensa
            { name: 'Pan de Hamburguesa', quantity: 100, unit: 'unidades', minStock: 20, category: 'Despensa' },
            { name: 'Queso Amarillo', quantity: 10, unit: 'kg', minStock: 2, category: 'Despensa' },
            { name: 'Papas Fritas Congeladas', quantity: 25, unit: 'kg', minStock: 10, category: 'Despensa' },
            { name: 'Refresco 2L', quantity: 50, unit: 'botellas', minStock: 15, category: 'Despensa' },
            { name: 'Masa de Pizza', quantity: 30, unit: 'unidades', minStock: 10, category: 'Despensa' },
            { name: 'Salsa para Pizza', quantity: 10, unit: 'litros', minStock: 3, category: 'Despensa' },
            { name: 'Helado de Chocolate', quantity: 4.5, unit: 'litros', minStock: 2, category: 'Despensa' },
            { name: 'Aceite', quantity: 10, unit: 'litros', minStock: 3, category: 'Despensa' },
            { name: 'Arroz', quantity: 20, unit: 'kg', minStock: 5, category: 'Despensa' },
            { name: 'Harina P.A.N.', quantity: 20, unit: 'kg', minStock: 5, category: 'Despensa' },

            // Licores
            { name: 'Cerveza Polar', quantity: 120, unit: 'unidades', minStock: 24, category: 'Licores' },
            { name: 'Ron Cacique', quantity: 12, unit: 'botellas', minStock: 3, category: 'Licores' },
            { name: 'Whisky Old Parr', quantity: 6, unit: 'botellas', minStock: 2, category: 'Licores' },
        ];
        sampleProducts.forEach(p => {
            const docRef = db.collection(`artifacts/${appId}/public/data/inventory`).doc();
            batch.set(docRef, { ...p, history: [{ type: 'entrada', amount: p.quantity, unit: p.unit, date: new Date().toISOString() }], createdAt: new Date().toISOString() });
        });
        await batch.commit();
        console.log("Products seeded!");
        productsSnapshot = await productsCollectionRef.get(); // Re-fetch after seeding
    }

    // Seed Requisitions
    const requisitionsCollectionRef = db.collection(`artifacts/${appId}/public/data/requisitions`);
    const requisitionsSnapshot = await requisitionsCollectionRef.get();
    if (requisitionsSnapshot.empty && !productsSnapshot.empty) {
        console.log("No requisitions found. Seeding...");
        const products = productsSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
        const tomate = products.find(p => p.name === 'Tomate');
        const carne = products.find(p => p.name === 'Carne para Hamburguesa');
        const pan = products.find(p => p.name === 'Pan de Hamburguesa');
        const refresco = products.find(p => p.name === 'Refresco 2L');
        const masaPizza = products.find(p => p.name === 'Masa de Pizza');
        const helado = products.find(p => p.name === 'Helado de Chocolate');

        const batch = db.batch();
        const sampleRequisitions = [
            { department: 'Cocina', status: 'pending', createdAt: Timestamp.now(), items: [ { productId: carne.id, productName: carne.name, requestedQuantity: 5, unit: 'kg' }, { productId: tomate.id, productName: tomate.name, requestedQuantity: 2, unit: 'kg' }, { productId: pan.id, productName: pan.name, requestedQuantity: 20, unit: 'unidades' } ] },
            { department: 'Barra', status: 'pending', createdAt: Timestamp.now(), items: [ { productId: refresco.id, productName: refresco.name, requestedQuantity: 10, unit: 'botellas' } ] },
            { department: 'Pizzería', status: 'completed', createdAt: Timestamp.now(), items: [ { productId: masaPizza.id, productName: masaPizza.name, requestedQuantity: 15, deliveredQuantity: 15, unit: 'unidades', observation: 'Todo OK' } ] },
            { department: 'Heladería', status: 'pending', createdAt: Timestamp.now(), items: [ { productId: helado.id, productName: helado.name, requestedQuantity: 5, unit: 'litros' } ] }
        ];

        sampleRequisitions.forEach(req => {
            const docRef = db.collection(`artifacts/${appId}/public/data/requisitions`).doc();
            batch.set(docRef, req);
        });
        await batch.commit();
        console.log("Requisitions seeded!");
    }
    
    // Seed Invoices
    const invoicesCollectionRef = db.collection(`artifacts/${appId}/public/data/invoices`);
    const invoicesSnapshot = await invoicesCollectionRef.get();
    if (invoicesSnapshot.empty) {
        console.log("No invoices found. Seeding...");
        const batch = db.batch();
        const sampleInvoices = [
            { invoiceNumber: 'FC-001', provider: 'Carnicería El Toro', date: Timestamp.fromDate(new Date()), totalAmount: 150.75, status: 'paid', source: 'manual', items: [{ productName: 'Carne de Parrilla (Punta)', quantity: 10, unit: 'kg', price: 15.075 }]},
            { invoiceNumber: 'FC-002', provider: 'Verduras Frescas C.A.', date: Timestamp.fromDate(new Date()), totalAmount: 75.50, status: 'pending', source: 'whatsapp', rawText: 'Factura de Verduras Frescas: 5 cestas de lechuga, 10kg tomate. Total 75.50', items: [{ productName: 'Lechuga', quantity: 5, unit: 'cestas', price: 50 }, { productName: 'Tomate', quantity: 10, unit: 'kg', price: 25.50 }]}
        ];
        sampleInvoices.forEach(inv => {
            const docRef = db.collection(`artifacts/${appId}/public/data/invoices`).doc();
            batch.set(docRef, inv);
        });
        await batch.commit();
        console.log("Invoices seeded!");
    }
};

export { db, auth, Timestamp, serverTimestamp };