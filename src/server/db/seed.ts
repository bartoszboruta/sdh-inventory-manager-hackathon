import { db } from "~/server/db";
import {
	assets,
	companies,
	employees,
	floors,
	offices,
	rooms,
	users,
	verificationCycles,
} from "~/server/db/schema";
import {
	AssetStatus,
	UserRole,
	VerificationCycleStatus,
} from "~/types/contracts";

async function seed() {
	const [company] = await db
		.insert(companies)
		.values({ name: "SDH Demo" })
		.onConflictDoNothing()
		.returning({ id: companies.id });

	const companyId =
		company?.id ??
		(
			await db.query.companies.findFirst({
				where: (t, { eq }) => eq(t.name, "SDH Demo"),
			})
		)?.id;

	if (!companyId) throw new Error("Failed to create or fetch company");

	await db
		.insert(users)
		.values([
			{
				email: "manager@sdh.demo",
				name: "Manager",
				role: UserRole.OFFICE_MANAGER,
				companyId,
			},
			{
				email: "employee@sdh.demo",
				name: "Employee",
				role: UserRole.EMPLOYEE,
				companyId,
			},
		])
		.onConflictDoNothing();

	const [manager, appUser] = await Promise.all([
		db.query.users.findFirst({
			where: (t, { eq }) => eq(t.email, "manager@sdh.demo"),
		}),
		db.query.users.findFirst({
			where: (t, { eq }) => eq(t.email, "employee@sdh.demo"),
		}),
	]);

	if (!manager || !appUser) throw new Error("Users missing after seed");

	const [office] = await db
		.insert(offices)
		.values({ companyId, name: "HQ" })
		.onConflictDoNothing()
		.returning({ id: offices.id });

	const officeId =
		office?.id ??
		(
			await db.query.offices.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.companyId, companyId), eq(t.name, "HQ")),
			})
		)?.id;

	if (!officeId) throw new Error("Office missing");

	const [floor] = await db
		.insert(floors)
		.values({ companyId, officeId, name: "1" })
		.onConflictDoNothing()
		.returning({ id: floors.id });

	const floorId =
		floor?.id ??
		(
			await db.query.floors.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.companyId, companyId), eq(t.officeId, officeId)),
			})
		)?.id;

	if (!floorId) throw new Error("Floor missing");

	const [room] = await db
		.insert(rooms)
		.values({ companyId, floorId, name: "Room A" })
		.onConflictDoNothing()
		.returning({ id: rooms.id });

	const roomId =
		room?.id ??
		(
			await db.query.rooms.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.companyId, companyId), eq(t.floorId, floorId)),
			})
		)?.id;

	if (!roomId) throw new Error("Room missing");

	const [employee] = await db
		.insert(employees)
		.values({
			companyId,
			userId: appUser.id,
			firstName: "Demo",
			lastName: "Employee",
			email: "employee@sdh.demo",
		})
		.onConflictDoNothing()
		.returning({ id: employees.id });

	const employeeId =
		employee?.id ??
		(
			await db.query.employees.findFirst({
				where: (t, { and, eq }) =>
					and(eq(t.companyId, companyId), eq(t.email, "employee@sdh.demo")),
			})
		)?.id;

	if (!employeeId) throw new Error("Employee missing");

	await db
		.insert(assets)
		.values([
			{
				companyId,
				barcode: "ASSET-001",
				name: "Desk",
				category: "Furniture",
				tags: JSON.stringify(["desk", "wood"]),
				status: AssetStatus.ACTIVE,
				currentEmployeeId: employeeId,
				currentRoomId: roomId,
			},
			{
				companyId,
				barcode: "ASSET-002",
				name: "Chair",
				category: "Furniture",
				tags: JSON.stringify(["chair"]),
				status: AssetStatus.BROKEN,
				currentEmployeeId: employeeId,
				currentRoomId: roomId,
			},
			{
				companyId,
				barcode: "ASSET-003",
				name: "Display",
				category: "Electronics",
				tags: JSON.stringify(["display"]),
				status: AssetStatus.ACTIVE,
				currentEmployeeId: employeeId,
				currentRoomId: roomId,
			},
		])
		.onConflictDoNothing();

	await db
		.insert(verificationCycles)
		.values({
			companyId,
			name: `Annual ${new Date().getFullYear()}`,
			status: VerificationCycleStatus.ACTIVE,
			startsAt: new Date(),
			endsAt: new Date(Date.now() + 7 * 86_400_000),
			createdByUserId: manager.id,
		})
		.onConflictDoNothing();

	console.log("Seed complete.");
}

seed().catch((error) => {
	console.error(error);
	process.exit(1);
});
