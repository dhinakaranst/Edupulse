import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { institution, user } from "./auth";

/**
 * Level 2: Campus / Branch
 * e.g., "Green Valley Engineering College", "Green Valley Public School"
 */
export const campus = pgTable("campus", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	institutionId: text("institution_id")
		.notNull()
		.references(() => institution.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	type: text("type").notNull(), // e.g., "school", "engineering", "medical", "arts"
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/**
 * Level 3: Department
 * e.g., "Computer Science", "High School Science"
 */
export const department = pgTable("department", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	campusId: text("campus_id")
		.notNull()
		.references(() => campus.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/**
 * Level 4: Section / Batch
 * e.g., "Grade 10 - A", "B.Tech CSE - 3rd Year - A"
 */
export const section = pgTable("section", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	departmentId: text("department_id")
		.notNull()
		.references(() => department.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/**
 * Custom Granular RBAC Mapping
 * Determines exactly *what level* of the hierarchy a user has access to.
 */
export const userAccess = pgTable("user_access", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	institutionId: text("institution_id")
		.notNull()
		.references(() => institution.id, { onDelete: "cascade" }), // Everyone is part of an institution
	campusId: text("campus_id").references(() => campus.id, {
		onDelete: "cascade",
	}), // Null if Trust Admin
	departmentId: text("department_id").references(() => department.id, {
		onDelete: "cascade",
	}), // Null if Principal
	sectionId: text("section_id").references(() => section.id, {
		onDelete: "cascade",
	}), // Null if HOD

	role: text("role").notNull(), // e.g., "principal", "hod", "advisor", "teacher", "student", "parent"
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

/**
 * Student Specific Profile extension
 */
export const studentProfile = pgTable("student_profile", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" })
		.unique(),
	sectionId: text("section_id")
		.notNull()
		.references(() => section.id, { onDelete: "cascade" }),
	rollNumber: text("roll_number").notNull(),
	parentEmail: text("parent_email"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
