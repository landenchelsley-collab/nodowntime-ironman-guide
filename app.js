const STORAGE_KEY = "sb_ironman_progress_v1";

let guide = null;
let state = {
  completed: new Set(),
  minimizeCompleted: false,
  filter: "all",
  search: ""
};

const el = (id) => document.getElementById(id);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.completed = new Set(parsed.completed || []);
    state.minimizeCompleted = !!parsed.minimizeCompleted;
    state.filter = parsed.filter || "all";
  } catch {}
}

function saveState() {
  const payload = {
    completed: Array.from(state.completed),
    minimizeCompleted: state.minimizeCompleted,
    filter: state.filter
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  el("progressText").textContent = "Progress saved";
}

function normalize(s){ return (s || "").toLowerCase().trim(); }

function matchesSearch(step) {
  const q = normalize(state.search);
  if (!q) return true;
  const blob = [
    step.title,
    step.notes,
    ...(step.details || []),
    ...(step.tags || [])
  ].join(" ");
  return normalize(blob).includes(q);
}

function getAllSteps() {
  const all = [];
  for (const sec of guide.sections) {
    for (const step of sec.steps) all.push(step);
  }
  return all;
}

function updateProgressUI() {
  const steps = getAllSteps();
  const total = steps.length || 1;
  const done = steps.filter(s => state.completed.has(s.id)).length;
  const pct = Math.round((done / total) * 100);
  el("progressPct").textContent = `${pct}%`;
  el("progressBar").style.width = `${pct}%`;
}

function renderTOC() {
  const toc = el("toc");
  toc.innerHTML = "";
  guide.sections.forEach(sec => {
    const a = document.createElement("a");
    a.href = `#sec-${sec.id}`;
    a.className = "tocItem";
    a.textContent = sec.title;
    a.onclick = () => {
      document.querySelectorAll(".tocItem").forEach(x => x.classList.remove("active"));
      a.classList.add("active");
    };
    toc.appendChild(a);
  });
}

function renderContent() {
  const root = el("content");
  root.innerHTML = "";

  guide.sections.forEach(sec => {
    const section = document.createElement("div");
    section.className = "section";
    section.id = `sec-${sec.id}`;

    const h2 = document.createElement("h2");
    h2.textContent = sec.title;
    section.appendChild(h2);

    sec.steps.forEach(step => {
      const done = state.completed.has(step.id);

      if (state.filter === "complete" && !done) return;
      if (state.filter === "incomplete" && done) return;
      if (!matchesSearch(step)) return;

      const row = document.createElement("div");
      row.className = "step" + (done ? " done" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "check";
      cb.checked = done;
      cb.onchange = () => {
        if (cb.checked) state.completed.add(step.id);
        else state.completed.delete(step.id);
        saveState();
        updateProgressUI();
        renderContent();
      };

      const body = document.createElement("div");

      const title = document.createElement("div");
      title.className = "stepTitle";
      title.textContent = step.title;

      const meta = document.createElement("div");
      meta.className = "stepMeta";

      (step.tags || []).forEach(t => {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = t;
        meta.appendChild(pill);
      });

      if (step.links && step.links.length) {
        step.links.forEach(l => {
          const a = document.createElement("a");
          a.href = l.url;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.textContent = l.label;
          meta.appendChild(a);
        });
      }

      const details = document.createElement("div");
      details.className = "details";

      if (!done || !state.minimizeCompleted) {
        if (step.notes) {
          const p = document.createElement("div");
          p.textContent = step.notes;
          details.appendChild(p);
        }
        if (step.details && step.details.length) {
          const ul = document.createElement("ul");
          step.details.forEach(d => {
            const li = document.createElement("li");
            li.textContent = d;
            ul.appendChild(li);
          });
          details.appendChild(ul);
        }
      } else {
        details.classList.add("hidden");
      }

      body.appendChild(title);
      if (meta.childNodes.length) body.appendChild(meta);
      body.appendChild(details);

      row.appendChild(cb);
      row.appendChild(body);
      section.appendChild(row);
    });

    root.appendChild(section);
  });
}

async function init() {
  const res = await fetch("steps.json", { cache: "no-store" });
  guide = await res.json();

  el("guideTitle").textContent = guide.title || "Guide";
  el("guideVersion").textContent = guide.version || "";

  loadState();

  el("filter").value = state.filter;
  el("minimize").textContent = state.minimizeCompleted ? "Show Completed" : "Minimize Completed";

  el("filter").onchange = (e) => { state.filter = e.target.value; saveState(); renderContent(); };
  el("search").oninput = (e) => { state.search = e.target.value; renderContent(); };
  el("minimize").onclick = () => {
    state.minimizeCompleted = !state.minimizeCompleted;
    el("minimize").textContent = state.minimizeCompleted ? "Show Completed" : "Minimize Completed";
    saveState();
    renderContent();
  };
  el("jump").onclick = () => {
    const all = getAllSteps();
    const last = all.filter(s => state.completed.has(s.id)).slice(-1)[0];
    if (!last) return;
    const sec = guide.sections.find(sec => sec.steps.some(st => st.id === last.id));
    if (sec) location.hash = `#sec-${sec.id}`;
  };
  el("reset").onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    state.completed = new Set();
    state.minimizeCompleted = false;
    state.filter = "all";
    state.search = "";
    el("filter").value = "all";
    el("search").value = "";
    el("minimize").textContent = "Minimize Completed";
    updateProgressUI();
    renderContent();
  };

  renderTOC();
  updateProgressUI();
  renderContent();
}

init();
