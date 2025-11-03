// Helper: parse time "HH:MM" to minutes since midnight
function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToHHMM(mins) {
  mins = Math.round(mins);
  mins = ((mins % (24*60)) + (24*60)) % (24*60); // normalize day
  const h = Math.floor(mins / 60).toString().padStart(2,"0");
  const m = (mins % 60).toString().padStart(2,"0");
  return `${h}:${m}`;
}

document.getElementById("calcBtn").addEventListener("click", function () {
  const batches = Number(document.getElementById("batches").value);
  if (!batches || batches <= 0) {
    alert("الرجاء إدخال عدد الطبخات (batches) صحيح.");
    return;
  }

  // Read workers in order
  const rows = Array.from(document.querySelectorAll(".worker-row"));
  const workers = [];
  for (let r of rows) {
    const name = r.querySelector(".name").value.trim();
    const ovens = Number(r.querySelector(".ovens").value) || 0;
    const minutes = Number(r.querySelector(".minutes").value) || 0;
    const startTimeStr = r.querySelector(".startTime").value;
    const startMin = timeToMinutes(startTimeStr);
    // skip completely empty rows (no name and ovens 0)
    if (!name && ovens === 0 && !minutes && !startMin) continue;
    workers.push({name, ovens, minutes, startMin});
  }
  if (workers.length === 0) {
    alert("أدخل بيانات عامل واحد على الأقل.");
    return;
  }

  // Build ovens list in sequence: ovens are objects with owner and local index and available time
  const ovensList = [];
  let globalOvenId = 0;
  for (const w of workers) {
    for (let i = 0; i < w.ovens; i++) {
      // initial available = worker start + i*2 minutes (2 minute gap between ovens of same worker)
      const initialAvail = (w.startMin != null) ? (w.startMin + i * 2) : 0;
      ovensList.push({
        id: globalOvenId++,
        owner: w.name || `Worker${globalOvenId}`,
        ownerIndex: ovensList.length, // not really needed
        localIndex: i, // index within this worker
        available: initialAvail, // in minutes since midnight
        ops: [] // list of {batch, start, end}
      });
    }
  }

  // If no ovens at all
  if (ovensList.length === 0) {
    alert("لم تدخل أي أفران. أدخل عدد الأفران لكل عامل.");
    return;
  }

  // Scheduling algorithm:
  // For batch = 0 .. batches-1:
  //  create 5 carts; for each cart find oven with earliest available time, schedule cart at that oven:
  //   start = oven.available (we assume batch ready immediately)
  //   end = start + minutesPerOven (we'll choose minutesPerOven from the owner of that oven)
  // Note: minutesPerOven may differ per worker; we use the owner of the oven's minutes value.

  // Helper to find worker minutes by name (first match)
  function minutesForOwner(ownerName) {
    const w = workers.find(x => x.name === ownerName);
    return w ? w.minutes : 0;
  }

  // Simulate
  for (let batch = 0; batch < batches; batch++) {
    // For each batch, we need to schedule 5 carts
    for (let cart = 0; cart < 5; cart++) {
      // choose oven with minimum available time
      let minIdx = 0;
      let minAvail = ovensList[0].available;
      for (let i = 1; i < ovensList.length; i++) {
        if (ovensList[i].available < minAvail) {
          minAvail = ovensList[i].available;
          minIdx = i;
        }
      }
      const oven = ovensList[minIdx];
      const M = minutesForOwner(oven.owner);
      if (!M || M <= 0) {
        // If owner's minutes not set, assume 10 minutes default to avoid infinite
        console.warn("Missing minutes per oven for owner:", oven.owner, "— using 10 min default.");
      }
      const useMinutes = (M && M>0) ? M : 10;
      const start = oven.available; // start when oven free (we assume batch is ready)
      const end = start + useMinutes;
      // record operation
      oven.ops.push({batch: batch+1, start, end});
      // update oven availability
      oven.available = end;
    }
  }

  // Build results
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  // Per-oven summary table
  const ovensByOwner = {};
  ovensList.forEach(o => {
    if (!ovensByOwner[o.owner]) ovensByOwner[o.owner] = [];
    ovensByOwner[o.owner].push(o);
  });

  // Worker end times (take max available among their ovens)
  const workerSummaries = workers.map(w => {
    // find ovens for this worker
    const owned = ovensList.filter(o => o.owner === w.name);
    const lastFinish = owned.length ? Math.max(...owned.map(o => (o.ops.length? o.ops[o.ops.length-1].end : o.available))) : (w.startMin || 0);
    return {name: w.name, ovens: owned, minutes: w.minutes, start: w.startMin, endMin: lastFinish};
  });

  // Show worker summaries
  for (const ws of workerSummaries) {
    const block = document.createElement("div");
    block.className = "result-block";
    block.innerHTML = `<div><strong>${ws.name}</strong> — يبدأ: <span class="small">${ws.start != null ? minutesToHHMM(ws.start) : "-"}</span> — ينتهي (آخر فرن): <strong>${minutesToHHMM(ws.endMin)}</strong></div>`;
    // table of ovens for this worker
    if (ws.ovens.length) {
      let table = `<table class="table"><thead><tr><th>Oven ID</th><th>First start</th><th>Last end</th><th>#ops</th></tr></thead><tbody>`;
      for (const o of ws.ovens) {
        const firstStart = o.ops.length ? minutesToHHMM(o.ops[0].start) : "-";
        const lastEnd = o.ops.length ? minutesToHHMM(o.ops[o.ops.length-1].end) : minutesToHHMM(o.available);
        table += `<tr><td>${o.id}</td><td>${firstStart}</td><td>${lastEnd}</td><td>${o.ops.length}</td></tr>`;
      }
      table += `</tbody></table>`;
      block.innerHTML += table;
    } else {
      block.innerHTML += `<div class="small">لا توجد أفران لهذا العامل.</div>`;
    }
    resultsDiv.appendChild(block);
  }

  /* // --- (تم إلغاء هذا الجزء بناءً على طلبك) ---
  // Optionally: full oven timeline (detailed)
  const detailBlock = document.createElement("div");
  detailBlock.className = "result-block";
  detailBlock.innerHTML = `<strong>تفصيل كل فرن (عمليات)</strong>`;
  let html = "";
  ovensList.forEach(o => {
    html += `<div style="margin-top:8px"><em>Oven ${o.id} — Owner: ${o.owner}</em><div class="small">Operations: ${o.ops.length}</div>`;
    if (o.ops.length) {
      html += `<table class="table"><thead><tr><th>Batch</th><th>Start</th><th>End</th></tr></thead><tbody>`;
      o.ops.forEach(op => {
        html += `<tr><td>${op.batch}</td><td>${minutesToHHMM(op.start)}</td><td>${minutesToHHMM(op.end)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;
  });
  detailBlock.innerHTML += html;
  resultsDiv.appendChild(detailBlock);
  */

});
