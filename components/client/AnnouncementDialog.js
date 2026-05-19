'use client';
import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Checkbox, Image, Typography } from 'antd';
import { useRouter } from 'next/navigation';

const { Text, Title, Paragraph } = Typography;
const LS_KEY = 'dismissed_announcement_version';

export default function AnnouncementDialog() {
  const [visible, setVisible] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const router = useRouter();

  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch('/api/announcement');
      const json = await res.json();
      if (!json.success) return;

      const ann = json.data.announcement;
      if (!ann || !ann.active) return;
      if (!ann.title && !ann.content) return;

      // Check local storage
      const dismissedVersion = localStorage.getItem(LS_KEY);
      if (dismissedVersion === ann.updated_at) return;

      setAnnouncement(ann);
      setVisible(true);
    } catch (err) {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  const handleClose = () => {
    setVisible(false);
    if (dontShowAgain && announcement?.updated_at) {
      localStorage.setItem(LS_KEY, announcement.updated_at);
    }
  };

  const handleProduct = () => {
    if (announcement?.product_id) {
      router.push(`/product/${announcement.product_id}`);
    }
    handleClose();
  };

  const handleLink = () => {
    if (announcement?.link_url) {
      window.open(announcement.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!announcement) return null;

  const hasProduct = !!announcement.product_id;
  const hasLink = !!announcement.link_url;

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={480}
      centered
      closable
    >
      <div className="flex flex-col gap-4">
        {announcement.image_path && (
          <Image
            src={`/api/announcement/image?filename=${announcement.image_path}`}
            alt={announcement.title}
            className="w-full rounded-lg object-cover max-h-48"
            preview={false}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNjY2MiIGZvbnQtc2l6ZT0iMjAiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=="
          />
        )}

        {announcement.title && (
          <Title level={4} className="m-0">{announcement.title}</Title>
        )}

        {announcement.content && (
          <Paragraph className="m-0 whitespace-pre-wrap">{announcement.content}</Paragraph>
        )}

        {(hasProduct || hasLink) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {hasProduct && (
              <Button type="primary" onClick={handleProduct}>
                Lihat Produk
              </Button>
            )}
            {hasLink && (
              <Button onClick={handleLink}>
                {announcement.link_label || 'Lihat Detail'}
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          >
            Jangan tampilkan lagi hari ini
          </Checkbox>
        </div>
      </div>
    </Modal>
  );
}
