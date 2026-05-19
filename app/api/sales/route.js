import { init, all } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  await init();
  try {
    const sales = await all(
      `SELECT u.id, u.name, u.username, u.role, u.no_hp, u.is_online, u.last_active,
              a.image_path AS avatar
       FROM users u
       LEFT JOIN avatar a ON u.id = a.user_id
       WHERE u.role = 'admin_sales'
       ORDER BY u.is_online DESC, u.name ASC`
    );
    return NextResponse.json(sales, { status: 200 });
  } catch (err) {
    console.error("GET /api/sales error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
