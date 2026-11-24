document.getElementById("load").addEventListener("click", async () => {
  const out = document.getElementById("output");
  out.textContent = "Loading...";
  try {
    const r = await fetch("/api/admin/requests", {headers:{"x-admin-password":document.getElementById("password").value}});
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Unable to load.");
    out.textContent = JSON.stringify(data, null, 2);
  } catch(e) { out.textContent = e.message; }
});
