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

// زر إضافة طبخة جديدة
document.getElementById("addBatchBtn").addEventListener("click", function () {
  const batchesArea = document.getElementById("batches-area");
  const newRow = document.createElement("div");
  newRow.className = "batch-config-row";
  newRow.innerHTML = `
    <input class="batch-name" type="text" placeholder="مثال: عجين بني" value="">
    <input class="batch-count" type="number" min="1" placeholder="عدد" value="5">
    <input class="batch-carts" type="number" min="1" placeholder="عربات" value="5">
    <input class="batch-duration" type="number" min="1" placeholder="دقائق" value="70">
    <button class="remove-batch-btn" title="حذف">×</button>
  `;

  // إضافة حدث الحذف للزر الجديد
  newRow.querySelector(".remove-batch-btn").addEventListener("click", function () {
    const rows = document.querySelectorAll(".batch-config-row");
    if (rows.length > 1) {
      newRow.remove();
    } else {
      alert("يجب أن يكون هناك طبخة واحدة على الأقل");
    }
  });

  // إدراج الصف الجديد قبل زر الإضافة
  batchesArea.insertBefore(newRow, document.getElementById("addBatchBtn"));
});

// إضافة حدث الحذف لجميع أزرار الحذف الموجودة
document.querySelectorAll(".remove-batch-btn").forEach(btn => {
  btn.addEventListener("click", function () {
    const rows = document.querySelectorAll(".batch-config-row");
    if (rows.length > 1) {
      btn.closest(".batch-config-row").remove();
    } else {
      alert("يجب أن يكون هناك طبخة واحدة على الأقل");
    }
  });
});

