import { integer, pgTable, uuid, text, boolean, jsonb } from "drizzle-orm/pg-core"
import { users } from "./users.schema"


export const profiles = pgTable("profiles", {
    id: uuid().defaultRandom().primaryKey(),
    user_id: uuid("user_id").notNull().references(() => users.id),
    first_name: text("first_name"),
    last_name: text("last_name"),
    phoneNumber: text("phone_number"),
    phoneVerified: boolean("phone_verified").default(false),
    address: jsonb("address"),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull()
})