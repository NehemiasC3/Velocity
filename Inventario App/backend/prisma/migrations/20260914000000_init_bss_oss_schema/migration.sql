-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'SUPERVISOR_MESA', 'BODEGUERO_CENTRAL', 'BODEGUERO_SUCURSAL', 'TECNICO');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('PRINCIPAL', 'SUCURSAL', 'VEHICULO', 'CUARENTENA_RMA');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('ONU_ONT', 'ROUTER_WIFI', 'TV_BOX_OTT', 'CAMARA_SEGURIDAD_IOT', 'REPETIDOR_MESH', 'CABLE_DROP', 'CONECTORIZACION', 'HERRAJE_PLANTA_EXTERNA', 'HERRAMIENTA_EQUIPO', 'MISCELANEOS');

-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('SERIALIZED', 'BATCHED', 'BULK');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('METROS', 'UNIDADES', 'ROLLOS', 'CAJAS', 'KITS');

-- CreateEnum
CREATE TYPE "SerializedStatus" AS ENUM ('EN_BODEGA', 'EN_TRANSITO', 'EN_VEHICULO', 'INSTALADO_CLIENTE', 'RMA_DEFECTUOSO', 'BAJA');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DISPONIBLE', 'EN_USO', 'AGOTADO', 'EN_TRANSITO', 'DEFECTUOSO');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDO', 'RECHAZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "InstallationTicketType" AS ENUM ('INSTALACION_NUEVA', 'BAJA_SERVICIO', 'MANTENIMIENTO_RMA', 'CAMBIO_EQUIPO', 'MIGRACION', 'REPARACION_DROP');

-- CreateEnum
CREATE TYPE "RetiredDeviceStatus" AS ENUM ('RMA_DEFECTUOSO', 'RECUPERADO_BUENO');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('ALTA_INVENTARIO', 'DESPACHO_TRASLADO', 'RECEPCION_TRASLADO', 'CARGA_VEHICULO', 'INSTALACION_CLIENTE', 'RETIRO_CLIENTE', 'REPORTE_RMA', 'AJUSTE_STOCK', 'CONSUMO_BOBINA', 'RETIRO_POR_CANCELACION');

