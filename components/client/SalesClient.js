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
