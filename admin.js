// Password-protected admin panel. Saves changes into the GitHub repo through the GitHub API;
// GitHub Pages then republishes the site. The access token is stored encrypted (AES-GCM,
// key derived from the password) and is only decrypted in memory after the password is entered.
(function () {
  const cfg = ADMIN_CONFIG;
  const modal = document.getElementById("adminModal");
  const body = document.getElementById("adminBody");
  let token = null;

  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function decryptToken(password, { salt, iv, data }) {
    const keyMat = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: fromB64(salt), iterations: 250000, hash: "SHA-256" },
      keyMat, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(data)));
  }

  // ----- GitHub API -----
  async function gh(path, opts = {}) {
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}` + (opts.method ? "" : `?ref=${cfg.branch}&t=${Date.now()}`);
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(res.status === 409 || res.status === 422 ? "The site changed while you were editing. Close and reopen the panel, then try again." : `GitHub error ${res.status}`);
    return res.json();
  }
  const put = (path, contentB64, message, sha) => gh(path, {
    method: "PUT",
    body: JSON.stringify({ message, content: contentB64, branch: cfg.branch, ...(sha ? { sha } : {}) }),
  });

  async function loadProducts() {
    const f = await gh("products.js");
    const bytes = fromB64(f.content.replace(/\n/g, ""));
    const text = new TextDecoder().decode(bytes);
    const m = text.match(/const products = (\[[\s\S]*\]);/);
    if (!m) throw new Error("Could not read products.js");
    return { sha: f.sha, text, list: JSON.parse(m[1]) };
  }

  async function saveProducts(base, list, message) {
    const text = base.text.replace(/const products = \[[\s\S]*\];/, () => "const products = " + JSON.stringify(list, null, 2) + ";");
    const bytes = new TextEncoder().encode(text);
    let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
    await put("products.js", btoa(bin), message, base.sha);
    // Show the change immediately on this page (the public site follows in ~1 minute)
    products.splice(0, products.length, ...list);
    render();
  }

  // Shrink phone photos before upload
  async function resizeImage(file, max = 1400) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(blob); });
  }

  // ----- UI -----
  const open = () => { modal.hidden = false; document.body.style.overflow = "hidden"; };
  const close = () => { modal.hidden = true; document.body.style.overflow = ""; };
  const setStatus = (msg, isError) => {
    const el = document.getElementById("aStatus");
    if (el) { el.textContent = msg; el.className = "a-status" + (isError ? " err" : ""); }
  };

  function showLogin() {
    if (!cfg.owner || !cfg.repo || !cfg.lockedToken) {
      body.innerHTML = `<h2>Manage items</h2><p class="a-note">Admin isn't set up yet. Follow <code>setup/README.md</code> to connect the site to GitHub.</p>`;
      return open();
    }
    body.innerHTML = `
      <h2>Manage items</h2>
      <form id="aLogin">
        <label>Password<input type="password" id="aPass" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Unlock</button>
        <p id="aStatus" class="a-status"></p>
      </form>`;
    open();
    document.getElementById("aPass").focus();
    document.getElementById("aLogin").addEventListener("submit", async e => {
      e.preventDefault();
      setStatus("Checking…");
      try { token = await decryptToken(document.getElementById("aPass").value, cfg.lockedToken); }
      catch { return setStatus("Wrong password.", true); }
      showPanel();
    });
  }

  async function showPanel() {
    body.innerHTML = `<h2>Manage items</h2><p id="aStatus" class="a-status">Loading…</p>`;
    let base;
    try { base = await loadProducts(); } catch (err) { return setStatus(err.message, true); }

    const rows = base.list.map(p => `
      <div class="a-row" data-id="${p.id}">
        <img src="${esc(p.image)}" alt="">
        <input class="a-name" value="${esc(p.name)}" aria-label="Name">
        <input class="a-price" type="number" min="0" step="0.01" value="${p.price}" aria-label="Price">
        <label class="a-sold"><input type="checkbox" ${p.inStock ? "" : "checked"}> Sold</label>
        <button class="a-save">Save</button>
        <button class="a-del" aria-label="Delete">Delete</button>
      </div>`).join("");

    body.innerHTML = `
      <h2>Manage items</h2>
      <p id="aStatus" class="a-status"></p>
      <form id="aAdd" class="a-add">
        <h3>Add an item</h3>
        <input type="file" id="aPhoto" accept="image/*" required>
        <input type="text" id="aName" placeholder="Name" required>
        <input type="number" id="aPrice" placeholder="Price ($)" min="0" step="0.01" required>
        <button class="btn" type="submit">Add item</button>
      </form>
      <h3>Current items</h3>
      <div class="a-list">${rows || "<p class='a-note'>No items yet.</p>"}</div>`;

    document.getElementById("aAdd").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true; setStatus("Uploading…");
      try {
        const file = document.getElementById("aPhoto").files[0];
        const name = document.getElementById("aName").value.trim();
        const price = Number(document.getElementById("aPrice").value);
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
        const path = `images/${slug}-${Date.now()}.jpg`;
        await put(path, await resizeImage(file), `Add photo for ${name}`);
        const fresh = await loadProducts();
        const id = fresh.list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
        await saveProducts(fresh, [...fresh.list, { id, name, price, inStock: true, image: path }], `Add ${name}`);
        showPanel();
        setTimeout(() => setStatus("Added! It will be live for everyone in about a minute."), 300);
      } catch (err) { btn.disabled = false; setStatus(err.message, true); }
    });

    body.querySelectorAll(".a-row").forEach(row => {
      const id = Number(row.dataset.id);
      const update = async (fn, msg) => {
        setStatus("Saving…");
        try {
          const fresh = await loadProducts();
          await saveProducts(fresh, fn(fresh.list), msg);
          setStatus("Saved! It will be live for everyone in about a minute.");
          return true;
        } catch (err) { setStatus(err.message, true); }
      };
      row.querySelector(".a-save").addEventListener("click", () => {
        const name = row.querySelector(".a-name").value.trim();
        const price = Number(row.querySelector(".a-price").value);
        const sold = row.querySelector(".a-sold input").checked;
        if (!name || isNaN(price)) return setStatus("Enter a name and a price.", true);
        update(list => list.map(p => p.id === id ? { ...p, name, price, inStock: !sold } : p), `Update ${name}`);
      });
      row.querySelector(".a-del").addEventListener("click", async () => {
        if (!confirm("Delete this item from the site?")) return;
        if (await update(list => list.filter(p => p.id !== id), `Remove item ${id}`)) row.remove();
      });
    });
  }

  document.getElementById("adminBtn").addEventListener("click", () => token ? (open(), showPanel()) : showLogin());
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".a-close")) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) close(); });
})();
