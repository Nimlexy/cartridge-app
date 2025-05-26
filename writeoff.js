document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("writeoff-form");
  const cartridgeInput = document.getElementById("cartridge_search");
  const cartridgeList = document.getElementById("cartridge-list");
  const result = document.getElementById("writeoff-result");
  let cartridges = [];

  // Загрузка списка картриджей
  const res = await fetch("/get_cartridges");
  cartridges = await res.json();

  cartridges.forEach(c => {
    const option = document.createElement("option");
    option.value = c.name;
    cartridgeList.appendChild(option);
  });

  // Обработка формы
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selected = cartridges.find(c => c.name === cartridgeInput.value);
    if (!selected) {
      alert("Указанный картридж не найден в базе");
      return;
    }

    const data = {
      order_number: document.getElementById("order_number").value.trim(),
      initiator: document.getElementById("initiator").value.trim(),
      cartridge_id: selected.id,
      printer_model: document.getElementById("printer_model").value.trim(),
      organization: document.getElementById("organization").value.trim(),
      cartridge_type: document.getElementById("cartridge_type").value,
      quantity: parseInt(document.getElementById("quantity").value)
    };

    const response = await fetch("/writeoff_extended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      result.classList.remove("hidden");
      form.reset();
    } else {
      result.textContent = "Ошибка при списании.";
      result.classList.remove("text-green-600");
      result.classList.add("text-red-600");
      result.classList.remove("hidden");
    }
  });
});
