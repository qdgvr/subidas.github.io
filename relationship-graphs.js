(() => {
  const hasRoot = document.getElementById("relationship-graphs") || document.getElementById("relationship-graphs-a");
  if (!hasRoot) return;

  const cyan = "#35cfd3";
  const blue = "#76a7e8";
  const mutedBlue = "#365d97";
  let cachedData = null;
  let resizeTimer = 0;

  fetch("relationship-spec-c-data.json")
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      cachedData = data;
      renderAll();
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderAll, 80);
      });
    })
    .catch(error => {
      hasRoot.insertAdjacentHTML("beforeend", `<p class="relationship-error">No se pudieron cargar los resultados de la especificación C.</p>`);
      console.error("relationship-graphs", error);
    });

  function renderAll() {
    if (!cachedData) return;
    renderScatter(cachedData.graphA_scatter || null);
    renderBars(cachedData.graphB_bars || null);
  }

  function fmt1(value) {
    return Number.isFinite(value) ? value.toFixed(1) : "-";
  }

  function clear(target) {
    const node = document.querySelector(target);
    if (node) node.innerHTML = "";
    return node;
  }

  function sizeFor(target, fallbackWidth, fallbackHeight) {
    const node = document.querySelector(target);
    const box = node ? node.getBoundingClientRect() : { width: fallbackWidth };
    return {
      width: Math.max(320, box.width || fallbackWidth),
      height: fallbackHeight
    };
  }

  function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
    const span = domainMax - domainMin || 1;
    return value => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
  }

  function niceSymmetric(values, floor = 1) {
    const maxAbs = Math.max(floor, ...values.filter(Number.isFinite).map(v => Math.abs(v)));
    const power = Math.pow(10, Math.floor(Math.log10(maxAbs)));
    const nice = Math.ceil(maxAbs / power) * power;
    return [-nice, nice];
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function path(points) {
    return points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  }

  function renderScatter(graph) {
    const target = clear("#relationship-chart-a");
    if (!target || !graph || !graph.points?.length) return;

    const note = document.getElementById("relationship-note-a");
    if (note) {
      note.textContent = `Especificación C: los puntos muestran variación ajustada estado-año. La línea resume una caída de ${fmt1(Math.abs(graph.slope_minutes_per_hour))} minutos exteriores por cada hora adicional de ocio digital.`;
    }

    const { width, height } = sizeFor("#relationship-chart-a", 680, 390);
    const margin = { top: 34, right: 34, bottom: 58, left: 64 };
    const points = (graph.points || []).map(d => ({
      ...d,
      y_resid_hours: d.y_resid_minutes / 60
    }));
    const slopeHours = graph.slope_minutes_per_hour / 60;
    const [xMin, xMax] = niceSymmetric(points.map(d => d.x_resid_hours), .5);
    const [yMin, yMax] = niceSymmetric(points.map(d => d.y_resid_hours), .5);
    const observedX = points.map(d => d.x_resid_hours).filter(Number.isFinite);
    const observedXMin = Math.min(...observedX);
    const observedXMax = Math.max(...observedX);
    const x = scaleLinear(xMin, xMax, margin.left, width - margin.right);
    const y = scaleLinear(yMin, yMax, height - margin.bottom, margin.top);
    const linePoints = [
      { x: x(observedXMin), y: y(slopeHours * observedXMin) },
      { x: x(observedXMax), y: y(slopeHours * observedXMax) }
    ];

    const xTicks = [xMin, xMin / 2, 0, xMax / 2, xMax];
    const yTicks = [yMin, yMin / 2, 0, yMax / 2, yMax];

    const grid = yTicks.map(t => `
      <g>
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(255,255,255,.10)"/>
        <text x="${margin.left - 10}" y="${y(t) + 4}" text-anchor="end" class="relationship-axis-label">${fmt1(t)}</text>
      </g>`).join("");

    const xAxis = xTicks.map(t => `
      <g>
        <line x1="${x(t)}" x2="${x(t)}" y1="${height - margin.bottom}" y2="${height - margin.bottom + 5}" stroke="rgba(255,255,255,.25)"/>
        <text x="${x(t)}" y="${height - margin.bottom + 22}" text-anchor="middle" class="relationship-axis-label">${fmt1(t)} h</text>
      </g>`).join("");

    const cloud = points.map(d => `
      <circle cx="${x(d.x_resid_hours)}" cy="${y(d.y_resid_hours)}" r="2.1" fill="rgba(116,164,222,.24)">
        <title>${esc(`Estado ${d.state_key}, ${d.year}: ${fmt1(d.x_resid_hours)} h, ${fmt1(d.y_resid_hours)} h`)}</title>
      </circle>`).join("");

    target.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Especificación C: dispersión entre ocio digital y tiempo exterior">
        <rect width="${width}" height="${height}" fill="#000"/>
        ${grid}
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(0)}" y2="${y(0)}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 5"/>
        <line x1="${x(0)}" x2="${x(0)}" y1="${margin.top}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.18)" stroke-dasharray="4 5"/>
        ${cloud}
        <path d="${path(linePoints)}" fill="none" stroke="rgba(53,207,211,.24)" stroke-width="12" stroke-linecap="round"/>
        <path d="${path(linePoints)}" fill="none" stroke="${cyan}" stroke-width="4.2" stroke-linecap="round"/>
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.25)"/>
        <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.25)"/>
        ${xAxis}
        <text x="${margin.left}" y="20" class="relationship-axis-label">Tiempo exterior ajustado, horas</text>
        <text x="${width / 2}" y="${height - 12}" text-anchor="middle" class="relationship-axis-label">Ocio digital ajustado, horas</text>
        <text x="${width - margin.right}" y="${margin.top + 16}" text-anchor="end" class="relationship-value-label">−${fmt1(Math.abs(slopeHours))} h exterior por +1 h digital</text>
      </svg>`;
  }

  function renderBars(graph) {
    const target = clear("#relationship-chart-b");
    if (!target || !graph || !graph.bars?.length) return;

    const { width, height } = sizeFor("#relationship-chart-b", 680, 390);
    const compact = width < 520;
    const margin = { top: 34, right: 52, bottom: 46, left: compact ? 72 : 92 };
    const bars = graph.bars;
    const [xMin, xMax] = niceSymmetric(bars.map(d => d.effect), .2);
    const x = scaleLinear(xMin, xMax, margin.left, width - margin.right);
    const yStep = (height - margin.top - margin.bottom) / bars.length;
    const barH = Math.min(28, yStep * .56);
    const y = i => margin.top + yStep * i + yStep / 2;

    const xTicks = [xMin, xMin / 2, 0, xMax / 2, xMax];
    const grid = xTicks.map(t => `
      <g>
        <line x1="${x(t)}" x2="${x(t)}" y1="${margin.top}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.10)"/>
        <text x="${x(t)}" y="${height - margin.bottom + 20}" text-anchor="middle" class="relationship-axis-label">${fmt1(t)}</text>
      </g>`).join("");

    const barSvg = bars.map((d, i) => {
      const cy = y(i);
      const x0 = x(0);
      const xv = x(d.effect);
      const left = Math.min(x0, xv);
      const w = Math.abs(x0 - xv);
      const fill = d.effect >= 0 ? blue : mutedBlue;
      const compactInside = compact && w > 46;
      const valueX = compactInside
        ? (d.effect >= 0 ? left + w - 7 : left + 7)
        : (d.effect >= 0 ? left + w + 8 : left - 8);
      const valueAnchor = compactInside
        ? (d.effect >= 0 ? "end" : "start")
        : (d.effect >= 0 ? "start" : "end");
      return `
        <g>
          <text x="${margin.left - 14}" y="${cy + 5}" text-anchor="end" class="relationship-sample-label">${esc(d.age)}</text>
          <rect x="${left}" y="${cy - barH / 2}" width="${Math.max(2, w)}" height="${barH}" rx="4" fill="${fill}"/>
          <text x="${valueX}" y="${cy + 5}" text-anchor="${valueAnchor}" class="relationship-value-label">${d.effect > 0 ? "+" : ""}${fmt1(d.effect)} · h${d.h}</text>
        </g>`;
    }).join("");

    target.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Especificación C: barras de cambio en fecundidad por edad">
        <rect width="${width}" height="${height}" fill="#000"/>
        ${grid}
        <line x1="${x(0)}" x2="${x(0)}" y1="${margin.top}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.42)" stroke-dasharray="4 5"/>
        ${barSvg}
        <line x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.25)"/>
        <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,.25)"/>
        <text x="${margin.left}" y="20" class="relationship-axis-label">Cambio en nacimientos por 1.000 mujeres</text>
        <text x="${width / 2}" y="${height - 12}" text-anchor="middle" class="relationship-axis-label">Barra horizontal = mayor cambio observado entre h0 y h8</text>
      </svg>`;
  }
})();
