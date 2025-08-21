
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Invoice } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set for Gemini. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = ai.models;

const chatbotToolDeclarations = [
    {
        "functionDeclarations": [
            {
                "name": "create_invoice", "description": "Crea una nueva factura de un proveedor.", "parameters": {
                    "type": Type.OBJECT, "properties": {
                        "provider": { "type": Type.STRING, "description": "El nombre del proveedor." },
                        "invoiceNumber": { "type": Type.STRING, "description": "El número de la factura." },
                        "totalAmount": { "type": Type.NUMBER, "description": "El monto total de la factura." },
                        "items": {
                            "type": Type.ARRAY, "description": "Lista de productos en la factura.", "items": {
                                "type": Type.OBJECT, "properties": {
                                    "productName": { "type": Type.STRING, "description": "Nombre del producto." },
                                    "quantity": { "type": Type.NUMBER, "description": "Cantidad del producto." },
                                    "unit": { "type": Type.STRING, "description": "Unidad de medida (ej. kg, unidades)." },
                                    "price": { "type": Type.NUMBER, "description": "Precio unitario del producto." }
                                }, "required": ["productName", "quantity", "unit", "price"]
                            }
                        }
                    }, "required": ["provider", "invoiceNumber", "totalAmount", "items"]
                }
            },
            {
                "name": "add_stock", "description": "Añade stock de un producto existente al inventario (entrada).", "parameters": {
                    "type": Type.OBJECT, "properties": {
                        "productName": { "type": Type.STRING, "description": "El nombre exacto del producto como está en el inventario." },
                        "quantity": { "type": Type.NUMBER, "description": "La cantidad a añadir." },
                        "unit": { "type": Type.STRING, "description": "La unidad de medida (ej. kg, unidades)." }
                    }, "required": ["productName", "quantity", "unit"]
                }
            },
            {
                "name": "remove_stock", "description": "Quita stock de un producto existente del inventario (salida).", "parameters": {
                    "type": Type.OBJECT, "properties": {
                        "productName": { "type": Type.STRING, "description": "El nombre exacto del producto como está en el inventario." },
                        "quantity": { "type": Type.NUMBER, "description": "La cantidad a quitar." },
                        "unit": { "type": Type.STRING, "description": "La unidad de medida (ej. kg, unidades)." },
                        "destination": { "type": Type.STRING, "description": "El destino del producto (ej. Cocina, Barra, Asador)." }
                    }, "required": ["productName", "quantity", "unit", "destination"]
                }
            },
            {
                "name": "create_requisition", "description": "Crea una nueva requisición de productos para un departamento.", "parameters": {
                    "type": Type.OBJECT, "properties": {
                        "department": { "type": Type.STRING, "description": "El departamento que solicita (ej. Cocina, Barra, Pizzería)." },
                        "items": {
                            "type": Type.ARRAY, "description": "Lista de productos solicitados.", "items": {
                                "type": Type.OBJECT, "properties": {
                                    "productName": { "type": Type.STRING, "description": "Nombre del producto." },
                                    "quantity": { "type": Type.NUMBER, "description": "Cantidad solicitada." },
                                    "unit": { "type": Type.STRING, "description": "Unidad de medida." }
                                }, "required": ["productName", "quantity", "unit"]
                            }
                        }
                    }, "required": ["department", "items"]
                }
            }
        ]
    }
];

export const generateShoppingRecommendation = async (days: number, products: Product[]): Promise<string> => {
    if (!process.env.API_KEY) return 'El servicio de IA no está configurado. Falta la API Key.';

    const prompt = `
        Eres un asistente de compras para el restaurante 'Asados Los Llanos'. Basado en los siguientes datos de inventario y consumo, genera una lista de compras para cubrir los próximos ${days} días.
        Considera que el consumo es 1.5 veces mayor los fines de semana (Viernes a Domingo).
        Da un breve saludo y luego presenta la lista de compras en formato markdown, agrupando por categorías como 'Carnes', 'Verduras', 'Despensa', etc. Sé directo, claro y amigable.

        Datos del Inventario (JSON):
        ${JSON.stringify(products, null, 2)}
    `;

    try {
        const response = await model.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                temperature: 0.5,
                topP: 0.95,
                topK: 64,
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error generating shopping recommendation:", error);
        return "Hubo un error al conectar con el asistente de IA. Por favor, inténtalo de nuevo más tarde.";
    }
};

export const getChatbotResponse = async (input: string, products: Product[], invoices: Invoice[]) => {
    if (!process.env.API_KEY) return { text: 'El servicio de IA no está configurado. Falta la API Key.' };
    
    const prompt = `
        Eres un asistente de IA para el restaurante "Asados Los Llanos". Tu tarea es responder preguntas sobre el inventario y las facturas basándote en los datos que te proporciono, o realizar acciones en el inventario usando las herramientas disponibles. Sé conciso y amigable.
        Aquí están los datos del inventario actual en formato JSON: ${JSON.stringify(products)}
        Aquí están los datos de las facturas en formato JSON: ${JSON.stringify(invoices.map(inv => ({...inv, date: inv.date.toDate().toISOString()})))}
        
        Pregunta/Orden del usuario: "${input}"

        Analiza la petición. Si es una pregunta, respóndela. Si es una orden que coincide con una de tus herramientas, llama a esa función con los argumentos correctos. No inventes datos. Si no encuentras un producto, infórmalo.
    `;
    
    try {
        const response = await model.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            tools: chatbotToolDeclarations,
        });

        const functionCalls = response.candidates?.[0]?.content?.parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);

        if (functionCalls && functionCalls.length > 0) {
            return {
                action: {
                    name: functionCalls[0].name,
                    args: functionCalls[0].args
                }
            };
        }

        return { text: response.text || 'No he podido procesar tu solicitud. ¿Puedes intentarlo de otra manera?' };

    } catch (error) {
        console.error("Error getting chatbot response:", error);
        return { text: "Hubo un error al conectar con el asistente de IA. Por favor, inténtalo de nuevo." };
    }
};
