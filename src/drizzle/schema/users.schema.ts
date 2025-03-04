import { pgTable, text, uuid, date, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    phonenumber: text("phonenumber").notNull(),
    refreshtoken: text("refreshtoken").notNull(),
    emailVerified: boolean("emailVerified").notNull(),
    phoneVerified: boolean("phoneVerified").notNull(),
    created_at: date("created_at").notNull().default("now()"),
    updated_at: date("updated_at").notNull()
});