document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("supply-form");
  const result = document.getElementById("supply-result");

  function showMessage(text, success = true) {
    result.textContent = text;
    result.classList.remove("hidden");
    result.classList.toggle("text-green-600", success);
    result.classList.toggle("text-red-600", !success);
    setTimeout(() => result.classList.add("hidden"), 3000);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById("cartridge_name").value.trim(),
      quantity: parseInt(document.getElementById("quantity").value),
      printer_model: document.getElementById("printer_model").value.trim(),
      cartridge_type: document.getElementById("cartridge_type").value,
      organization: document.getElementById("organization").value.trim()
    };

    const res = await fetch("/supply_cartridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      showMessage("Поставка внесена успешно ✅", true);
      form.reset();
    } else {
      showMessage("Ошибка при внесении поставки ❌", false);
    }
  });
});
