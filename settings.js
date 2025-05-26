document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("settings-table-body");

  const res = await fetch("/get_cartridges");
  const cartridges = await res.json();

  cartridges.forEach(cart => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="px-6 py-4">${cart.name}</td>
      <td class="px-6 py-4">
        <input type="number" value="${cart.min_quantity}" min="0" data-id="${cart.id}"
               class="min-quantity-input border border-gray-300 p-1 rounded w-20" />
      </td>
      <td class="px-6 py-4">
        <button data-id="${cart.id}" class="save-btn text-blue-600 hover:underline">Сохранить</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  tableBody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("save-btn")) {
      const id = e.target.dataset.id;
      const input = tableBody.querySelector(`input[data-id="${id}"]`);
      const newMin = parseInt(input.value);

      const res = await fetch("/update_min_quantity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: parseInt(id), min_quantity: newMin })
      });

      if (res.ok) {
        input.classList.add("bg-green-100");
        setTimeout(() => input.classList.remove("bg-green-100"), 1000);
      }
    }
  });
});
