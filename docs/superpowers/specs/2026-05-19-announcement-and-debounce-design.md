# Feature Design: Announcement + Search Debounce

**Date:** 2026-05-19
**Status:** Approved

## Overview

Menambahkan sistem announcement untuk customer dialog (promosi) dan debounce pada search user management.

## Announcement

### Data Model (app_settings)

**Key: `announcement`** — JSON:
```json
{
  "title": "string",
  "content": "string",
  "product_id": 5,
  "link_url": "https://...",
  "link_label": "Lihat Promo",
  "image_path": "announcement/banner.webp",
  "active": true,
  "updated_at": "ISO timestamp"
}
```

**Key: `announcement_permissions`** — JSON:
```json
{ "roles": ["admin", "admin_sales"] }
```

### API

**`GET /api/announcement`** — Public. Returns both announcement and permissions.

**`PATCH /api/announcement`** — Cookie auth, checks role permission:
- Body: `{ title, content, product_id, link_url, link_label, image_base64, active, permissions }`
- `permissions` field only honored if user role === "superadmin"
- Image upload via base64 → convert to WebP → save to `database/images/announcement/`

### Component: `components/client/AnnouncementDialog.js`
- Client component, mounted in root layout
- Fetches announcement on mount
- Compares `updated_at` with localStorage `dismissed_announcement_version`
- If different → show Ant Design Modal with title, image, content, action buttons
- Checkbox "Jangan tampilkan lagi" → saves version to localStorage
- Product button → navigate to `/product/{product_id}`
- Link button → opens external URL

### Component: `components/admin/management/ManagementAnnouncement.js`
- Form: title, content (textarea), product selector (dropdown from `/api/product`), link URL, link label, image upload, active toggle
- Superadmin-only: role permission checkboxes (admin, admin_sales)
- Save via PATCH /api/announcement

### Layout & Dashboard
- `app/layout.js` — add `<AnnouncementDialog />`
- Superadmin dashboard — always show "Pengumuman" menu
- Admin / admin_sales dashboard — fetch permissions, show menu if role in permitted list

## Search Debounce

### `lib/useDebounce.js`
```js
import { useState, useEffect } from 'react';
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
}
```

### Modified Files
- `ManagementUsersBySuperAdmin.js` — replace `userSearch.trim()` with `useDebounce(userSearch, 300).trim()`
- `ManagementUsersByAdmin.js` — same change

## Files Summary

| File | Action |
|---|---|
| `app/api/announcement/route.js` | New |
| `components/client/AnnouncementDialog.js` | New |
| `components/admin/management/ManagementAnnouncement.js` | New |
| `lib/useDebounce.js` | New |
| `app/layout.js` | Modify |
| `app/dashboard-superadmin/page.js` | Modify |
| `app/dashboard-admin/page.js` | Modify |
| `app/dashboard-admin-sales/page.js` | Modify |
| `components/admin/management/ManagementUsersBySuperAdmin.js` | Modify |
| `components/admin/management/ManagementUsersByAdmin.js` | Modify |
