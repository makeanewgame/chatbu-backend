import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/schema";
import "dotenv/config";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});
const db = drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;

const seedUsers = [
    {
        email: "test@test.com",
        name: "Test User",
        password: "test123",
        refreshToken: "",
    }
]


async function main() {

    type newUser = typeof schema.users.$inferInsert;

    // const user: newUser = {
    //     email: "",
    //     name: "Test User",
    //     password: "test123",
    //     created_at: new Date().toISOString(),
    //     updated_at: new Date().toISOString()
    // }

    // await db.insert(schema.users).values({
    //     email: "test@test.com",
    //     name: "Test User",
    //     password: "test123",

    //     created_at: new Date().toISOString(),
    //     updated_at: new Date().toISOString()
    // });

    // const userIds = await Promise.all(
    //     Array(seedUsers.length).fill('').map(async (item, index) => {
    //         const user = await db.insert(schema.users).values({
    //             name: "Test User",
    //             email: "test@test.com",
    //             password: "test123",
    //             created_at: new Date().toISOString(),
    //             updated_at: new Date().toISOString()
    //         })
    //         return user[0].id;

    //     })
    // );

    // const profile = await db.insert(schema.profiles).values({
    //     user_id: userIds[0],
    //     created_at: Date.now(),
    //     updated_at: Date.now(),
    // }).returning();


}

main().then().catch((err) => {
    console.log(err);
    process.exit(0);
}
);