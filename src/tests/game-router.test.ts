import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/server/db/schema";
import { UserRole } from "~/types/contracts";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
type GameRouter = typeof import("~/server/api/routers/game").gameRouter;

let client: Client;
let db: TestDb;
let tempDir = "";
let gameRouter: GameRouter;

const ids = {
	companyA: "company-a",
	companyB: "company-b",
	managerA: "manager-a",
	managerB: "manager-b",
	employeeAUser: "employee-a-user",
	employeeBUser: "employee-b-user",
	officeA: "office-a",
	officeB: "office-b",
};

async function applyMigrations() {
	const files = (await readdir(join(process.cwd(), "drizzle")))
		.filter((name) => name.endsWith(".sql"))
		.sort();

	for (const file of files) {
		const sqlContent = await readFile(
			join(process.cwd(), "drizzle", file),
			"utf8",
		);
		for (const statement of sqlContent.split("--> statement-breakpoint")) {
			const sql = statement.trim();
			if (!sql) continue;
			await client.execute(sql);
		}
	}
}

async function createCaller(userId: string) {
	const user = await db.query.users.findFirst({
		where: (t, { eq }) => eq(t.id, userId),
	});
	if (!user) throw new Error("User not found");
	return gameRouter.createCaller({
		db,
		session: { user: { id: user.id } },
		user,
	} as never);
}

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "sdh-game-router-"));
	process.env.DATABASE_URL = `file:${join(tempDir, "env.db")}`;
	gameRouter = (await import("~/server/api/routers/game")).gameRouter;
	client = createClient({ url: `file:${join(tempDir, "test.db")}` });
	await applyMigrations();
	db = drizzle(client, { schema });

	await db.insert(schema.companies).values([
		{ id: ids.companyA, name: "Company A" },
		{ id: ids.companyB, name: "Company B" },
	]);

	await db.insert(schema.users).values([
		{
			id: ids.managerA,
			email: "manager-a@sdh.demo",
			role: UserRole.OFFICE_MANAGER,
			companyId: ids.companyA,
			isActive: true,
		},
		{
			id: ids.managerB,
			email: "manager-b@sdh.demo",
			role: UserRole.OFFICE_MANAGER,
			companyId: ids.companyB,
			isActive: true,
		},
		{
			id: ids.employeeAUser,
			email: "employee-a@sdh.demo",
			role: UserRole.EMPLOYEE,
			companyId: ids.companyA,
			isActive: true,
		},
		{
			id: ids.employeeBUser,
			email: "employee-b@sdh.demo",
			role: UserRole.EMPLOYEE,
			companyId: ids.companyB,
			isActive: true,
		},
	]);

	await db.insert(schema.offices).values([
		{ id: ids.officeA, companyId: ids.companyA, name: "HQ A" },
		{ id: ids.officeB, companyId: ids.companyB, name: "HQ B" },
	]);
});

afterEach(async () => {
	await client.close();
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
	}
});

