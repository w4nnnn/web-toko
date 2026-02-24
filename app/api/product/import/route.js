import { NextResponse } from "next/server";
import { init, run } from "@/lib/db.js";
import { nowWIBForSQL } from '@/lib/module/TimestampIndonesia.js';

export async function POST(request) {
    try {
        const { products } = await request.json();
        if (!Array.isArray(products) || products.length === 0) {
            return NextResponse.json({ error: "Data produk kosong" }, { status: 400 });
        }

        await init();

        let successCount = 0;
        let errorCount = 0;

        for (const prod of products) {
            const { name, description = null, category = null, units = [], show_stock = 1 } = prod;
            if (!name?.trim()) {
                errorCount++;
                continue;
            }

            const now = nowWIBForSQL();
            let res;
            try {
                res = await run(
                    `INSERT INTO products (name, description, image_path, category_id, show_stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [name.trim(), description?.trim() || null, null, category, show_stock ? 1 : 0, now, now]
                );
            } catch (e) {
                // Fallback for legacy schema
                res = await run(
                    `INSERT INTO products (name, description, image_path, category, show_stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [name.trim(), description?.trim() || null, null, category, show_stock ? 1 : 0, now, now]
                );
            }

            const newId = res.lastID;

            if (Array.isArray(units) && units.length > 0) {
                const insertUnitSQL = `INSERT INTO product_units (product_id, unit_name, qty_per_unit, price, stock) VALUES (?, ?, ?, ?, ?)`;
                for (const u of units) {
                    await run(insertUnitSQL, [
                        newId,
                        (u.unit_name || "unit").trim(),
                        Math.max(1, Number(u.qty_per_unit) || 1),
                        Math.max(0, Number(u.price) || 0),
                        Math.max(0, Number(u.stock) || 0)
                    ]);
                }
            } else {
                // Default unit if not provided
                await run(`INSERT INTO product_units (product_id, unit_name, qty_per_unit, price, stock) VALUES (?, ?, ?, ?, ?)`, [
                    newId,
                    "pcs",
                    1,
                    0,
                    0
                ]);
            }
            successCount++;
        }

        return NextResponse.json({ success: true, successCount, errorCount });
    } catch (err) {
        console.error("POST /api/product/import error:", err);
        return NextResponse.json({ error: "Kesalahan server" }, { status: 500 });
    }
}
