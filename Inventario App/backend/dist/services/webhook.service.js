"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WisproWebhookService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../db");
const client_1 = require("@prisma/client");
class WisproWebhookService {
    /**
     * Persiste la alerta en el almacenamiento local del sistema y opcionalmente
     * notifica al servidor principal de Velocity para que el supervisor la vea en tiempo real.
     */
    static async recordSupervisorAlert(message, mac, details = {}) {
        console.warn(`[Wispro Webhook 🚨 ALERTA SUPERVISOR]: ${message}`);
        const alertObject = {
            id: `alt-wispro-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            message,
            mac,
            type: 'warning',
            source: 'Wispro Webhook Zero-Touch',
            details,
            timestamp: new Date().toISOString(),
            read: false
        };
        // 1. Intentar notificar al daemon principal de Velocity en puerto 3000 si está activo
        try {
            await fetch('http://localhost:3000/api/internal/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertObject)
            }).catch(() => {
                // Silencioso si el servidor 3000 no tiene el endpoint o está reiniciando
            });
        }
        catch { }
        // 2. Persistencia directa en data/db.json como salvaguarda
        try {
            const candidates = [
                path_1.default.resolve(process.cwd(), 'data/db.json'),
                path_1.default.resolve(process.cwd(), '../data/db.json'),
                path_1.default.resolve(__dirname, '../../../../data/db.json'),
                path_1.default.resolve(__dirname, '../../../../../data/db.json')
            ];
            for (const filePath of candidates) {
                if (fs_1.default.existsSync(filePath)) {
                    const raw = fs_1.default.readFileSync(filePath, 'utf8');
                    const db = JSON.parse(raw);
                    if (!db.alerts)
                        db.alerts = [];
                    db.alerts.unshift(alertObject);
                    if (db.alerts.length > 100)
                        db.alerts = db.alerts.slice(0, 100);
                    fs_1.default.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf8');
                    console.log(`[Wispro Webhook 💾] Alerta registrada en ${filePath}`);
                    break;
                }
            }
        }
        catch (e) {
            console.warn('[Wispro Webhook] No se pudo escribir alerta directa en db.json:', e.message);
        }
    }
    /**
     * Procesa la activación automática Zero-Touch enviada por Wispro
     */
    static async processActivation(rawPayload) {
        // Normalizar carga útil recibida (admite payload directo o envuelto en data/contract/payload)
        const nested = rawPayload.data || rawPayload.contract || rawPayload.payload || {};
        const rawContractId = rawPayload.contractId ?? rawPayload.contract_id ?? nested.contractId ?? nested.contract_id ?? nested.id;
        const clientName = (rawPayload.clientName || rawPayload.client_name || nested.clientName || nested.client_name || nested.client?.name || '').trim();
        const rawMac = (rawPayload.macAddress || rawPayload.mac_address || rawPayload.mac || nested.macAddress || nested.mac_address || nested.mac || '').trim();
        const rawSerial = (rawPayload.serial || rawPayload.serialNumber || rawPayload.serial_number || rawPayload.sn || nested.serial || nested.serialNumber || nested.serial_number || '').trim();
        const technicianId = (rawPayload.technicianId || rawPayload.technician_id || nested.technicianId || nested.technician_id || '').trim();
        const technicianEmail = (rawPayload.technicianEmail || rawPayload.technician_email || nested.technicianEmail || nested.technician_email || '').trim().toLowerCase();
        // 1. Validaciones básicas de presencia de campos
        if (!rawContractId) {
            const err = new Error('El campo contractId es obligatorio para procesar la activación');
            err.statusCode = 400;
            throw err;
        }
        if (!rawMac && !rawSerial) {
            const err = new Error('Se requiere macAddress o serial para identificar el equipo a activar');
            err.statusCode = 400;
            throw err;
        }
        const contractId = String(rawContractId).trim();
        // Normalizaciones de formato para la MAC (con y sin dos puntos/guiones)
        const cleanMac = rawMac.replace(/[:.-]/g, '').toUpperCase();
        const formattedMac = cleanMac.length === 12
            ? (cleanMac.match(/.{1,2}/g)?.join(':') || rawMac)
            : rawMac;
        // 2. Buscar el InventoryItem (SerializedItem en base de datos)
        const searchConditions = [];
        if (cleanMac) {
            searchConditions.push({ macAddress: { equals: rawMac, mode: 'insensitive' } }, { macAddress: { equals: cleanMac, mode: 'insensitive' } }, { macAddress: { equals: formattedMac, mode: 'insensitive' } }, { serialNumber: { equals: cleanMac, mode: 'insensitive' } });
        }
        if (rawSerial) {
            searchConditions.push({ serialNumber: { equals: rawSerial, mode: 'insensitive' } }, { macAddress: { equals: rawSerial, mode: 'insensitive' } });
        }
        const item = await db_1.prisma.serializedItem.findFirst({
            where: {
                OR: searchConditions
            },
            include: {
                product: true,
                currentWarehouse: true
            }
        });
        // 3. Manejo de Errores: Si la MAC no existe en el inventario de Velocity (Status 422 + Alerta)
        if (!item) {
            const missingIdentifier = rawMac || rawSerial;
            const alertMessage = `Equipo desconocido intentó ser activado en Wispro: [${missingIdentifier}]`;
            await this.recordSupervisorAlert(alertMessage, missingIdentifier, {
                contractId,
                clientName,
                technicianId,
                technicianEmail,
                attemptedAt: new Date().toISOString()
            });
            const err = new Error(alertMessage);
            err.statusCode = 422;
            err.code = 'EQUIPMENT_NOT_FOUND';
            err.macAddress = missingIdentifier;
            throw err;
        }
        // 4. Verificar que el ítem pertenezca al inventario de una bodega móvil ('Móvil') activa
        const warehouse = item.currentWarehouse;
        const isMobileWarehouse = warehouse &&
            (warehouse.type === client_1.WarehouseType.VEHICULO ||
                /m[oó]vil|veh[ií]culo|camioneta|cuadrilla/i.test(warehouse.name));
        const isWarehouseActive = warehouse?.status === client_1.WarehouseStatus.ACTIVE;
        if (!warehouse || !isMobileWarehouse || !isWarehouseActive) {
            const details = !warehouse
                ? 'El equipo no tiene una bodega asignada.'
                : !isMobileWarehouse
                    ? `El equipo se encuentra en la bodega '${warehouse.name}' (${warehouse.type}), la cual NO es una bodega móvil (Móvil / Vehículo).`
                    : `La bodega móvil '${warehouse.name}' está INACTIVA en el sistema.`;
            const err = new Error(`El equipo no puede ser activado automáticamente: ${details}`);
            err.statusCode = 400;
            err.code = 'INVALID_MOBILE_WAREHOUSE';
            err.warehouse = warehouse?.name || 'N/A';
            throw err;
        }
        // 5. Resolver técnico/usuario para el registro de auditoría forense
        let resolvedUserId = null;
        if (technicianId) {
            const u = await db_1.prisma.user.findFirst({
                where: {
                    OR: [
                        { id: technicianId },
                        { email: { equals: technicianId, mode: 'insensitive' } }
                    ]
                }
            });
            if (u)
                resolvedUserId = u.id;
        }
        if (!resolvedUserId && technicianEmail) {
            const u = await db_1.prisma.user.findFirst({
                where: { email: { equals: technicianEmail, mode: 'insensitive' } }
            });
            if (u)
                resolvedUserId = u.id;
        }
        if (!resolvedUserId && warehouse.managerId) {
            resolvedUserId = warehouse.managerId;
        }
        if (!resolvedUserId) {
            // Usar usuario de sistema (Superadmin / Supervisor de mesa)
            const systemAdmin = await db_1.prisma.user.findFirst({
                where: { role: { in: ['SUPERADMIN', 'SUPERVISOR_MESA'] } }
            }) || await db_1.prisma.user.findFirst();
            if (systemAdmin)
                resolvedUserId = systemAdmin.id;
        }
        if (!resolvedUserId) {
            const err = new Error('No se pudo determinar un usuario válido para auditar la activación');
            err.statusCode = 500;
            throw err;
        }
        // 6. Transacción Atómica de Activación (Prisma $transaction)
        const result = await db_1.prisma.$transaction(async (tx) => {
            // A. Actualizar estado del InventoryItem a INSTALADO (INSTALADO_CLIENTE)
            const updatedItem = await tx.serializedItem.update({
                where: { id: item.id },
                data: {
                    status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                    installedContractId: contractId,
                    installedClientName: clientName || item.installedClientName || `Cliente ${contractId}`,
                    installedDate: new Date(),
                    notes: `Equipo instalado y activado automáticamente vía Webhook de Wispro (Contrato: ${contractId})`
                }
            });
            // B. Crear o actualizar el registro del Contract (WisproClient) vinculando este InventoryItem
            await tx.wisproClient.upsert({
                where: { contractId },
                update: {
                    ...(clientName ? { name: clientName } : {}),
                    currentOnuMac: updatedItem.macAddress || rawMac,
                    status: client_1.WisproClientStatus.ACTIVO
                },
                create: {
                    contractId,
                    name: clientName || `Cliente Contrato ${contractId}`,
                    address: warehouse.address || 'Panamá',
                    nodeName: 'Wispro Zero-Touch',
                    planName: 'Activación Automática',
                    currentOnuMac: updatedItem.macAddress || rawMac,
                    status: client_1.WisproClientStatus.ACTIVO
                }
            });
            // C. Registrar entrada en el historial de trazabilidad (AuditLog)
            const auditLog = await tx.auditLog.create({
                data: {
                    eventType: client_1.AuditEventType.INSTALACION_CLIENTE,
                    macAddress: updatedItem.macAddress || rawMac,
                    serialNumber: updatedItem.serialNumber,
                    fromWarehouseId: warehouse.id,
                    userId: resolvedUserId,
                    details: 'Equipo instalado y activado automáticamente vía Webhook de Wispro',
                    timestamp: new Date()
                }
            });
            return { updatedItem, auditLog };
        });
        return {
            success: true,
            message: 'Equipo instalado y activado automáticamente vía Webhook de Wispro',
            data: {
                contractId,
                clientName: clientName || 'N/A',
                macAddress: result.updatedItem.macAddress || rawMac,
                serialNumber: result.updatedItem.serialNumber,
                productName: item.product?.name || 'Equipo Terminal',
                warehouseName: warehouse.name,
                status: 'INSTALADO',
                auditLogId: result.auditLog.id,
                activatedAt: new Date().toISOString()
            }
        };
    }
}
exports.WisproWebhookService = WisproWebhookService;
