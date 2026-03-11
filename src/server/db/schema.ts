import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTableCreator,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

export const createTable = sqliteTableCreator((name) => `sdhinventory_${name}`);

export const companies = createTable("company", {
	id: text("id", { length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name", { length: 255 }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
		() => new Date(),
	),
});

export const users = createTable(
	"user",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name", { length: 255 }),
		email: text("email", { length: 255 }).notNull(),
		emailVerified: integer("email_verified", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		image: text("image", { length: 255 }),
		companyId: text("company_id", { length: 255 }).references(
			() => companies.id,
		),
		role: text("role", { enum: ["EMPLOYEE", "OFFICE_MANAGER"] })
			.$type<"EMPLOYEE" | "OFFICE_MANAGER">()
			.default("EMPLOYEE")
			.notNull(),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		uniqueIndex("user_email_uidx").on(t.email),
		index("user_company_idx").on(t.companyId),
	],
);

export const usersRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	company: one(companies, {
		fields: [users.companyId],
		references: [companies.id],
	}),
	employee: one(employees),
}));

export const accounts = createTable(
	"account",
	{
		userId: text("user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		type: text("type", { length: 255 })
			.$type<AdapterAccount["type"]>()
			.notNull(),
		provider: text("provider", { length: 255 }).notNull(),
		providerAccountId: text("provider_account_id", { length: 255 }).notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type", { length: 255 }),
		scope: text("scope", { length: 255 }),
		id_token: text("id_token"),
		session_state: text("session_state", { length: 255 }),
	},
	(t) => [
		primaryKey({
			columns: [t.provider, t.providerAccountId],
		}),
		index("account_user_id_idx").on(t.userId),
	],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
	"session",
	{
		sessionToken: text("session_token", { length: 255 }).notNull().primaryKey(),
		userId: text("user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		expires: integer("expires", { mode: "timestamp" }).notNull(),
	},
	(t) => [index("session_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
	"verification_token",
	{
		identifier: text("identifier", { length: 255 }).notNull(),
		token: text("token", { length: 255 }).notNull(),
		expires: integer("expires", { mode: "timestamp" }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const offices = createTable(
	"office",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		name: text("name", { length: 255 }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [index("office_company_idx").on(t.companyId)],
);

export const floors = createTable(
	"floor",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		officeId: text("office_id", { length: 255 })
			.notNull()
			.references(() => offices.id),
		name: text("name", { length: 255 }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [index("floor_company_office_idx").on(t.companyId, t.officeId)],
);

export const rooms = createTable(
	"room",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		floorId: text("floor_id", { length: 255 })
			.notNull()
			.references(() => floors.id),
		name: text("name", { length: 255 }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [index("room_company_floor_idx").on(t.companyId, t.floorId)],
);

export const officeLayouts = createTable(
	"office_layout",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		officeId: text("office_id", { length: 255 })
			.notNull()
			.references(() => offices.id),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		baseLayerJson: text("base_layer_json").notNull().default("{}"),
		assetLayerJson: text("asset_layer_json").notNull().default("{}"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		index("office_layout_company_office_idx").on(t.companyId, t.officeId),
		uniqueIndex("office_layout_company_office_uidx").on(
			t.companyId,
			t.officeId,
		),
	],
);

export const employees = createTable(
	"employee",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		userId: text("user_id", { length: 255 }).references(() => users.id),
		firstName: text("first_name", { length: 255 }).notNull(),
		lastName: text("last_name", { length: 255 }).notNull(),
		email: text("email", { length: 255 }).notNull(),
		isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("employee_email_company_uidx").on(t.companyId, t.email),
		uniqueIndex("employee_user_uidx").on(t.userId),
		index("employee_company_idx").on(t.companyId),
	],
);

export const assets = createTable(
	"asset",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		barcode: text("barcode", { length: 255 }).notNull(),
		name: text("name", { length: 255 }).notNull(),
		category: text("category", { length: 255 }).notNull(),
		tags: text("tags").notNull().default("[]"),
		status: text("status", { enum: ["ACTIVE", "BROKEN", "RETIRED"] })
			.$type<"ACTIVE" | "BROKEN" | "RETIRED">()
			.default("ACTIVE")
			.notNull(),
		currentEmployeeId: text("current_employee_id", { length: 255 }).references(
			() => employees.id,
		),
		currentRoomId: text("current_room_id", { length: 255 }).references(
			() => rooms.id,
		),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [
		uniqueIndex("asset_company_barcode_uidx").on(t.companyId, t.barcode),
		index("asset_company_status_idx").on(t.companyId, t.status),
		index("asset_company_employee_idx").on(t.companyId, t.currentEmployeeId),
		index("asset_company_room_idx").on(t.companyId, t.currentRoomId),
	],
);

export const assignmentHistory = createTable(
	"assignment_history",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		assetId: text("asset_id", { length: 255 })
			.notNull()
			.references(() => assets.id),
		fromEmployeeId: text("from_employee_id", { length: 255 }),
		toEmployeeId: text("to_employee_id", { length: 255 }),
		fromRoomId: text("from_room_id", { length: 255 }),
		toRoomId: text("to_room_id", { length: 255 }),
		changedByUserId: text("changed_by_user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		note: text("note"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [index("assignment_company_asset_idx").on(t.companyId, t.assetId)],
);

export const verificationCycles = createTable(
	"verification_cycle",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		name: text("name", { length: 255 }).notNull(),
		status: text("status", { enum: ["PLANNED", "ACTIVE", "CLOSED"] })
			.$type<"PLANNED" | "ACTIVE" | "CLOSED">()
			.default("PLANNED")
			.notNull(),
		startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
		endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
		createdByUserId: text("created_by_user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		index("verification_cycle_company_status_idx").on(t.companyId, t.status),
	],
);

export const verificationEvents = createTable(
	"verification_event",
	{
		id: text("id", { length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		companyId: text("company_id", { length: 255 })
			.notNull()
			.references(() => companies.id),
		cycleId: text("cycle_id", { length: 255 })
			.notNull()
			.references(() => verificationCycles.id),
		assetId: text("asset_id", { length: 255 })
			.notNull()
			.references(() => assets.id),
		verifiedByUserId: text("verified_by_user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		method: text("method", { enum: ["SCAN", "MANUAL"] })
			.$type<"SCAN" | "MANUAL">()
			.notNull(),
		result: text("result", { enum: ["VERIFIED", "NOT_VERIFIED"] })
			.$type<"VERIFIED" | "NOT_VERIFIED">()
			.default("VERIFIED")
			.notNull(),
		officeId: text("office_id", { length: 255 }).references(() => offices.id),
		floorId: text("floor_id", { length: 255 }).references(() => floors.id),
		roomId: text("room_id", { length: 255 }).references(() => rooms.id),
		note: text("note"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("verification_event_company_cycle_asset_uidx").on(
			t.companyId,
			t.cycleId,
			t.assetId,
		),
		index("verification_event_cycle_asset_idx").on(t.cycleId, t.assetId),
		index("verification_event_company_cycle_idx").on(t.companyId, t.cycleId),
	],
);

export const companiesRelations = relations(companies, ({ many }) => ({
	users: many(users),
	employees: many(employees),
	offices: many(offices),
	assets: many(assets),
	verificationCycles: many(verificationCycles),
}));

export const officesRelations = relations(offices, ({ many, one }) => ({
	company: one(companies, {
		fields: [offices.companyId],
		references: [companies.id],
	}),
	floors: many(floors),
}));

export const floorsRelations = relations(floors, ({ many, one }) => ({
	company: one(companies, {
		fields: [floors.companyId],
		references: [companies.id],
	}),
	office: one(offices, { fields: [floors.officeId], references: [offices.id] }),
	rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one }) => ({
	company: one(companies, {
		fields: [rooms.companyId],
		references: [companies.id],
	}),
	floor: one(floors, { fields: [rooms.floorId], references: [floors.id] }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
	company: one(companies, {
		fields: [employees.companyId],
		references: [companies.id],
	}),
	user: one(users, { fields: [employees.userId], references: [users.id] }),
	assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
	company: one(companies, {
		fields: [assets.companyId],
		references: [companies.id],
	}),
	currentEmployee: one(employees, {
		fields: [assets.currentEmployeeId],
		references: [employees.id],
	}),
	currentRoom: one(rooms, {
		fields: [assets.currentRoomId],
		references: [rooms.id],
	}),
	assignmentHistory: many(assignmentHistory),
	verificationEvents: many(verificationEvents),
}));

export const assignmentHistoryRelations = relations(
	assignmentHistory,
	({ one }) => ({
		company: one(companies, {
			fields: [assignmentHistory.companyId],
			references: [companies.id],
		}),
		asset: one(assets, {
			fields: [assignmentHistory.assetId],
			references: [assets.id],
		}),
		changedBy: one(users, {
			fields: [assignmentHistory.changedByUserId],
			references: [users.id],
		}),
	}),
);

export const verificationCycleRelations = relations(
	verificationCycles,
	({ one, many }) => ({
		company: one(companies, {
			fields: [verificationCycles.companyId],
			references: [companies.id],
		}),
		createdBy: one(users, {
			fields: [verificationCycles.createdByUserId],
			references: [users.id],
		}),
		events: many(verificationEvents),
	}),
);

export const verificationEventRelations = relations(
	verificationEvents,
	({ one }) => ({
		company: one(companies, {
			fields: [verificationEvents.companyId],
			references: [companies.id],
		}),
		cycle: one(verificationCycles, {
			fields: [verificationEvents.cycleId],
			references: [verificationCycles.id],
		}),
		asset: one(assets, {
			fields: [verificationEvents.assetId],
			references: [assets.id],
		}),
		verifiedBy: one(users, {
			fields: [verificationEvents.verifiedByUserId],
			references: [users.id],
		}),
	}),
);
