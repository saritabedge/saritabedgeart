const grid = document.getElementById("grid");
const countEl = document.getElementById("count");

const fmt = n => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function checked(name) {
  return [...document.querySelectorAll(`input[data-filter="${name}"]:checked`)].map(i => i.value);
}

function render() {
  const avail = checked("availability");
  const sort = document.querySelector('input[name="sort"]:checked').value;

  let list = products.filter(p => {
    if (avail.length && !avail.includes(p.inStock ? "in" : "out")) return false;
    return true;
  });

  if (sort === "low") list.sort((a, b) => a.price - b.price);
  if (sort === "high") list.sort((a, b) => b.price - a.price);
  if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name));

  countEl.textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;

  grid.innerHTML = list.length ? list.map(p => `
    <a class="card" href="#" data-id="${p.id}">
      <div class="media">
        <div class="photo"><img src="${p.image}" alt="${p.name}" onerror="this.classList.add('missing')"></div>
        <div class="info">
          <h3 class="name">${p.name}</h3>
          <p class="price${p.inStock ? "" : " sold"}">${p.inStock ? fmt(p.price) : "Sold"}</p>
        </div>
      </div>
    </a>`).join("") : `<p class="empty">No items match your filters.</p>`;
}

// Dropdowns
document.querySelectorAll(".dropdown").forEach(dd => {
  dd.querySelector(".dd-btn").addEventListener("click", e => {
    e.stopPropagation();
    const open = dd.classList.contains("open");
    document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open"));
    if (!open) dd.classList.add("open");
  });
  dd.querySelector(".dd-menu").addEventListener("click", e => e.stopPropagation());
  dd.querySelector(".dd-menu").addEventListener("change", render);
});
document.addEventListener("click", () =>
  document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open")));

// Grid density toggle
document.querySelectorAll(".view-toggle button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".view-toggle button").forEach(b => b.classList.toggle("active", b === btn));
    grid.className = `grid cols-${btn.dataset.cols}`;
  });
});

render();

// ---------- Product detail / purchase ----------
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

function actionHTML(p) {
  if (!p.inStock) return `<p class="m-sold">Sold</p>`;
  const subject = encodeURIComponent(`Interested in: ${p.name}`);
  return `<p class="m-note">To purchase this item, please email</p>
    <a class="btn" href="mailto:${CONTACT_EMAIL}?subject=${subject}">${CONTACT_EMAIL}</a>`;
}

function openModal(id) {
  const p = products.find(x => x.id === id);
  modalBody.innerHTML = `
    <div class="m-photo"><img src="${p.image}" alt="${p.name}"></div>
    <div class="m-info">
      <h2>${p.name}</h2>
      <p class="m-price">${p.inStock ? fmt(p.price) : ""}</p>
      ${actionHTML(p)}
    </div>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }

grid.addEventListener("click", e => {
  const card = e.target.closest(".card");
  if (!card) return;
  e.preventDefault();
  openModal(Number(card.dataset.id));
});
modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".m-close")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
