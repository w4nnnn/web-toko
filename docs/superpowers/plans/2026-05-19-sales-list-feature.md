# Sales List Feature Implementation Plan

> **For agentic workers:** This is a small focused plan — implement inline.

**Goal:** Add "Sales" tab to customer dashboard showing admin_sales list with profile photos and direct chat integration.

**Architecture:** New API endpoint `/api/sales` returns admin_sales users with avatars. New `SalesClient` component renders sales cards. Modified `DashboardClient` adds tab + chat routing. Modified `Chating` accepts `initialUserId` for one-click chat.

**Tech Stack:** Next.js 15 App Router, Ant Design, lucide-react, SQLite

---

### Task 1: Create API endpoint `GET /api/sales`

**Files:**
- Create: `app/api/sales/route.js`

- [ ] **Step 1: Create route file**

```js
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
```

- [ ] **Step 2: Commit**

---

### Task 2: Create SalesClient component

**Files:**
- Create: `components/client/SalesClient.js`

- [ ] **Step 1: Create component**

```js
'use client';
import { useState, useEffect } from 'react';
import { Card, Avatar, Badge, Button, Empty, Spin, message, Typography } from 'antd';
import { UserOutlined, MessageOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function SalesClient({ onChatWithSales }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    try {
      const res = await fetch('/api/sales');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSales(data);
      } else {
        message.error('Gagal memuat daftar sales');
      }
    } catch (err) {
      console.error(err);
      message.error('Gagal memuat daftar sales');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!sales.length) {
    return <Empty description="Belum ada sales tersedia" />;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Daftar Sales</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sales.map((s) => (
          <Card
            key={s.id}
            hoverable
            className="text-center"
            actions={[
              <Button
                key="chat"
                type="primary"
                icon={<MessageOutlined />}
                onClick={() => onChatWithSales?.(s.id)}
                block
              >
                Chat
              </Button>
            ]}
          >
            <div className="flex flex-col items-center gap-2">
              <Badge
                dot
                status={s.is_online ? 'success' : 'default'}
                offset={[-5, 5]}
              >
                <Avatar
                  size={64}
                  src={s.avatar ? `/api/avatar?filename=${s.avatar}` : undefined}
                  icon={!s.avatar && <UserOutlined />}
                />
              </Badge>
              <Text strong>{s.name || s.username}</Text>
              <Text type="secondary" className="text-xs">
                {s.is_online ? 'Online' : 'Offline'}
              </Text>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

---

### Task 3: Modify DashboardClient — add Sales tab + chat routing

**Files:**
- Modify: `app/dashboard/DashboardClient.js`

- [ ] **Step 1: Add imports**

```js
import SalesClient from "@/components/client/SalesClient";
import { Home, MessagesSquare, ReceiptText, ShoppingCart, User, Users } from "lucide-react";
```

- [ ] **Step 2: Add chatTargetId state**

After `const [activeId, setActiveId] = useState(tabParam || "home");` add:
```js
const [chatTargetId, setChatTargetId] = useState(null);
```

- [ ] **Step 3: Add Sales menu item and update Chat item**

Add sales item before the chat item, and modify chat to accept chatTargetId:
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
},
{
  id: 'chat',
  label: 'Chat',
  icon: MessagesSquare,
  component: (
    <div className="p-6 w-full">
      <Chating initialUserId={chatTargetId} />
    </div>
  )
},
```

- [ ] **Step 4: Commit**

---

### Task 4: Modify Chating — support initialUserId prop

**Files:**
- Modify: `components/shared/ui/Chating.js`

- [ ] **Step 1: Add prop and effect for initialUserId**

Change function signature:
```js
const Chating = ({ initialUserId = null }) => {
```

Add effect after `fetchConversations` effect:
```js
useEffect(() => {
  if (!initialUserId) return;

  const targetConv = conversations.find(c => c.other_user_id === initialUserId);
  if (targetConv) {
    handleConversationClick(targetConv);
    return;
  }

  const startNewChat = async () => {
    try {
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
    } catch (err) {
      console.error('Error starting new chat:', err);
    }
  };
  startNewChat();
}, [initialUserId, conversations]);
```

- [ ] **Step 2: Commit**

---

### Task 5: Verify build

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Compiles successfully, all routes intact.

- [ ] **Step 2: Commit (if any lint fixes)**