-- CreateEnum
CREATE TYPE "WisproClientStatus" AS ENUM ('ACTIVO', 'PENDIENTE_INSTALACION', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "RouterServerType" AS ENUM ('MIKROTIK', 'MIKROTIK_V7', 'HUAWEI', 'CISCO', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TECNICO',
    "phone" TEXT,
    "base_warehouse_id" TEXT,
    "assigned_node_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'VEHICULO',
    "address" TEXT,
    "vehicle_plate" TEXT,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "manager_id" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_catalog" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "description" TEXT,
    "category" "ItemCategory" NOT NULL,
    "tracking_type" "TrackingType" NOT NULL DEFAULT 'BULK',
    "unit_of_measure" "UnitOfMeasure" NOT NULL DEFAULT 'UNIDADES',
    "min_stock_alert" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_stocks" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_items" (
    "id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "current_warehouse_id" TEXT NOT NULL,
    "initial_quantity" DOUBLE PRECISION NOT NULL,
    "current_quantity" DOUBLE PRECISION NOT NULL,
    "unit_of_measure" "UnitOfMeasure" NOT NULL DEFAULT 'METROS',
    "status" "BatchStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serialized_items" (
    "id" TEXT NOT NULL,
    "mac_address" TEXT,
    "serial_number" TEXT NOT NULL,
    "verification_code" TEXT,
    "product_id" TEXT NOT NULL,
    "current_warehouse_id" TEXT NOT NULL,
    "status" "SerializedStatus" NOT NULL DEFAULT 'EN_BODEGA',
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
CREATE TABLE "transfer_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "source_warehouse_id" TEXT NOT NULL,
    "destination_warehouse_id" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDIENTE',
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
CREATE TABLE "transfer_order_items" (
    "id" TEXT NOT NULL,
    "transfer_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_of_measure" "UnitOfMeasure" NOT NULL,

    CONSTRAINT "transfer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "type" "InstallationTicketType" NOT NULL DEFAULT 'INSTALACION_NUEVA',
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
    "retired_device_status" "RetiredDeviceStatus",
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
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "mac_address" TEXT,
    "serial_number" TEXT,
    "batch_number" TEXT,
    "event_type" "AuditEventType" NOT NULL,
    "from_warehouse_id" TEXT,
    "to_warehouse_id" TEXT,
    "user_id" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wispro_clients" (
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
    "status" "WisproClientStatus" NOT NULL DEFAULT 'ACTIVO',
    "wispro_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wispro_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wispro_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "api_url" TEXT NOT NULL DEFAULT 'https://www.cloud.wispro.co/api/v1',
    "api_token" TEXT NOT NULL DEFAULT '',
    "auto_sync_minutes" INTEGER NOT NULL DEFAULT 15,
    "last_sync_timestamp" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wispro_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_assignments" (
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
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dni_passport" TEXT,
    "identification" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "wispro_client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "download_speed" INTEGER NOT NULL,
    "upload_speed" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "router_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "api_port" INTEGER NOT NULL DEFAULT 8728,
    "type" "RouterServerType" NOT NULL DEFAULT 'MIKROTIK_V7',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "router_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olt_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "pon_ports" INTEGER NOT NULL DEFAULT 8,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_number" TEXT,
    "wispro_contract_id" TEXT,
    "client_id" TEXT NOT NULL,
    "service_plan_id" TEXT,
    "router_server_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory",
    "mac_address" TEXT,
    "serial_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "contract_id" TEXT,
    "serialized_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TransferOrderBatches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransferOrderBatches_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TransferOrderSerializedItems" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransferOrderSerializedItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_assigned_node_id_idx" ON "users"("assigned_node_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_parent_id_idx" ON "warehouses"("parent_id");

-- CreateIndex
CREATE INDEX "warehouses_type_idx" ON "warehouses"("type");

-- CreateIndex
CREATE UNIQUE INDEX "product_catalog_sku_key" ON "product_catalog"("sku");

-- CreateIndex
CREATE INDEX "bulk_stocks_warehouse_id_idx" ON "bulk_stocks"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_stocks_product_id_warehouse_id_key" ON "bulk_stocks"("product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "batch_items_current_warehouse_id_idx" ON "batch_items"("current_warehouse_id");

-- CreateIndex
CREATE INDEX "batch_items_status_idx" ON "batch_items"("status");

-- CreateIndex
CREATE INDEX "batch_items_batch_number_idx" ON "batch_items"("batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_product_id_batch_number_key" ON "batch_items"("product_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "serialized_items_serial_number_key" ON "serialized_items"("serial_number");

-- CreateIndex
CREATE INDEX "serialized_items_current_warehouse_id_idx" ON "serialized_items"("current_warehouse_id");

-- CreateIndex
CREATE INDEX "serialized_items_status_idx" ON "serialized_items"("status");

-- CreateIndex
CREATE INDEX "serialized_items_mac_address_idx" ON "serialized_items"("mac_address");

-- CreateIndex
CREATE INDEX "serialized_items_current_warehouse_id_status_idx" ON "serialized_items"("current_warehouse_id", "status");

-- CreateIndex
CREATE INDEX "serialized_items_client_assignment_id_idx" ON "serialized_items"("client_assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_orders_order_number_key" ON "transfer_orders"("order_number");

-- CreateIndex
CREATE INDEX "transfer_orders_source_warehouse_id_idx" ON "transfer_orders"("source_warehouse_id");

-- CreateIndex
CREATE INDEX "transfer_orders_destination_warehouse_id_idx" ON "transfer_orders"("destination_warehouse_id");

-- CreateIndex
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders"("status");

-- CreateIndex
CREATE INDEX "transfer_orders_source_warehouse_id_status_idx" ON "transfer_orders"("source_warehouse_id", "status");

-- CreateIndex
CREATE INDEX "transfer_orders_destination_warehouse_id_status_idx" ON "transfer_orders"("destination_warehouse_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "installation_tickets_ticket_number_key" ON "installation_tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "wispro_clients_contract_id_key" ON "wispro_clients"("contract_id");

-- CreateIndex
CREATE INDEX "wispro_clients_public_id_idx" ON "wispro_clients"("public_id");

-- CreateIndex
CREATE INDEX "wispro_clients_name_idx" ON "wispro_clients"("name");

-- CreateIndex
CREATE INDEX "wispro_clients_identification_idx" ON "wispro_clients"("identification");

-- CreateIndex
CREATE INDEX "wispro_clients_current_onu_serial_idx" ON "wispro_clients"("current_onu_serial");

-- CreateIndex
CREATE INDEX "wispro_clients_current_onu_mac_idx" ON "wispro_clients"("current_onu_mac");

-- CreateIndex
CREATE INDEX "client_assignments_wispro_contract_id_idx" ON "client_assignments"("wispro_contract_id");

-- CreateIndex
CREATE INDEX "client_assignments_node_id_idx" ON "client_assignments"("node_id");

-- CreateIndex
CREATE INDEX "client_assignments_technician_id_idx" ON "client_assignments"("technician_id");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_dni_passport_idx" ON "clients"("dni_passport");

-- CreateIndex
CREATE INDEX "clients_identification_idx" ON "clients"("identification");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_number_key" ON "contracts"("contract_number");

-- CreateIndex
CREATE INDEX "contracts_client_id_idx" ON "contracts"("client_id");

-- CreateIndex
CREATE INDEX "contracts_wispro_contract_id_idx" ON "contracts"("wispro_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_serialized_item_id_key" ON "inventory_items"("serialized_item_id");

-- CreateIndex
CREATE INDEX "inventory_items_mac_address_idx" ON "inventory_items"("mac_address");

-- CreateIndex
CREATE INDEX "inventory_items_serial_number_idx" ON "inventory_items"("serial_number");

-- CreateIndex
CREATE INDEX "inventory_items_contract_id_idx" ON "inventory_items"("contract_id");

-- CreateIndex
CREATE INDEX "_TransferOrderBatches_B_index" ON "_TransferOrderBatches"("B");

-- CreateIndex
CREATE INDEX "_TransferOrderSerializedItems_B_index" ON "_TransferOrderSerializedItems"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_base_warehouse_id_fkey" FOREIGN KEY ("base_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_node_id_fkey" FOREIGN KEY ("assigned_node_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_stocks" ADD CONSTRAINT "bulk_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_stocks" ADD CONSTRAINT "bulk_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_current_warehouse_id_fkey" FOREIGN KEY ("current_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serialized_items" ADD CONSTRAINT "serialized_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serialized_items" ADD CONSTRAINT "serialized_items_current_warehouse_id_fkey" FOREIGN KEY ("current_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serialized_items" ADD CONSTRAINT "serialized_items_client_assignment_id_fkey" FOREIGN KEY ("client_assignment_id") REFERENCES "client_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_dispatched_by_user_id_fkey" FOREIGN KEY ("dispatched_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_order_items" ADD CONSTRAINT "transfer_order_items_transfer_order_id_fkey" FOREIGN KEY ("transfer_order_id") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_order_items" ADD CONSTRAINT "transfer_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_tickets" ADD CONSTRAINT "installation_tickets_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_tickets" ADD CONSTRAINT "installation_tickets_vehicle_warehouse_id_fkey" FOREIGN KEY ("vehicle_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_wispro_client_id_fkey" FOREIGN KEY ("wispro_client_id") REFERENCES "wispro_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_wispro_contract_id_fkey" FOREIGN KEY ("wispro_contract_id") REFERENCES "wispro_clients"("contract_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_service_plan_id_fkey" FOREIGN KEY ("service_plan_id") REFERENCES "service_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_router_server_id_fkey" FOREIGN KEY ("router_server_id") REFERENCES "router_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_serialized_item_id_fkey" FOREIGN KEY ("serialized_item_id") REFERENCES "serialized_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransferOrderBatches" ADD CONSTRAINT "_TransferOrderBatches_A_fkey" FOREIGN KEY ("A") REFERENCES "batch_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransferOrderBatches" ADD CONSTRAINT "_TransferOrderBatches_B_fkey" FOREIGN KEY ("B") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransferOrderSerializedItems" ADD CONSTRAINT "_TransferOrderSerializedItems_A_fkey" FOREIGN KEY ("A") REFERENCES "serialized_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransferOrderSerializedItems" ADD CONSTRAINT "_TransferOrderSerializedItems_B_fkey" FOREIGN KEY ("B") REFERENCES "transfer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

