let currentId = null;
let timerInterval = null;
let timerEndsAt = null;
const $ = id => document.getElementById(id);
function show(id) {
  ["step-request","step-wait","step-verify","step-result","step-rejected"].forEach(x => $(x).classList.toggle("hidden", x !== id));
  $("message").textContent = "";
}
function message(text) { $("message").textContent = text; }
async function api(url, options={}) {
  const res = await fetch(url, { headers: {"Content-Type":"application/json"}, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
$("requestForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const data = await api("/api/requests", {method:"POST", body:JSON.stringify({
      bundleId:$("bundle").value, phone:$("phone").value, luckyDigits:$("lucky").value
    })});
    currentId = data.id;
    $("requestId").textContent = currentId;
    show("step-wait");
  } catch(err) { message(err.message); }
});
async function checkStatus() {
  if (!currentId) return;
  try {
    const r = await api(`/api/requests/${currentId}`);
    if (r.status === "approved") {
      show("step-verify");
      startTimer();
    } else if (r.status === "rejected") {
      show("step-rejected");
    } else if (r.status === "trial-requested") {
      $("waitText").textContent = "Your additional trial request has been sent to the administrator.";
      show("step-wait");
    } else {
      $("waitText").textContent = "Waiting for administrator review. Select Check status again in a moment.";
    }
  } catch(err) { message(err.message); }
}
$("checkStatus").addEventListener("click", checkStatus);
function startTimer() {
  if (timerInterval) return;
  timerEndsAt = Date.now() + 60000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((timerEndsAt-Date.now())/1000));
    $("timer").textContent = remaining;
    if (remaining === 0) {
      clearInterval(timerInterval); timerInterval = null;
      $("retry").disabled = false;
      $("retry").textContent = "Request another trial";
    }
  };
  tick(); timerInterval = setInterval(tick, 250);
}
$("verifyForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const data = await api(`/api/requests/${currentId}/verify`, {method:"POST",body:JSON.stringify({lastFour:$("lastFour").value})});
    $("resultText").textContent = `Your ${data.bundleLabel} request passed the phone-number check. This is a preview, not confirmation of data delivery.`;
    show("step-result");
    if (!timerEndsAt) startTimer();
  } catch(err) { message(err.message); }
});
$("retry").addEventListener("click", async () => {
  try {
    await api(`/api/requests/${currentId}/retry`, {method:"POST",body:"{}"});
    $("waitText").textContent = "Your additional trial request has been sent to the administrator.";
    show("step-wait");
  } catch(err) { message(err.message); }
});
$("back").addEventListener("click", () => {
  currentId = null; $("requestForm").reset(); show("step-request");
});
