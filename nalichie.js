let allCartridges = [];
let currentSortKey = 'name';
let sortAsc = true;

document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.querySelector('input[type="text"]');
  await reloadData();

  searchInput.addEventListener("input", () => {
    renderTable(filterData(allCartridges, searchInput.value));
  });
});

async function reloadData() {
  const res = await fetch("/get_cartridges");
  allCartridges = await res.json();

  if (!allCartridges.length) {
    document.getElementById("no-data").style.display = "block";
    return;
  }

  const q = document.querySelector('input[type="text"]').value;
  renderTable(filterData(allCartridges, q));
}

function filterData(data, query) {
  const q = query.toLowerCase();
  return data.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.printer_model || "").toLowerCase().includes(q) ||
    (item.organization || "").toLowerCase().includes(q) ||
    (item.manufacturer || "").toLowerCase().includes(q)
  );
}

function sortTable(key) {
  if (currentSortKey === key) {
    sortAsc = !sortAsc;
  } else {
    currentSortKey = key;
    sortAsc = true;
  }
  const sorted = [...allCartridges].sort((a, b) => {
    const A = (a[key] || "").toString().toLowerCase();
    const B = (b[key] || "").toString().toLowerCase();
    if (!isNaN(A) && !isNaN(B)) {
      return sortAsc ? A - B : B - A;
    }
    return sortAsc ? A.localeCompare(B) : B.localeCompare(A);
  });

  const query = document.querySelector('input[type="text"]').value;
  renderTable(filterData(sorted, query));
}

function renderTable(data) {
  const tableBody = document.getElementById("stock-table-body");
  tableBody.innerHTML = "";

  data.forEach(row => {
    const status = getStatus(row.quantity, row.min_quantity);
    const tr = document.createElement("tr");
    tr.className = status.rowClass;
    tr.innerHTML = `
      <td class="px-6 py-4">${row.name}</td>
      <td class="px-6 py-4">${row.printer_model || "—"}</td>
      <td class="px-6 py-4">${row.manufacturer || "—"}</td>
      <td class="px-6 py-4">${row.quantity}</td>
      <td class="px-6 py-4">${row.min_quantity}</td>
      <td class="px-6 py-4">${row.organization || "—"}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs font-medium rounded ${status.badgeClass}">
          ${status.label}
        </span>
      </td>
      <td class="px-6 py-4">
        <button class="text-blue-600 hover:underline text-sm mr-2" onclick="openEditModal(${row.id})">✏️</button>
        <button class="text-red-600 hover:underline text-sm" onclick="openWriteoffModal(${row.id})">🗑️</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function getStatus(qty, min) {
  if (qty === 0) return {
    label: "Нет",
    badgeClass: "bg-red-200 text-red-800",
    rowClass: "bg-red-50"
  };
  if (qty < min) return {
    label: "Мало",
    badgeClass: "bg-yellow-200 text-yellow-800",
    rowClass: "bg-yellow-50"
  };
  return {
    label: "Ок",
    badgeClass: "bg-green-200 text-green-800",
    rowClass: ""
  };
}

// ✏️ Редактирование
function openEditModal(id) {
  const item = allCartridges.find(c => c.id === id);
  if (!item) return;

  document.getElementById("edit-id").value = id;
  document.getElementById("edit-name").value = item.name;
  document.getElementById("edit-printer").value = item.printer_model || "";
  document.getElementById("edit-manufacturer").value = item.manufacturer || "";
  document.getElementById("edit-organization").value = item.organization || "";
  document.getElementById("edit-quantity").value = item.quantity;
  document.getElementById("edit-min").value = item.min_quantity;

  document.getElementById("editModal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
}

document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("edit-id").value;
  const payload = {
    id,
    name: document.getElementById("edit-name").value.trim(),
    printer_model: document.getElementById("edit-printer").value.trim(),
    manufacturer: document.getElementById("edit-manufacturer").value.trim(),
    organization: document.getElementById("edit-organization").value.trim(),
    quantity: parseInt(document.getElementById("edit-quantity").value),
    min_quantity: parseInt(document.getElementById("edit-min").value)
  };

  const res = await fetch("/update_cartridge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeEditModal();
    await reloadData();
  }
});

// 🗑️ Списание
function openWriteoffModal(id) {
  const item = allCartridges.find(c => c.id === id);
  if (!item) return;

  document.getElementById("writeoff-id").value = id;
  document.getElementById("writeoff-printer").value = item.printer_model || "";
  document.getElementById("writeoff-organization").value = item.organization || "";

  document.getElementById("writeoffModal").classList.remove("hidden");
}

function closeWriteoffModal() {
  document.getElementById("writeoffModal").classList.add("hidden");
}

document.getElementById("writeoffForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    cartridge_id: parseInt(document.getElementById("writeoff-id").value),
    order_number: document.getElementById("writeoff-order").value.trim(),
    initiator: document.getElementById("writeoff-initiator").value.trim(),
    printer_model: document.getElementById("writeoff-printer").value.trim(),
    organization: document.getElementById("writeoff-organization").value.trim(),
    cartridge_type: document.getElementById("writeoff-type").value,
    quantity: parseInt(document.getElementById("writeoff-qty").value)
  };

  const res = await fetch("/writeoff_extended", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeWriteoffModal();
    await reloadData();
  }
});

// 📥 Экспорт CSV
function exportToCSV() {
  const headers = ["Модель", "Принтер", "Производитель", "Количество", "Минимум", "Организация", "Статус"];
  let rows = [headers.join(",")];

  const q = document.querySelector('input[type="text"]').value;
  const filtered = filterData(allCartridges, q);

  filtered.forEach(row => {
    const status = getStatus(row.quantity, row.min_quantity).label;
    const line = [
      row.name,
      row.printer_model || "—",
      row.manufacturer || "—",
      row.quantity,
      row.min_quantity,
      row.organization || "—",
      status
    ];
    rows.push(line.join(","));
  });

  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "nalichie_export.csv";
  link.click();
}

// 📥 Экспорт Excel с сервера
function exportToExcelFromServer() {
  fetch('/export_stock')
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nalichie_export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
}
