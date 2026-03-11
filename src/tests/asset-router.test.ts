import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/server/db/schema";
import { AssetStatus, UserRole } from "~/types/contracts";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
type AssetRouter = typeof import("~/server/api/routers/asset").assetRouter;

let client: Client;
let db: TestDb;
let tempDir = "";
let assetRouter: AssetRouter;

const ids = {
	companyA: "company-a",
	companyB: "company-b",
	managerA: "manager-a",
	managerB: "manager-b",
	employeeUserA: "employee-user-a",
	employeeA: "employee-a",
	employeeA2: "employee-a-2",
	employeeInactiveA: "employee-inactive-a",
	employeeB: "employee-b",
	officeA: "office-a",
	officeB: "office-b",
	floorA: "floor-a",
	floorB: "floor-b",
	roomA: "room-a",
	roomA2: "room-a-2",
	roomB: "room-b",
	assetActive: "asset-active",
	assetBroken: "asset-broken",
	assetRetired: "asset-retired",
};

async function createCaller(userId: string) {
	const user = await db.query.users.findFirst({
		where: (t, { eq }) => eq(t.id, userId),
	});
	if (!user) throw new Error("User not found");

	return assetRouter.createCaller({
		db,
		session: { user: { id: user.id } },
		user,
	} as never);
}

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "sdh-asset-router-"));
	process.env.DATABASE_URL = `file:${join(tempDir, "env.db")}`;
	assetRouter = (await import("~/server/api/routers/asset")).assetRouter;
	client = createClient({ url: `file:${join(tempDir, "test.db")}` });
	const migrationSql = await readFile(
		join(process.cwd(), "drizzle/0000_hesitant_gladiator.sql"),
		"utf8",
	);

	for (const statement of migrationSql.split("--> statement-breakpoint")) {
		const sql = statement.trim();
		if (!sql) continue;
		await client.execute(sql);
	}

	db = drizzle(client, { schema });

	await db.insert(schema.companies).values([
		{ id: ids.companyA, name: "Company A" },
		{ id: ids.companyB, name: "Company B" },
	]);

	await db.insert(schema.users).values([
		{
			id: ids.managerA,
			email: "manager-a@sdh.demo",
			name: "Manager A",
			role: UserRole.OFFICE_MANAGER,
			companyId: ids.companyA,
			isActive: true,
		},
		{
			id: ids.managerB,
			email: "manager-b@sdh.demo",
			name: "Manager B",
			role: UserRole.OFFICE_MANAGER,
			companyId: ids.companyB,
			isActive: true,
		},
		{
			id: ids.employeeUserA,
			email: "employee-a@sdh.demo",
			name: "Employee A",
			role: UserRole.EMPLOYEE,
			companyId: ids.companyA,
			isActive: true,
		},
	]);

	await db.insert(schema.offices).values({
		id: ids.officeA,
		companyId: ids.companyA,
		name: "HQ",
	});
	await db.insert(schema.offices).values({
		id: ids.officeB,
		companyId: ids.companyB,
		name: "Remote",
	});
	await db.insert(schema.floors).values({
		id: ids.floorA,
		companyId: ids.companyA,
		officeId: ids.officeA,
		name: "1",
	});
	await db.insert(schema.floors).values({
		id: ids.floorB,
		companyId: ids.companyB,
		officeId: ids.officeB,
		name: "1",
	});
	await db.insert(schema.rooms).values({
		id: ids.roomA,
		companyId: ids.companyA,
		floorId: ids.floorA,
		name: "Room A",
	});
	await db.insert(schema.rooms).values({
		id: ids.roomA2,
		companyId: ids.companyA,
		floorId: ids.floorA,
		name: "Room A2",
	});
	await db.insert(schema.rooms).values({
		id: ids.roomB,
		companyId: ids.companyB,
		floorId: ids.floorB,
		name: "Room B",
	});

	await db.insert(schema.employees).values([
		{
			id: ids.employeeA,
			companyId: ids.companyA,
			userId: ids.employeeUserA,
			firstName: "Employee",
			lastName: "A",
			email: "employee-a@sdh.demo",
			isActive: true,
		},
		{
			id: ids.employeeA2,
			companyId: ids.companyA,
			firstName: "Employee",
			lastName: "A2",
			email: "employee-a2@sdh.demo",
			isActive: true,
		},
		{
			id: ids.employeeInactiveA,
			companyId: ids.companyA,
			firstName: "Employee",
			lastName: "Inactive",
			email: "employee-inactive@sdh.demo",
			isActive: false,
		},
		{
			id: ids.employeeB,
			companyId: ids.companyB,
			firstName: "Employee",
			lastName: "B",
			email: "employee-b@sdh.demo",
			isActive: true,
		},
	]);

	await db.insert(schema.assets).values([
		{
			id: ids.assetActive,
			companyId: ids.companyA,
			barcode: "A-001",
			name: "Active Asset",
			category: "Furniture",
			tags: "[]",
			status: AssetStatus.ACTIVE,
			currentEmployeeId: ids.employeeA,
			currentRoomId: ids.roomA,
		},
		{
			id: ids.assetBroken,
			companyId: ids.companyA,
			barcode: "A-002",
			name: "Broken Asset",
			category: "Furniture",
			tags: "[]",
			status: AssetStatus.BROKEN,
			currentEmployeeId: ids.employeeA,
			currentRoomId: ids.roomA,
		},
		{
			id: ids.assetRetired,
			companyId: ids.companyA,
			barcode: "A-003",
			name: "Retired Asset",
			category: "Furniture",
			tags: "[]",
			status: AssetStatus.RETIRED,
			currentEmployeeId: ids.employeeA,
			currentRoomId: ids.roomA,
		},
	]);
});

