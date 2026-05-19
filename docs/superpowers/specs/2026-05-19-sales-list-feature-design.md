# Feature Design: List Sales untuk Pelanggan

**Date:** 2026-05-19
**Status:** Approved

## Overview

Menambahkan tab "Sales" di dashboard customer yang menampilkan daftar user dengan role `admin_sales` dalam bentuk kartu (foto profil, nama, status online). Pelanggan bisa klik kartu sales untuk langsung membuka chat.

## Scope

- Tidak menambah role baru (`admin_sales` sudah ada)
- Admin_sales sudah bisa upload foto profil via `/api/users/profile` (existing)
- Fokus: menampilkan list sales ke pelanggan + integrasi chat

## Changes

### 1. New File: `app/api/sales/route.js`

Endpoint `GET /api/sales` — public, no auth required (middleware allows all `/api/*`).

```js
// Query: SELECT u.id, u.name, u.username, u.role, u.no_hp, u.is_online, u.last_active,
//        a.image_path AS avatar
//        FROM users u LEFT JOIN avatar a ON u.id = a.user_id
//        WHERE u.role = 'admin_sales'
//        ORDER BY u.is_online DESC, u.name ASC
```

Response:
```json
[
  {
    "id": 1,
    "name": "Sales A",
    "username": "sales1",
    "role": "admin_sales",
    "no_hp": "0812xxx",
    "is_online": 1,
    "last_active": "2026-05-19 12:00:00",
    "avatar": "avatar_1.webp"
  }
]
```

Avatar URL resolve client-side: `/api/avatar?filename={avatar}`

### 2. New File: `components/client/SalesClient.js`

Komponen client-side:
- Fetch `GET /api/sales` on mount
- Render grid kartu sales (responsive: 1 col mobile, 2-3 col desktop)
- Tiap kartu Ant Design `Card`:
  - Avatar + online indicator (badge hijau/abu)
  - Nama sales
  - Status text: "Online" / "Offline"
  - Tombol "Chat" (icon `MessageCircle` dari lucide-react)
- Klik tombol Chat → callback `onChatWithSales(salesId)` ke parent

Props:
```js
{
  onChatWithSales: (salesId) => void  // callback untuk buka chat dengan sales
}
```

### 3. Modified File: `app/dashboard/DashboardClient.js`

**a) Tambah import:**
```js
import SalesClient from "@/components/client/SalesClient";
import { Users } from "lucide-react";
```

**b) Tambah state untuk chat target:**
```js
const [chatTargetId, setChatTargetId] = useState(null);
```

**c) Tambah menu item "Sales":**
```js
{
  id: 'sales',
  label: 'Sales',
  icon: Users,
  component: (
    <div className="p-6 w-full">
      <SalesClient onChatWithSales={(salesId) => {
        setChatTargetId(salesId);
        setActiveId('chat');
      }} />
    </div>
  )
}
```

**d) Modifikasi komponen Chat di menu agar menerima `chatTargetId`:**
```js
component: <Chating initialUserId={chatTargetId} />
```

### 4. Modified File: `components/shared/ui/Chating.js`

**Tambah prop `initialUserId`:**
```js
const Chating = ({ initialUserId = null }) => {
```

**Effect untuk auto-buka conversation:**
```js
useEffect(() => {
  if (!initialUserId) return;
  
  // Cek apakah conversation sudah ada di list (ada riwayat chat)
  const targetConv = conversations.find(c => c.other_user_id === initialUserId);
  if (targetConv) {
    handleConversationClick(targetConv);
    return;
  }
  
  // Tidak ada riwayat chat → fetch user profile (with avatar), buat "empty conversation"
  const startNewChat = async () => {
    const res = await fetch(`/api/users/profile?id=${initialUserId}`);
    const userData = await res.json();
    if (userData && !userData.error) {
      setCurrentChat({
        other_user_id: userData.id,
        other_user_name: userData.name || userData.username,
        other_user_avatar: userData.avatar || null
      });
      setMessages([]);
    }
  };
  startNewChat();
}, [initialUserId, conversations]);
```

### 5. Verified (No Changes Needed)

- `app/api/users/profile/route.js` — PUT sudah support avatar upload untuk semua user, termasuk admin_sales
- `lib/db.js` — avatar table + runtime migration sudah ada
- `middleware.js` — tidak perlu perubahan karena tidak ada role/dashboard baru

## Data Flow

```
Customer Dashboard
  └─ Tab "Sales" → SalesClient
       └─ GET /api/sales → [{ id, name, avatar, is_online, ... }]
       └─ Render kartu sales
       └─ User klik "Chat" → onChatWithSales(id)
            └─ DashboardClient setActiveId('chat') + setChatTargetId(id)
                 └─ Chating initialUserId → auto-buka conversation
                      └─ GET /api/chat?with_user_id={salesId} → messages
```

## UI States

| State | Handling |
|---|---|
| Loading | Spin / Skeleton saat fetch sales |
| Empty (0 sales) | Ant Design Empty: "Belum ada sales tersedia" |
| Error fetch | message.error + tampilkan Empty |
| Sales offline | Badge abu-abu, teks "Offline" |
| Sales online | Badge hijau, teks "Online" |
| Tanpa avatar | Tampilkan UserOutlined icon default |

## Files Summary

| File | Action |
|---|---|
| `app/api/sales/route.js` | **New** — GET endpoint list sales |
| `components/client/SalesClient.js` | **New** — Kartu sales UI |
| `app/dashboard/DashboardClient.js` | **Modify** — Tambah tab sales + chat routing |
| `components/shared/ui/Chating.js` | **Modify** — Terima initialUserId prop |
