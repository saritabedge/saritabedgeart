const grid = document.getElementById("grid");
const countEl = document.getElementById("count");

const fmt = n => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function checked(name) {
  return [...document.querySelectorAll(`input[data-filter="${name}"]:checked`)].map(i => i.value);
}

// All photos for a product (older entries only have a single "image")
const photosOf = p => p.images && p.images.length ? p.images : [p.image];

function carouselHTML(p) {
  const photos = photosOf(p);
  const imgs = photos.map((src, i) =>
    `<img src="${src}" alt="${p.name}${photos.length > 1 ? ` (photo ${i + 1})` : ""}"${i ? ' loading="lazy"' : ""} class="${i ? "" : "active"}" onerror="this.classList.add('missing')">`).join("");
  if (photos.length < 2) return imgs;
  return imgs + `
    <button class="c-nav c-prev" aria-label="Previous photo"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
    <button class="c-nav c-next" aria-label="Next photo"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
    <div class="c-dots">${photos.map((_, i) => `<span class="${i ? "" : "active"}"></span>`).join("")}</div>`;
}

function step(carousel, dir) {
  const imgs = [...carousel.querySelectorAll("img")];
  const dots = [...carousel.querySelectorAll(".c-dots span")];
  if (imgs.length < 2) return;
  const cur = imgs.findIndex(img => img.classList.contains("active"));
  const next = (cur + dir + imgs.length) % imgs.length;
  imgs.forEach((img, i) => img.classList.toggle("active", i === next));
  dots.forEach((d, i) => d.classList.toggle("active", i === next));
}

document.addEventListener("click", e => {
  const nav = e.target.closest(".c-nav");
  if (!nav) return;
  e.preventDefault();
  step(nav.parentElement, nav.classList.contains("c-prev") ? -1 : 1);
});

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
        <div class="photo carousel">${carouselHTML(p)}</div>
        <div class="info">
          <h3 class="name">${p.name}</h3>
          ${p.location ? `<p class="location">${p.location}</p>` : ""}
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
    <div class="m-photo carousel">${carouselHTML(p)}</div>
    <div class="m-info">
      <h2>${p.name}</h2>
      ${p.location ? `<p class="m-location">${p.location}</p>` : ""}
      <p class="m-price">${p.inStock ? fmt(p.price) : ""}</p>
      ${actionHTML(p)}
    </div>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }

grid.addEventListener("click", e => {
  const card = e.target.closest(".card");
  if (!card || e.target.closest(".c-nav")) return;
  e.preventDefault();
  openModal(Number(card.dataset.id));
});
modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".m-close")) closeModal(); });
document.addEventListener("keydown", e => {
  if (modal.hidden) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") step(modalBody.querySelector(".carousel"), e.key === "ArrowLeft" ? -1 : 1);
});
