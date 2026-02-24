import * as XLSX from "xlsx";

export const downloadProductTemplate = async () => {
    let categoriesData = [];
    try {
        const res = await fetch("/api/categories");
        if (res.ok) categoriesData = await res.json();
    } catch (e) {
        console.error("Failed to load categories", e);
    }

    const ws = XLSX.utils.json_to_sheet([
        {
            "Nama Produk": "Snack A",
            "Deskripsi": "Snack A adalah snack yang sangat enak",
            "Kategori": categoriesData.length > 0 ? categoriesData[0].name : "Makanan Ringan",
            "Tampilkan Stok": "Ya",
            "Unit": "pcs",
            "Isi per Unit": 1,
            "Harga": 15000,
            "Stok": 100
        },
        {
            "Nama Produk": "Snack A",
            "Deskripsi": "Snack A adalah snack yang sangat enak",
            "Kategori": categoriesData.length > 0 ? categoriesData[0].name : "Makanan Ringan",
            "Tampilkan Stok": "Ya",
            "Unit": "lusin",
            "Isi per Unit": 12,
            "Harga": 170000,
            "Stok": 50
        },
        {
            "Nama Produk": "Mie Instan",
            "Deskripsi": "Mie Instan adalah mie yang sangat enak",
            "Kategori": categoriesData.length > 0 ? categoriesData[0].name : "Makanan Instant",
            "Tampilkan Stok": "Tidak",
            "Unit": "pcs",
            "Isi per Unit": 1,
            "Harga": 3500,
            "Stok": 200
        }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produk");

    if (categoriesData && categoriesData.length > 0) {
        const wsCat = XLSX.utils.json_to_sheet(categoriesData.map(c => ({
            "ID Kategori": c.id,
            "Nama Kategori": c.name
        })));
        XLSX.utils.book_append_sheet(wb, wsCat, "Daftar Kategori");
    }

    XLSX.writeFile(wb, "Template_Produk.xlsx");
};

export const parseProductExcel = async (file) => {
    let categoriesData = [];
    try {
        const res = await fetch("/api/categories");
        if (res.ok) categoriesData = await res.json();
    } catch (e) {
        console.error("Failed to load categories", e);
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const productsMap = {};
                jsonData.forEach((row) => {
                    const name = row["Nama Produk"] || row["Nama"] || row["Name"] || row["name"];
                    if (!name) return;

                    const desc = row["Deskripsi"] || row["Description"] || row["description"] || "";
                    let cat = row["Kategori"] || row["Kategori ID"] || row["Category ID"] || row["category_id"] || null;

                    if (cat !== null) {
                        const matchingCat = categoriesData.find(c => String(c.id) === String(cat) || String(c.name).toLowerCase() === String(cat).toLowerCase().trim());
                        if (matchingCat) {
                            cat = matchingCat.id;
                        }
                    }

                    const unit = row["Unit"] || row["unit"] || "pcs";
                    const qty = Number(row["Isi per Unit"] || row["Isi"] || row["Qty"] || row["qty_per_unit"]) || 1;
                    const price = Number(row["Harga"] || row["Price"] || row["price"]) || 0;
                    const stock = Number(row["Stok"] || row["Stock"] || row["stock"]) || 0;

                    let show_stock = 1;
                    if (row["Tampilkan Stok"] !== undefined) {
                        const val = String(row["Tampilkan Stok"]).toLowerCase().trim();
                        if (val === "tidak" || val === "no" || val === "0" || val === "false") {
                            show_stock = 0;
                        }
                    }

                    if (!productsMap[name]) {
                        productsMap[name] = {
                            name,
                            description: desc,
                            category: cat,
                            show_stock,
                            units: [],
                        };
                    } else {
                        // Update description or category only if the current row has them and the previous didn't
                        if (!productsMap[name].description && desc) {
                            productsMap[name].description = desc;
                        }
                        if (!productsMap[name].category && cat) {
                            productsMap[name].category = cat;
                        }
                        // Update show_stock if explicitly set to 0 in any row (more conservative approach to hide)
                        if (show_stock === 0) {
                            productsMap[name].show_stock = 0;
                        }
                    }

                    if (unit) {
                        productsMap[name].units.push({
                            unit_name: unit,
                            qty_per_unit: qty,
                            price,
                            stock,
                        });
                    }
                });

                const productsArray = Object.values(productsMap);
                resolve(productsArray);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
};
