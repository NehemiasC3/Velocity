-- CreateEnum
CREATE TYPE "RouterServerType" AS ENUM ('MIKROTIK', 'MIKROTIK_V7', 'HUAWEI', 'CISCO', 'OTHER');

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

