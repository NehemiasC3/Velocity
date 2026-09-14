-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AuditEventType" AS ENUM ('ALTA_INVENTARIO', 'DESPACHO_TRASLADO', 'RECEPCION_TRASLADO', 'CARGA_VEHICULO', 'INSTALACION_CLIENTE', 'RETIRO_CLIENTE', 'REPORTE_RMA', 'AJUSTE_STOCK', 'CONSUMO_BOBINA', 'RETIRO_POR_CANCELACION');

-- CreateEnum
CREATE TYPE "public"."BatchStatus" AS ENUM ('DISPONIBLE', 'EN_USO', 'AGOTADO', 'EN_TRANSITO', 'DEFECTUOSO');

-- CreateEnum
CREATE TYPE "public"."InstallationTicketType" AS ENUM ('INSTALACION_NUEVA', 'BAJA_SERVICIO', 'MANTENIMIENTO_RMA', 'CAMBIO_EQUIPO', 'MIGRACION', 'REPARACION_DROP');

-- CreateEnum
CREATE TYPE "public"."ItemCategory" AS ENUM ('ONU_ONT', 'ROUTER_WIFI', 'TV_BOX_OTT', 'CAMARA_SEGURIDAD_IOT', 'REPETIDOR_MESH', 'CABLE_DROP', 'CONECTORIZACION', 'HERRAJE_PLANTA_EXTERNA', 'HERRAMIENTA_EQUIPO', 'MISCELANEOS');

-- CreateEnum
CREATE TYPE "public"."RetiredDeviceStatus" AS ENUM ('RMA_DEFECTUOSO', 'RECUPERADO_BUENO');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPERADMIN', 'SUPERVISOR_MESA', 'BODEGUERO_CENTRAL', 'BODEGUERO_SUCURSAL', 'TECNICO');

-- CreateEnum
CREATE TYPE "public"."SerializedStatus" AS ENUM ('EN_BODEGA', 'EN_TRANSITO', 'EN_VEHICULO', 'INSTALADO_CLIENTE', 'RMA_DEFECTUOSO', 'BAJA');

-- CreateEnum
CREATE TYPE "public"."TrackingType" AS ENUM ('SERIALIZED', 'BATCHED', 'BULK');

-- CreateEnum
CREATE TYPE "public"."TransferStatus" AS ENUM ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDO', 'RECHAZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "public"."UnitOfMeasure" AS ENUM ('METROS', 'UNIDADES', 'ROLLOS', 'CAJAS', 'KITS');

-- CreateEnum
CREATE TYPE "public"."WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."WarehouseType" AS ENUM ('PRINCIPAL', 'SUCURSAL', 'VEHICULO', 'CUARENTENA_RMA');

-- CreateEnum
CREATE TYPE "public"."WisproClientStatus" AS ENUM ('ACTIVO', 'PENDIENTE_INSTALACION', 'SUSPENDIDO');