document.getElementById("calcBtn").addEventListener("click", function () {
  // قراءة معلومات الطبخات
  const batchRows = Array.from(document.querySelectorAll(".batch-config-row"));
  const batchConfigs = [];

  for (let r of batchRows) {
    const name = r.querySelector(".batch-name").value.trim();
    const count = Number(r.querySelector(".batch-count").value) || 0;
    const carts = Number(r.querySelector(".batch-carts").value) || 0;
    const duration = Number(r.querySelector(".batch-duration").value) || 0;

    // تخطي الصفوف الفارغة بالكامل
    if (!name && count === 0 && carts === 0 && duration === 0) continue;

    batchConfigs.push({
      name: name || `طبخة ${batchConfigs.length + 1}`,
      count: count,
      carts: carts,
      duration: duration
    });
  }

  if (batchConfigs.length === 0) {
    alert("الرجاء إدخال معلومات طبخة واحدة على الأقل.");
    return;
  }

  // التحقق من أن جميع الطبخات لديها عدد وعربات ومدة
  for (let bc of batchConfigs) {
    if (bc.count <= 0 || bc.carts <= 0) {
      alert(`الطبخة "${bc.name}" يجب أن يكون لها عدد طبخات وعربات أكبر من صفر.`);
      return;
    }
    if (bc.duration <= 0) {
      alert(`الطبخة "${bc.name}" يجب أن يكون لها مدة فرن أكبر من صفر.`);
      return;
    }
  }

  // قراءة معلومات العمال
  const rows = Array.from(document.querySelectorAll(".worker-row"));
  const workers = [];
  for (let r of rows) {
    const name = r.querySelector(".name").value.trim();
    const ovens = Number(r.querySelector(".ovens").value) || 0;
    const startTimeStr = r.querySelector(".startTime").value;
    const startMin = timeToMinutes(startTimeStr);
    // skip completely empty rows
    if (!name && ovens === 0 && !startMin) continue;
    workers.push({name: name || `عامل ${workers.length + 1}`, ovens, startMin});
  }
  if (workers.length === 0) {
    alert("أدخل بيانات عامل واحد على الأقل.");
    return;
  }

  // بناء قائمة الأفران
  const ovensList = [];
  let globalOvenId = 1;
  for (const w of workers) {
    for (let i = 0; i < w.ovens; i++) {
      const initialAvail = (w.startMin != null) ? (w.startMin + i * 2) : 0;
      ovensList.push({
        id: globalOvenId++,
        owner: w.name,
        localIndex: i,
        available: initialAvail,
        ops: []
      });
    }
  }

  if (ovensList.length === 0) {
    alert("لم تدخل أي أفران. أدخل عدد الأفران لكل عامل.");
    return;
  }

  // --- خوارزمية الجدولة المحدثة ---
  // نمر على كل طبخة بالترتيب، ثم كل batch، ثم كل عربة
  const allOpsList = [];

  for (let configIdx = 0; configIdx < batchConfigs.length; configIdx++) {
    const config = batchConfigs[configIdx];

    for (let batchNum = 0; batchNum < config.count; batchNum++) {
      for (let cart = 0; cart < config.carts; cart++) {
        // اختيار الفرن ذو أقل وقت متاح
        let minIdx = 0;
        let minAvail = ovensList[0].available;
        for (let i = 1; i < ovensList.length; i++) {
          if (ovensList[i].available < minAvail) {
            minAvail = ovensList[i].available;
            minIdx = i;
          }
        }

        const oven = ovensList[minIdx];
        const useMinutes = config.duration;

        const start = oven.available;
        const end = start + useMinutes;

        const op = {
          batchConfigName: config.name,
          batchConfigIndex: configIdx,
          batchNumber: batchNum + 1,
          cart: cart + 1,
          totalCarts: config.carts,
          start,
          end,
          owner: oven.owner,
          ovenId: oven.id
        };

        oven.ops.push(op);
        allOpsList.push(op);

        oven.available = end;
      }
    }
  }
  // --- نهاية الخوارزمية ---

  // --- بناء النتائج ---
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";
  document.getElementById("summary-section").style.display = "block";

  // 1. حساب ملخصات العمال
  let workerSummaries = workers.map(w => {
    const owned = ovensList.filter(o => o.owner === w.name);
    let firstStart = null;
    let lastFinish = w.startMin || 0;

    if (owned.length > 0) {
        const firstOps = owned.map(o => o.ops.length ? o.ops[0].start : Infinity);
        firstStart = Math.min(...firstOps);

        const lastOps = owned.map(o => o.ops.length ? o.ops[o.ops.length-1].end : o.available);
        lastFinish = Math.max(...lastOps);
    }

    return {
      name: w.name,
      ovens: owned.length,
      start: w.startMin,
      firstOpStart: (firstStart === Infinity) ? null : firstStart,
      endMin: lastFinish,
      totalOps: owned.reduce((acc, o) => acc + o.ops.length, 0)
    };
  });

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

  // 3. ملخص الطبخات
  const batchSummaryBlock = document.createElement("div");
  batchSummaryBlock.className = "result-block";
  batchSummaryBlock.innerHTML = `<h3>ملخص الطبخات</h3>`;

  let batchSummaryTable = `<table class="table">
                            <thead>
                              <tr>
                                <th>اسم الطبخة</th>
                                <th>عدد الطبخات</th>
                                <th>عربات/طبخة</th>
                                <th>إجمالي العربات</th>
                              </tr>
                            </thead>
                            <tbody>`;

  let totalBatches = 0;
  let totalCarts = 0;

  for (const config of batchConfigs) {
    const configTotalCarts = config.count * config.carts;
    totalBatches += config.count;
    totalCarts += configTotalCarts;

    batchSummaryTable += `<tr>
                            <td><strong>${config.name}</strong></td>
                            <td>${config.count}</td>
                            <td>${config.carts}</td>
                            <td>${configTotalCarts}</td>
                          </tr>`;
  }

  batchSummaryTable += `<tr style="background: #f9fafb; font-weight: bold;">
                          <td>المجموع</td>
                          <td>${totalBatches}</td>
                          <td>-</td>
                          <td>${totalCarts}</td>
                        </tr>
                        </tbody></table>`;

  batchSummaryBlock.innerHTML += batchSummaryTable;
  resultsDiv.appendChild(batchSummaryBlock);

  // 4. عرض الجدول الزمني المفصل
  allOpsList.sort((a, b) => a.start - b.start);

  const detailBlock = document.createElement("div");
  detailBlock.className = "result-block";
  detailBlock.innerHTML = `<h3>الجدول الزمني المفصل (مرتب زمنياً)</h3>`;

  let table = `<table class="table timeline-table">
                <thead>
                  <tr>
                    <th>وقت البدء</th>
                    <th>العامل</th>
                    <th>الفرن #</th>
                    <th>نوع الطبخة</th>
                    <th>رقم الطبخة</th>
                    <th>العربة</th>
                    <th>وقت الانتهاء</th>
                  </tr>
                </thead>
                <tbody>`;

  for (const op of allOpsList) {
    table += `<tr>
                <td><strong>${minutesToHHMM(op.start)}</strong></td>
                <td>${op.owner}</td>
                <td>${op.ovenId}</td>
                <td>${op.batchConfigName}</td>
                <td>${op.batchNumber}</td>
                <td>${op.cart} / ${op.totalCarts}</td>
                <td>${minutesToHHMM(op.end)}</td>
              </tr>`;
  }

  table += `</tbody></table>`;
  detailBlock.innerHTML += table;
  resultsDiv.appendChild(detailBlock);
});
