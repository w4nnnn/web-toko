import { NextResponse } from "next/server";
import { init, get, run } from "@/lib/db";
import { convertToWebp } from "@/lib/module/ConvertToWebp";
import { nowWIBForSQL } from "@/lib/module/TimestampIndonesia";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";
import path from "path";

const ANNOUNCEMENT_KEY = "announcement";
const PERMISSIONS_KEY = "announcement_permissions";
const JWT_SECRET = getJwtSecret();

const DEFAULT_ANNOUNCEMENT = {
  title: "",
  content: "",
  product_id: null,
  link_url: "",
  link_label: "",
  image_path: null,
  active: false,
  updated_at: "",
};

const DEFAULT_PERMISSIONS = {
  roles: [],
};

function getUserFromToken(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (e) {
    return null;
  }
}

export async function GET() {
  try {
    await init();

    const announcementRow = await get("SELECT value FROM app_settings WHERE key = ?", [ANNOUNCEMENT_KEY]);
    let announcement = { ...DEFAULT_ANNOUNCEMENT };
    if (announcementRow?.value) {
      try {
        announcement = { ...announcement, ...JSON.parse(announcementRow.value) };
      } catch (e) {
        // use default
      }
    }

    const permRow = await get("SELECT value FROM app_settings WHERE key = ?", [PERMISSIONS_KEY]);
    let permissions = { ...DEFAULT_PERMISSIONS };
    if (permRow?.value) {
      try {
        permissions = JSON.parse(permRow.value);
      } catch (e) {
        // use default
      }
    }

    return NextResponse.json({ success: true, data: { announcement, permissions } });
  } catch (err) {
    console.error("GET /api/announcement error:", err);
    return NextResponse.json({ error: "Gagal memuat pengumuman" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    await init();

    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to edit
    const isSuperadmin = user.role === "superadmin";
    const permRow = await get("SELECT value FROM app_settings WHERE key = ?", [PERMISSIONS_KEY]);
    let allowedRoles = [];
    if (permRow?.value) {
      try {
        const parsed = JSON.parse(permRow.value);
        allowedRoles = Array.isArray(parsed.roles) ? parsed.roles : [];
      } catch (e) {
        // use empty
      }
    }

    if (!isSuperadmin && !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Tidak memiliki akses untuk mengedit pengumuman" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    // Handle image upload if provided
    let imagePath = body.keep_image ? body.image_path : null;
    if (!body.keep_image && body.image_base64) {
      const buffer = Buffer.from(
        body.image_base64.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, ""),
        "base64"
      );
      const imgDir = path.join(process.cwd(), "database", "images", "announcement");
      const webpPath = await convertToWebp(buffer, imgDir, `announcement_${Date.now()}`);
      imagePath = path.basename(webpPath);
    }

    const now = nowWIBForSQL();
    const announcementPayload = {
      title: body.title || "",
      content: body.content || "",
      product_id: body.product_id || null,
      link_url: body.link_url || "",
      link_label: body.link_label || "",
      image_path: imagePath,
      active: body.active === true,
      updated_at: now,
    };

    await run(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [ANNOUNCEMENT_KEY, JSON.stringify(announcementPayload)]
    );

    // Update permissions (only superadmin)
    if (isSuperadmin && body.permissions) {
      const permPayload = {
        roles: Array.isArray(body.permissions.roles) ? body.permissions.roles : [],
      };
      await run(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [PERMISSIONS_KEY, JSON.stringify(permPayload)]
      );
    }

    return NextResponse.json({ success: true, data: announcementPayload });
  } catch (err) {
    console.error("PATCH /api/announcement error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengumuman" }, { status: 500 });
  }
}
