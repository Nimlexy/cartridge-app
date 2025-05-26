document.addEventListener("DOMContentLoaded", async () => {
  const cartridgeInput = document.getElementById("cartridge_search");
  const cartridgeList = document.getElementById("cartridge-list");
  const writeoffForm = document.getElementById("writeoff-form");
  const supplyForm = document.getElementById("quick-supply-form");
  const cartridges = await fetch("/get_cartridges").then(res => res.json());

  // Подгрузка картриджей в datalist
  cartridges.forEach(c => {
    const option = document.createElement("option");
    option.value = c.name;
    cartridgeList.appendChild(option);
  });

  // Обработка формы списания
  writeoffForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selected = cartridges.find(c => c.name === cartridgeInput.value);
    if (!selected) return alert("Картридж не найден.");

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
      document.getElementById("writeoff-result").classList.remove("hidden");
      writeoffForm.reset();
      updateStats(document.getElementById("date").value);
    }
  });

  // Обработка быстрой поставки
  supplyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("supply-name").value.trim();
    const qty = parseInt(document.getElementById("supply-qty").value);

    const res = await fetch("/add_cartridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, quantity: qty, min_quantity: 1 })
    });

    if (res.ok) {
      document.getElementById("supply-result").classList.remove("hidden");
      supplyForm.reset();
      updateStats(document.getElementById("date").value);
    }
  });

  // Установка сегодняшней даты и загрузка статистики
  const dateInput = document.getElementById("date");
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  updateStats(today);

  dateInput.addEventListener("change", (e) => {
    updateStats(e.target.value);
  });

  // Закрытие модального окна по клику вне области
  document.getElementById("writeoff-modal").addEventListener("click", (e) => {
    const modalBox = document.getElementById("writeoff-box");
    if (!modalBox.contains(e.target)) {
      closeWriteoffModal();
    }
  });
});

// Статистика по дате
async function updateStats(dateStr) {
  const res = await fetch(`/get_statistics?date=${dateStr}`);
  const stats = await res.json();

  document.getElementById("total-models").textContent = stats.total_models;
  document.getElementById("supplied-today").textContent = stats.supplied;
  document.getElementById("written-off-today").textContent = stats.written_off;
  document.getElementById("below-minimum").textContent = stats.below_minimum;
}

// Модальное окно
function openWriteoffModal() {
  document.getElementById("writeoff-modal").classList.remove("hidden");
}
function closeWriteoffModal() {
  document.getElementById("writeoff-modal").classList.add("hidden");
}