-- CreateTable
CREATE TABLE "public"."_TransferOrderBatches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransferOrderBatches_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_TransferOrderSerializedItems" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransferOrderSerializedItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "mac_address" TEXT,
    "serial_number" TEXT,
    "batch_number" TEXT,
    "event_type" "public"."AuditEventType" NOT NULL,
    "from_warehouse_id" TEXT,
    "to_warehouse_id" TEXT,
    "user_id" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."batch_items" (
    "id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "current_warehouse_id" TEXT NOT NULL,
    "initial_quantity" DOUBLE PRECISION NOT NULL,
    "current_quantity" DOUBLE PRECISION NOT NULL,
    "unit_of_measure" "public"."UnitOfMeasure" NOT NULL DEFAULT 'METROS',
    "status" "public"."BatchStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bulk_stocks" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_assignments" (
    "id" TEXT NOT NULL,
    "wispro_contract_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technician_id" TEXT,
    "node_id" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."installation_tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "type" "public"."InstallationTicketType" NOT NULL DEFAULT 'INSTALACION_NUEVA',
    "wispro_client_id" TEXT NOT NULL,
    "wispro_client_name" TEXT NOT NULL,
    "wispro_contract_id" TEXT NOT NULL,
    "wispro_node" TEXT,
    "client_address" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "vehicle_warehouse_id" TEXT NOT NULL,
    "installed_onu_mac" TEXT,
    "installed_onu_serial" TEXT,
    "installed_router_mac" TEXT,
    "retired_device_mac" TEXT,
    "retired_device_status" "public"."RetiredDeviceStatus",
    "used_spool_batch_number" TEXT,
    "cable_drop_meters_used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "connectors_used" INTEGER NOT NULL DEFAULT 0,
    "tensors_used" INTEGER NOT NULL DEFAULT 0,
    "other_materials_used" TEXT,
    "installation_photo_url" TEXT,
    "notes" TEXT,
    "wispro_synced" BOOLEAN NOT NULL DEFAULT false,
    "wispro_sync_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_catalog" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "description" TEXT,
    "category" "public"."ItemCategory" NOT NULL,
    "tracking_type" "public"."TrackingType" NOT NULL DEFAULT 'BULK',
    "unit_of_measure" "public"."UnitOfMeasure" NOT NULL DEFAULT 'UNIDADES',
    "min_stock_alert" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."serialized_items" (
    "id" TEXT NOT NULL,
    "mac_address" TEXT,
    "serial_number" TEXT NOT NULL,
    "verification_code" TEXT,
    "product_id" TEXT NOT NULL,
    "current_warehouse_id" TEXT NOT NULL,
    "status" "public"."SerializedStatus" NOT NULL DEFAULT 'EN_BODEGA',
    "installed_ticket_id" TEXT,
    "installed_client_id" TEXT,
    "installed_client_name" TEXT,
    "installed_contract_id" TEXT,
    "installed_date" TIMESTAMP(3),
    "warranty_expiration" TIMESTAMP(3),
    "notes" TEXT,
    "client_assignment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serialized_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_order_items" (
    "id" TEXT NOT NULL,
    "transfer_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_of_measure" "public"."UnitOfMeasure" NOT NULL,

    CONSTRAINT "transfer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transfer_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "source_warehouse_id" TEXT NOT NULL,
    "destination_warehouse_id" TEXT NOT NULL,
    "status" "public"."TransferStatus" NOT NULL DEFAULT 'PENDIENTE',
    "created_by_user_id" TEXT NOT NULL,
    "dispatched_by_user_id" TEXT,
    "dispatched_at" TIMESTAMP(3),
    "received_by_user_id" TEXT,
    "received_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'TECNICO',
    "phone" TEXT,
    "base_warehouse_id" TEXT,
    "assigned_node_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."WarehouseType" NOT NULL DEFAULT 'VEHICULO',
    "address" TEXT,
    "vehicle_plate" TEXT,
    "status" "public"."WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "manager_id" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wispro_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "identification" TEXT,
    "node_name" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "public_id" INTEGER,
    "plan_name" TEXT NOT NULL,
    "current_onu_mac" TEXT,
    "current_onu_serial" TEXT,
    "model" TEXT,
    "ip_address" TEXT,
    "wispro_state" TEXT,
    "status" "public"."WisproClientStatus" NOT NULL DEFAULT 'ACTIVO',
    "wispro_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wispro_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wispro_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "api_url" TEXT NOT NULL DEFAULT 'https://www.cloud.wispro.co/api/v1',
    "api_token" TEXT NOT NULL DEFAULT '',
    "auto_sync_minutes" INTEGER NOT NULL DEFAULT 15,
    "last_sync_timestamp" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wispro_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_TransferOrderBatches_B_index" ON "public"."_TransferOrderBatches"("B" ASC);

-- CreateIndex
CREATE INDEX "_TransferOrderSerializedItems_B_index" ON "public"."_TransferOrderSerializedItems"("B" ASC);

-- CreateIndex
CREATE INDEX "batch_items_batch_number_idx" ON "public"."batch_items"("batch_number" ASC);

-- CreateIndex
CREATE INDEX "batch_items_current_warehouse_id_idx" ON "public"."batch_items"("current_warehouse_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_product_id_batch_number_key" ON "public"."batch_items"("product_id" ASC, "batch_number" ASC);

-- CreateIndex
CREATE INDEX "batch_items_status_idx" ON "public"."batch_items"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bulk_stocks_product_id_warehouse_id_key" ON "public"."bulk_stocks"("product_id" ASC, "warehouse_id" ASC);

-- CreateIndex
CREATE INDEX "bulk_stocks_warehouse_id_idx" ON "public"."bulk_stocks"("warehouse_id" ASC);

-- CreateIndex
CREATE INDEX "client_assignments_node_id_idx" ON "public"."client_assignments"("node_id" ASC);

-- CreateIndex
CREATE INDEX "client_assignments_technician_id_idx" ON "public"."client_assignments"("technician_id" ASC);

-- CreateIndex
CREATE INDEX "client_assignments_wispro_contract_id_idx" ON "public"."client_assignments"("wispro_contract_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "installation_tickets_ticket_number_key" ON "public"."installation_tickets"("ticket_number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_catalog_sku_key" ON "public"."product_catalog"("sku" ASC);

-- CreateIndex
CREATE INDEX "serialized_items_client_assignment_id_idx" ON "public"."serialized_items"("client_assignment_id" ASC);

-- CreateIndex
CREATE INDEX "serialized_items_current_warehouse_id_idx" ON "public"."serialized_items"("current_warehouse_id" ASC);

-- CreateIndex
CREATE INDEX "serialized_items_current_warehouse_id_status_idx" ON "public"."serialized_items"("current_warehouse_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "serialized_items_mac_address_idx" ON "public"."serialized_items"("mac_address" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "serialized_items_serial_number_key" ON "public"."serialized_items"("serial_number" ASC);

-- CreateIndex
CREATE INDEX "serialized_items_status_idx" ON "public"."serialized_items"("status" ASC);

-- CreateIndex
CREATE INDEX "transfer_orders_destination_warehouse_id_idx" ON "public"."transfer_orders"("destination_warehouse_id" ASC);

-- CreateIndex
CREATE INDEX "transfer_orders_destination_warehouse_id_status_idx" ON "public"."transfer_orders"("destination_warehouse_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_orders_order_number_key" ON "public"."transfer_orders"("order_number" ASC);

-- CreateIndex
CREATE INDEX "transfer_orders_source_warehouse_id_idx" ON "public"."transfer_orders"("source_warehouse_id" ASC);

-- CreateIndex
CREATE INDEX "transfer_orders_source_warehouse_id_status_idx" ON "public"."transfer_orders"("source_warehouse_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "transfer_orders_status_idx" ON "public"."transfer_orders"("status" ASC);

-- CreateIndex
CREATE INDEX "users_assigned_node_id_idx" ON "public"."users"("assigned_node_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "public"."warehouses"("code" ASC);

-- CreateIndex
CREATE INDEX "warehouses_parent_id_idx" ON "public"."warehouses"("parent_id" ASC);

-- CreateIndex
CREATE INDEX "warehouses_type_idx" ON "public"."warehouses"("type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "wispro_clients_contract_id_key" ON "public"."wispro_clients"("contract_id" ASC);

-- CreateIndex
CREATE INDEX "wispro_clients_current_onu_mac_idx" ON "public"."wispro_clients"("current_onu_mac" ASC);

-- CreateIndex
CREATE INDEX "wispro_clients_current_onu_serial_idx" ON "public"."wispro_clients"("current_onu_serial" ASC);

-- CreateIndex
CREATE INDEX "wispro_clients_identification_idx" ON "public"."wispro_clients"("identification" ASC);

-- CreateIndex
CREATE INDEX "wispro_clients_name_idx" ON "public"."wispro_clients"("name" ASC);

-- CreateIndex
CREATE INDEX "wispro_clients_public_id_idx" ON "public"."wispro_clients"("public_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."_TransferOrderBatches" ADD CONSTRAINT "_TransferOrderBatches_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."batch_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TransferOrderBatches" ADD CONSTRAINT "_TransferOrderBatches_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TransferOrderSerializedItems" ADD CONSTRAINT "_TransferOrderSerializedItems_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."serialized_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_TransferOrderSerializedItems" ADD CONSTRAINT "_TransferOrderSerializedItems_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batch_items" ADD CONSTRAINT "batch_items_current_warehouse_id_fkey" FOREIGN KEY ("current_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batch_items" ADD CONSTRAINT "batch_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bulk_stocks" ADD CONSTRAINT "bulk_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bulk_stocks" ADD CONSTRAINT "bulk_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_assignments" ADD CONSTRAINT "client_assignments_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_assignments" ADD CONSTRAINT "client_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."installation_tickets" ADD CONSTRAINT "installation_tickets_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."installation_tickets" ADD CONSTRAINT "installation_tickets_vehicle_warehouse_id_fkey" FOREIGN KEY ("vehicle_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."serialized_items" ADD CONSTRAINT "serialized_items_client_assignment_id_fkey" FOREIGN KEY ("client_assignment_id") REFERENCES "public"."client_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."serialized_items" ADD CONSTRAINT "serialized_items_current_warehouse_id_fkey" FOREIGN KEY ("current_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."serialized_items" ADD CONSTRAINT "serialized_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_order_items" ADD CONSTRAINT "transfer_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_order_items" ADD CONSTRAINT "transfer_order_items_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "public"."transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_dispatched_by_user_id_fkey" FOREIGN KEY ("dispatched_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transfer_orders" ADD CONSTRAINT "transfer_orders_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_assigned_node_id_fkey" FOREIGN KEY ("assigned_node_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_base_warehouse_id_fkey" FOREIGN KEY ("base_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