afterEach(async () => {
	await client.close();
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
	}
});

describe("asset router remove/restore and retired visibility", () => {
	it("excludes retired assets by default and includes them when includeRetired=true", async () => {
		const managerCaller = await createCaller(ids.managerA);

		const defaultList = await managerCaller.list({ page: 1, pageSize: 20 });
		expect(defaultList.items.map((item) => item.id)).toEqual(
			expect.arrayContaining([ids.assetActive, ids.assetBroken]),
		);
		expect(defaultList.items.map((item) => item.id)).not.toContain(
			ids.assetRetired,
		);

		const fullList = await managerCaller.list({
			page: 1,
			pageSize: 20,
			includeRetired: true,
		});
		expect(fullList.items.map((item) => item.id)).toEqual(
			expect.arrayContaining([
				ids.assetActive,
				ids.assetBroken,
				ids.assetRetired,
			]),
		);
	});

	it("does not return retired assets in myAssets", async () => {
		const employeeCaller = await createCaller(ids.employeeUserA);
		const myAssets = await employeeCaller.myAssets();

		expect(myAssets.map((item) => item.id)).toEqual(
			expect.arrayContaining([ids.assetActive, ids.assetBroken]),
		);
		expect(myAssets.map((item) => item.id)).not.toContain(ids.assetRetired);
	});

	it("removes asset by retiring it, clearing assignment, and writing history", async () => {
		const managerCaller = await createCaller(ids.managerA);
		await managerCaller.remove({
			assetId: ids.assetActive,
			note: "Removed in test",
		});

		const removedAsset = await db.query.assets.findFirst({
			where: (t, { eq }) => eq(t.id, ids.assetActive),
		});
		expect(removedAsset?.status).toBe(AssetStatus.RETIRED);
		expect(removedAsset?.currentEmployeeId).toBeNull();
		expect(removedAsset?.currentRoomId).toBeNull();

		const history = await db.query.assignmentHistory.findMany({
			where: (t, { eq }) => eq(t.assetId, ids.assetActive),
		});
		expect(history.length).toBe(1);
		expect(history[0]?.fromEmployeeId).toBe(ids.employeeA);
		expect(history[0]?.toEmployeeId).toBeNull();
		expect(history[0]?.note).toBe("Removed in test");
	});

	it("restores asset to active and keeps assignment cleared", async () => {
		const managerCaller = await createCaller(ids.managerA);
		await managerCaller.restore({ assetId: ids.assetRetired });

		const restoredAsset = await db.query.assets.findFirst({
			where: (t, { eq }) => eq(t.id, ids.assetRetired),
		});
		expect(restoredAsset?.status).toBe(AssetStatus.ACTIVE);
		expect(restoredAsset?.currentEmployeeId).toBeNull();
		expect(restoredAsset?.currentRoomId).toBeNull();
	});

	it("rejects remove/restore for non-managers", async () => {
		const employeeCaller = await createCaller(ids.employeeUserA);

		await expect(
			employeeCaller.remove({ assetId: ids.assetActive }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			employeeCaller.restore({ assetId: ids.assetRetired }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects cross-company remove attempts", async () => {
		const foreignManagerCaller = await createCaller(ids.managerB);

		await expect(
			foreignManagerCaller.remove({ assetId: ids.assetActive }),
		).rejects.toThrow("Asset not found");
	});
});

describe("asset router reassign", () => {
	it("rejects missing destination ids", async () => {
		const managerCaller = await createCaller(ids.managerA);

		await expect(
			managerCaller.reassign({
				assetId: ids.assetActive,
				toEmployeeId: ids.employeeA2,
			} as never),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		await expect(
			managerCaller.reassign({
				assetId: ids.assetActive,
				toRoomId: ids.roomA2,
			} as never),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects inactive employee", async () => {
		const managerCaller = await createCaller(ids.managerA);

		await expect(
			managerCaller.reassign({
				assetId: ids.assetActive,
				toEmployeeId: ids.employeeInactiveA,
				toRoomId: ids.roomA2,
			}),
		).rejects.toThrow("Employee not found");
	});

	it("rejects cross-company employee or room", async () => {
		const managerCaller = await createCaller(ids.managerA);

		await expect(
			managerCaller.reassign({
				assetId: ids.assetActive,
				toEmployeeId: ids.employeeB,
				toRoomId: ids.roomA2,
			}),
		).rejects.toThrow("Employee not found");

		await expect(
			managerCaller.reassign({
				assetId: ids.assetActive,
				toEmployeeId: ids.employeeA2,
				toRoomId: ids.roomB,
			}),
		).rejects.toThrow("Room not found");
	});

	it("rejects no-op reassignment", async () => {
		const managerCaller = await createCaller(ids.managerA);

		await expect(
			managerCaller.reassign({
				assetId: ids.assetActive,
				toEmployeeId: ids.employeeA,
				toRoomId: ids.roomA,
			}),
		).rejects.toThrow("Asset is already assigned to this employee and room");
	});

	it("reassigns asset and writes assignment history", async () => {
		const managerCaller = await createCaller(ids.managerA);
		await managerCaller.reassign({
			assetId: ids.assetActive,
			toEmployeeId: ids.employeeA2,
			toRoomId: ids.roomA2,
			note: "Reassigned in test",
		});

		const reassignedAsset = await db.query.assets.findFirst({
			where: (t, { eq }) => eq(t.id, ids.assetActive),
		});
		expect(reassignedAsset?.currentEmployeeId).toBe(ids.employeeA2);
		expect(reassignedAsset?.currentRoomId).toBe(ids.roomA2);

		const history = await db.query.assignmentHistory.findMany({
			where: (t, { eq }) => eq(t.assetId, ids.assetActive),
		});
		expect(history.length).toBe(1);
		expect(history[0]?.fromEmployeeId).toBe(ids.employeeA);
		expect(history[0]?.toEmployeeId).toBe(ids.employeeA2);
		expect(history[0]?.fromRoomId).toBe(ids.roomA);
		expect(history[0]?.toRoomId).toBe(ids.roomA2);
		expect(history[0]?.note).toBe("Reassigned in test");
	});
});
