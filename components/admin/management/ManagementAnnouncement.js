'use client';
import { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Switch, Checkbox, Upload, message, Card, Spin, Image } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const { TextArea } = Input;

export default function ManagementAnnouncement() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Get current user role
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      if (meRes.ok) {
        const me = await meRes.json();
        setIsSuperadmin(me?.user?.role === 'superadmin');
      }

      // Get announcement data
      const [annRes, prodRes] = await Promise.all([
        fetch('/api/announcement'),
        fetch('/api/product').then(r => r.json()).catch(() => []),
      ]);
      const annJson = await annRes.json();

      if (annJson.success) {
        const { announcement, permissions } = annJson.data;
        setInitialData(announcement);

        form.setFieldsValue({
          title: announcement.title || '',
          content: announcement.content || '',
          product_id: announcement.product_id || null,
          link_url: announcement.link_url || '',
          link_label: announcement.link_label || '',
          active: announcement.active || false,
          roles: permissions?.roles || [],
        });

        if (announcement.image_path) {
          setImagePreview(`/api/announcement/image?filename=${announcement.image_path}`);
        }
      }

      setProducts(Array.isArray(prodRes) ? prodRes : []);
    } catch (err) {
      console.error(err);
      message.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(info) {
    const file = info.file?.originFileObj || info.file;
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      message.error('File terlalu besar. Maksimal 2MB');
      return;
    }

    setImageFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    form.setFieldsValue({ keep_image: false, image_removed: true });
  }

  async function handleSubmit(values) {
    setSaving(true);
    try {
      let imageBase64 = null;
      let keepImage = true;

      if (imageFile) {
        // New image uploaded
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(imageFile);
        });
        keepImage = false;
      } else if (values.image_removed) {
        // Image explicitly removed
        keepImage = false;
        imageBase64 = null;
      } else {
        // Keep existing image
        keepImage = true;
      }

      const payload = {
        title: values.title,
        content: values.content,
        product_id: values.product_id || null,
        link_url: values.link_url || '',
        link_label: values.link_label || '',
        image_base64: imageBase64,
        keep_image: keepImage,
        image_path: initialData?.image_path,
        active: values.active === true,
      };

      // Only send permissions for superadmin
      if (isSuperadmin) {
        payload.permissions = { roles: values.roles || [] };
      }

      const res = await fetch('/api/announcement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Gagal menyimpan');
      }

      message.success('Pengumuman berhasil disimpan');
      setImageFile(null);
      fetchData(); // Refresh to get updated values
    } catch (err) {
      message.error(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card title="Pengumuman" className="w-full max-w-2xl mx-auto">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          active: false,
          title: '',
          content: '',
          product_id: null,
          link_url: '',
          link_label: '',
          roles: [],
        }}
      >
        <Form.Item label="Aktif" name="active" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="Judul" name="title">
          <Input placeholder="Judul pengumuman" />
        </Form.Item>

        <Form.Item label="Isi Pengumuman" name="content">
          <TextArea rows={4} placeholder="Tulis isi pengumuman..." />
        </Form.Item>

        <Form.Item label="Gambar">
          <div className="flex flex-col gap-2">
            <Upload
              accept="image/png,image/jpeg,image/webp"
              showUploadList={false}
              beforeUpload={(file) => {
                handleImageChange({ file });
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Pilih Gambar</Button>
            </Upload>
            {imagePreview && (
              <div className="relative inline-block">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={200}
                  className="rounded"
                  preview={false}
                />
                <Button
                  size="small"
                  danger
                  className="absolute top-1 right-1"
                  onClick={handleRemoveImage}
                >
                  Hapus
                </Button>
              </div>
            )}
          </div>
        </Form.Item>

        <Form.Item label="Produk Terkait" name="product_id">
          <Select
            allowClear
            placeholder="Pilih produk (opsional)"
            showSearch
            filterOption={(input, option) =>
              (option?.label || '').toLowerCase().includes(input.toLowerCase())
            }
            options={products.map((p) => ({
              value: p.id,
              label: `${p.name} (Rp ${p.price || 0})`,
            }))}
          />
        </Form.Item>

        <Form.Item label="Link URL" name="link_url">
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item label="Label Link" name="link_label">
          <Input placeholder="Lihat Detail" />
        </Form.Item>

        {isSuperadmin && (
          <Form.Item label="Role yang boleh mengedit" name="roles">
            <Checkbox.Group>
              <div className="flex flex-col gap-2">
                {['admin', 'admin_sales'].map((role) => (
                  <Checkbox key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Simpan
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
