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
    // skip completely empty rows
    if (!name && ovens === 0 && !minutes && !startMin) continue;
    workers.push({name: name || `عامل ${workers.length + 1}`, ovens, minutes, startMin});
  }
  if (workers.length === 0) {
    alert("أدخل بيانات عامل واحد على الأقل.");
    return;
  }

  // Build ovens list in sequence
  const ovensList = [];
  let globalOvenId = 1; // يبدأ من 1
  for (const w of workers) {
    for (let i = 0; i < w.ovens; i++) {
      // initial available = worker start + i*2 minutes (2 minute gap between ovens of same worker)
      const initialAvail = (w.startMin != null) ? (w.startMin + i * 2) : 0;
      ovensList.push({
        id: globalOvenId++,
        owner: w.name,
        localIndex: i, 
        available: initialAvail, // in minutes since midnight
        ops: [] // list of {batch, start, end}
      });
    }
  }

  if (ovensList.length === 0) {
    alert("لم تدخل أي أفران. أدخل عدد الأفران لكل عامل.");
    return;
  }

  // Helper to find worker minutes by name
  function minutesForOwner(ownerName) {
    const w = workers.find(x => x.name === ownerName);
    return w ? w.minutes : 0;
  }

  // --- (خوارزمية الجدولة: تبقى كما هي) ---
  // (5 عربات لكل طبخة، توزع على أول فرن متاح)
  const allOpsList = []; // لتخزين جميع العمليات للجدول الزمني
  
  for (let batch = 0; batch < batches; batch++) {
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
      const useMinutes = (M && M>0) ? M : 70; // استخدام 70 كافتراضي إذا لم يدخل
      
      const start = oven.available; 
      const end = start + useMinutes;
      
      const op = {
          batch: batch+1, 
          cart: cart+1,
          start, 
          end,
          owner: oven.owner, // إضافة لسهولة الفرز
          ovenId: oven.id    // إضافة لسهولة الفرز
      };
      
      oven.ops.push(op);
      allOpsList.push(op); // إضافة العملية للقائمة العامة
      
      oven.available = end;
    }
  }
  // --- (نهاية الخوارزمية) ---


  // --- بناء النتائج (القسم الجديد بالكامل) ---
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = ""; // مسح النتائج القديمة
  document.getElementById("summary-section").style.display = "block"; // إظهار قسم النتائج

  // 1. حساب ملخصات العمال
  let workerSummaries = workers.map(w => {
    const owned = ovensList.filter(o => o.owner === w.name);
    let firstStart = null;
    let lastFinish = w.startMin || 0;
    
    if (owned.length > 0) {
        // إيجاد أول عملية تبدأ
        const firstOps = owned.map(o => o.ops.length ? o.ops[0].start : Infinity);
        firstStart = Math.min(...firstOps);
        
        // إيجاد آخر عملية تنتهي
        const lastOps = owned.map(o => o.ops.length ? o.ops[o.ops.length-1].end : o.available);
        lastFinish = Math.max(...lastOps);
    }

    return {
      name: w.name, 
      ovens: owned.length, 
      minutes: w.minutes, 
      start: w.startMin, 
      firstOpStart: (firstStart === Infinity) ? null : firstStart,
      endMin: lastFinish,
      totalOps: owned.reduce((acc, o) => acc + o.ops.length, 0)
    };
  });

  // *** ترتيب ملخص العمال حسب الأسرع انتهاءً ***
  workerSummaries.sort((a, b) => a.endMin - b.endMin);

  // 2. عرض ملخص العمال
  const summaryBlock = document.createElement("div");
  summaryBlock.className = "result-block";
  summaryBlock.innerHTML = `<h3>ملخص العمال (مرتب حسب وقت الانتهاء)</h3>`;
  const summaryGrid = document.createElement("div");
  summaryGrid.className = "summary-grid";

  workerSummaries.forEach((ws, index) => {
    const div = document.createElement("div");
    div.className = "worker-summary";
    div.innerHTML = `
      <div>
        <span class="rank">#${index + 1}</span>
        <strong>${ws.name}</strong>
      </div>
      <div class="summary-details">
        ينتهي: <span class="summary-time">${minutesToHHMM(ws.endMin)}</span><br>
        يبدأ (الفرن): <span class="summary-time">${ws.firstOpStart != null ? minutesToHHMM(ws.firstOpStart) : "-"}</span><br>
        إجمالي العمليات: <span class="summary-time">${ws.totalOps}</span> (${ws.ovens} أفران)
      </div>
    `;
    summaryGrid.appendChild(div);
  });
  summaryBlock.appendChild(summaryGrid);
  resultsDiv.appendChild(summaryBlock);


  // 3. عرض الجدول الزمني المفصل (مرتب زمنياً)
  // (allOpsList تم ملؤها أثناء الخوارزمية)
  allOpsList.sort((a, b) => a.start - b.start); // ترتيب زمني

  const detailBlock = document.createElement("div");
  detailBlock.className = "result-block";
  detailBlock.innerHTML = `<h3>الجدول الزمني المفصل (مرتب زمنياً)</h3>`;
  
  let table = `<table class="table timeline-table">
                <thead>
                  <tr>
                    <th>وقت البدء</th>
                    <th>العامل</th>
                    <th>الفرن #</th>
                    <th>الطبخة #</th>
                    <th>العربة #</th>
                    <th>وقت الانتهاء</th>
                  </tr>
                </thead>
                <tbody>`;

  for (const op of allOpsList) {
    table += `<tr>
                <td><strong>${minutesToHHMM(op.start)}</strong></td>
                <td>${op.owner}</td>
                <td>${op.ovenId}</td>
                <td>${op.batch}</td>
                <td>${op.cart} / 5</td>
                <td>${minutesToHHMM(op.end)}</td>
              </tr>`;
  }
  
  table += `</tbody></table>`;
  detailBlock.innerHTML += table;
  resultsDiv.appendChild(detailBlock);

});