describe("game router manager controls", () => {
	it("allows manager to initialize, set tile, and resize with out-of-bounds trim", async () => {
		const manager = await createCaller(ids.managerA);

		const created = await manager.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 4,
			height: 4,
		});
		expect(created.width).toBe(4);
		expect(created.height).toBe(4);

		await manager.managerSetTile({
			officeId: ids.officeA,
			layer: "base",
			x: 3,
			y: 3,
			tile: {
				tileset: "Room_Builder_Office_16x16",
				tileX: 2,
				tileY: 1,
			},
		});

		await manager.managerSetTile({
			officeId: ids.officeA,
			layer: "base",
			x: 3,
			y: 3,
			tile: {
				tileset: "Room_Builder_Office_16x16",
				tileX: 5,
				tileY: 2,
			},
		});

		const beforeResize = await manager.managerGetOfficeLayout({
			officeId: ids.officeA,
		});
		expect(beforeResize?.baseLayer["3,3"]?.tileX).toBe(5);

		const resized = await manager.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 2,
			height: 2,
		});
		expect(resized.width).toBe(2);
		expect(resized.height).toBe(2);
		expect(resized.baseLayer["3,3"]).toBeUndefined();
	});

	it("rejects out-of-bounds tile set", async () => {
		const manager = await createCaller(ids.managerA);
		await manager.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 2,
			height: 2,
		});

		await expect(
			manager.managerSetTile({
				officeId: ids.officeA,
				layer: "base",
				x: 3,
				y: 3,
				tile: {
					tileset: "Room_Builder_Office_16x16",
					tileX: 0,
					tileY: 0,
				},
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects cross-company office access for manager", async () => {
		const managerB = await createCaller(ids.managerB);
		await expect(
			managerB.managerInitOrResizeOfficeLayout({
				officeId: ids.officeA,
				width: 4,
				height: 4,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("batch paints rectangle cells in one mutation", async () => {
		const manager = await createCaller(ids.managerA);
		await manager.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 4,
			height: 4,
		});

		const updated = await manager.managerSetTilesBatch({
			officeId: ids.officeA,
			layer: "base",
			tiles: [
				{
					x: 0,
					y: 0,
					tile: {
						tileset: "Room_Builder_Office_16x16",
						tileX: 1,
						tileY: 1,
					},
				},
				{
					x: 1,
					y: 1,
					tile: {
						tileset: "Room_Builder_Office_16x16",
						tileX: 1,
						tileY: 1,
					},
				},
			],
		});

		expect(updated.baseLayer["0,0"]).toBeDefined();
		expect(updated.baseLayer["1,1"]).toBeDefined();
	});

	it("rejects full batch when one tile is out of bounds", async () => {
		const manager = await createCaller(ids.managerA);
		await manager.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 2,
			height: 2,
		});

		await expect(
			manager.managerSetTilesBatch({
				officeId: ids.officeA,
				layer: "base",
				tiles: [
					{
						x: 0,
						y: 0,
						tile: {
							tileset: "Room_Builder_Office_16x16",
							tileX: 0,
							tileY: 0,
						},
					},
					{
						x: 9,
						y: 9,
						tile: {
							tileset: "Room_Builder_Office_16x16",
							tileX: 0,
							tileY: 0,
						},
					},
				],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const layout = await manager.managerGetOfficeLayout({
			officeId: ids.officeA,
		});
		expect(layout?.baseLayer["0,0"]).toBeUndefined();
	});

	it("rejects full batch on layer and tileset mismatch", async () => {
		const manager = await createCaller(ids.managerA);
		await manager.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 2,
			height: 2,
		});

		await expect(
			manager.managerSetTilesBatch({
				officeId: ids.officeA,
				layer: "base",
				tiles: [
					{
						x: 0,
						y: 0,
						tile: {
							tileset: "Modern_Office_Black_Shadow",
							tileX: 0,
							tileY: 0,
						},
					},
				],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("game router employee visibility and auth", () => {
	it("blocks manager mutations for employee role", async () => {
		const employee = await createCaller(ids.employeeAUser);
		await expect(
			employee.managerInitOrResizeOfficeLayout({
				officeId: ids.officeA,
				width: 4,
				height: 4,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		await expect(
			employee.managerSetTilesBatch({
				officeId: ids.officeA,
				layer: "base",
				tiles: [
					{
						x: 0,
						y: 0,
						tile: {
							tileset: "Room_Builder_Office_16x16",
							tileX: 0,
							tileY: 0,
						},
					},
				],
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("returns only same-company office layouts for employee", async () => {
		const managerA = await createCaller(ids.managerA);
		const managerB = await createCaller(ids.managerB);
		const employeeA = await createCaller(ids.employeeAUser);

		await managerA.managerInitOrResizeOfficeLayout({
			officeId: ids.officeA,
			width: 5,
			height: 5,
		});
		await managerB.managerInitOrResizeOfficeLayout({
			officeId: ids.officeB,
			width: 6,
			height: 6,
		});

		const available = await employeeA.employeeListAvailableOfficeLayouts();
		expect(available).toHaveLength(1);
		expect(available[0]?.officeId).toBe(ids.officeA);

		await expect(
			employeeA.employeeGetOfficeLayout({ officeId: ids.officeB }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
