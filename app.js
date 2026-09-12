(() => {
  "use strict";

  /** @type {{ id: string, src: string, file?: File }[]} */
  let images = [];
  let previewPageIndex = 0;
  let dragFrom = null;

  const els = {
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    btnBrowse: document.getElementById("btnBrowse"),
    thumbs: document.getElementById("thumbs"),
    thumbsSection: document.getElementById("thumbsSection"),
    toolbar: document.getElementById("toolbar"),
    previewSection: document.getElementById("previewSection"),
    previewFrame: document.getElementById("previewFrame"),
    previewPageLabel: document.getElementById("previewPageLabel"),
    imgCount: document.getElementById("imgCount"),
    pageCount: document.getElementById("pageCount"),
    paperSize: document.getElementById("paperSize"),
    perPage: document.getElementById("perPage"),
    margins: document.getElementById("margins"),
    showBorders: document.getElementById("showBorders"),
    btnClear: document.getElementById("btnClear"),
    btnPreview: document.getElementById("btnPreview"),
    btnPrint: document.getElementById("btnPrint"),
    btnPdf: document.getElementById("btnPdf"),
    btnPrevPage: document.getElementById("btnPrevPage"),
    btnNextPage: document.getElementById("btnNextPage"),
    printRoot: document.getElementById("printRoot"),
  };

  // mm approx at 96dpi for screen preview scale
  const PAPER = {
    letter: { w: 8.5, h: 11, label: "Carta" },
    legal: { w: 8.5, h: 14, label: "Oficio" },
    a4: { w: 8.27, h: 11.69, label: "A4" },
  };

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function perPage() {
    return parseInt(els.perPage.value, 10) || 4;
  }

  function marginPt() {
    return parseInt(els.margins.value, 10) || 20;
  }

  function totalPages() {
    if (!images.length) return 0;
    return Math.ceil(images.length / perPage());
  }

  function gridFor(count) {
    switch (count) {
      case 1: return { cols: 1, rows: 1 };
      case 2: return { cols: 1, rows: 2 };
      case 6: return { cols: 2, rows: 3 };
      case 4:
      default: return { cols: 2, rows: 2 };
    }
  }

  function updateCounts() {
    const n = images.length;
    const p = totalPages();
    els.imgCount.textContent = n === 1 ? "1 imagen" : `${n} imagenes`;
    els.pageCount.textContent = `${p} pagina${p === 1 ? "" : "s"}`;
    const has = n > 0;
    els.toolbar.hidden = !has;
    els.thumbsSection.hidden = !has;
    if (!has) {
      els.previewSection.hidden = true;
      els.printRoot.innerHTML = "";
    }
  }

  function renderThumbs() {
    els.thumbs.innerHTML = "";
    images.forEach((img, i) => {
      const div = document.createElement("div");
      div.className = "thumb";
      div.draggable = true;
      div.dataset.id = img.id;

      const image = document.createElement("img");
      image.src = img.src;
      image.alt = `Imagen ${i + 1}`;
      const rot = img.rotation || 0;
      image.style.transform = rot ? `rotate(${rot}deg)` : "";
      if (rot === 90 || rot === 270) {
        image.classList.add("rotated-odd");
      }

      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = String(i + 1);

      const rotateBtn = document.createElement("button");
      rotateBtn.type = "button";
      rotateBtn.className = "rotate-btn";
      rotateBtn.title = "Rotar 90°";
      rotateBtn.textContent = "↻";
      rotateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        img.rotation = ((img.rotation || 0) + 90) % 360;
        renderThumbs();
        if (!els.previewSection.hidden) renderPreview();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.title = "Eliminar";
      remove.textContent = "×";
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        images = images.filter((x) => x.id !== img.id);
        renderThumbs();
        updateCounts();
        if (!els.previewSection.hidden) renderPreview();
      });

      div.appendChild(image);
      div.appendChild(idx);
      div.appendChild(rotateBtn);
      div.appendChild(remove);

      div.addEventListener("dragstart", () => {
        dragFrom = img.id;
        div.classList.add("dragging");
      });
      div.addEventListener("dragend", () => {
        dragFrom = null;
        div.classList.remove("dragging");
      });
      div.addEventListener("dragover", (e) => e.preventDefault());
      div.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!dragFrom || dragFrom === img.id) return;
        const from = images.findIndex((x) => x.id === dragFrom);
        const to = images.findIndex((x) => x.id === img.id);
        if (from < 0 || to < 0) return;
        const [item] = images.splice(from, 1);
        images.splice(to, 0, item);
        renderThumbs();
        if (!els.previewSection.hidden) renderPreview();
      });

      els.thumbs.appendChild(div);
    });
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    let pending = files.length;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        images.push({ id: uid(), src: reader.result, file: file, rotation: 0 });
        pending -= 1;
        if (pending === 0) {
          renderThumbs();
          updateCounts();
        }
      };
      reader.readAsDataURL(file);
    });
  }


  /** Devuelve dataURL de la imagen ya rotada (para PDF) */
  function getRotatedDataUrl(src, rotation) {
    return new Promise((resolve) => {
      const angle = rotation || 0;
      if (!angle) {
        resolve(src);
        return;
      }
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const rad = (angle * Math.PI) / 180;
        const w = image.width;
        const h = image.height;
        if (angle === 90 || angle === 270) {
          canvas.width = h;
          canvas.height = w;
        } else {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(image, -w / 2, -h / 2);
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (e) {
          resolve(src);
        }
      };
      image.onerror = () => resolve(src);
      image.src = src;
    });
  }

  function buildSheetElement(pageIndex, forPrint) {
    const paperKey = els.paperSize.value;
    const paper = PAPER[paperKey] || PAPER.letter;
    const n = perPage();
    const { cols, rows } = gridFor(n);
    const margin = marginPt();
    const gap = 8;

    // Screen preview width in px
    const previewWidth = forPrint ? null : 420;
    const aspect = paper.h / paper.w;

    const sheet = document.createElement("div");
    sheet.className = forPrint ? "print-page" : "sheet-preview";

    if (forPrint) {
      // Una hoja exacta: grid con minmax(0,1fr) para que las 4 (o N) imágenes quepan sin desbordar
      const printMargin = Math.min(margin, 16);
      const printGap = 6;
      sheet.style.width = "100%";
      sheet.style.height = "100vh";
      sheet.style.maxHeight = "100vh";
      sheet.style.padding = printMargin + "px";
      sheet.style.gap = printGap + "px";
      sheet.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      sheet.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
      sheet.style.boxSizing = "border-box";
      sheet.style.overflow = "hidden";
    } else {
      sheet.style.width = `${previewWidth}px`;
      sheet.style.height = `${Math.round(previewWidth * aspect)}px`;
      sheet.style.padding = `${Math.round(margin * 0.6)}px`;
      sheet.style.gap = `${gap}px`;
      sheet.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      sheet.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    }

    const start = pageIndex * n;
    for (let i = 0; i < n; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (els.showBorders.checked) {
        cell.style.border = "1px solid #ddd";
      } else {
        cell.style.border = "none";
      }
      const imgData = images[start + i];
      if (imgData) {
        const img = document.createElement("img");
        img.src = imgData.src;
        img.alt = "";
        const r = imgData.rotation || 0;
        if (r) {
          img.style.transform = `rotate(${r}deg)`;
          if (r === 90 || r === 270) img.classList.add("rotated-odd");
        }
        cell.appendChild(img);
      }
      sheet.appendChild(cell);
    }
    return sheet;
  }

  function renderPreview() {
    if (!images.length) {
      els.previewSection.hidden = true;
      return;
    }
    els.previewSection.hidden = false;
    const pages = totalPages();
    if (previewPageIndex >= pages) previewPageIndex = pages - 1;
    if (previewPageIndex < 0) previewPageIndex = 0;

    els.previewFrame.innerHTML = "";
    els.previewFrame.appendChild(buildSheetElement(previewPageIndex, false));
    els.previewPageLabel.textContent = `Pagina ${previewPageIndex + 1} de ${pages}`;
    els.btnPrevPage.disabled = previewPageIndex <= 0;
    els.btnNextPage.disabled = previewPageIndex >= pages - 1;
  }

  /** Construye el DOM de impresión y abre el diálogo del sistema */
  function printDirect() {
    if (!images.length) {
      alert("Agrega al menos una imagen.");
      return;
    }

    const pages = totalPages();
    els.printRoot.innerHTML = "";

    for (let p = 0; p < pages; p++) {
      els.printRoot.appendChild(buildSheetElement(p, true));
    }

    // Sugerencia de tamaño de papel (algunos navegadores lo respetan)
    const paperKey = els.paperSize.value;
    let pageCss = "";
    if (paperKey === "letter") pageCss = "@page { size: letter portrait; margin: 0; }";
    else if (paperKey === "legal") pageCss = "@page { size: legal portrait; margin: 0; }";
    else pageCss = "@page { size: A4 portrait; margin: 0; }";

    let styleEl = document.getElementById("dynamic-page-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-page-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = pageCss;

    // Esperar a que las imágenes del área de impresión carguen
    const imgs = els.printRoot.querySelectorAll("img");
    const wait = Array.from(imgs).map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })
    );

    Promise.all(wait).then(() => {
      // Evitar título largo en encabezado del navegador
      const prevTitle = document.title;
      document.title = " ";
      const restore = () => {
        document.title = prevTitle;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);
      // Por si afterprint no dispara en algunos navegadores
      setTimeout(restore, 60000);
      window.print();
    });
  }

  /** Descarga PDF con jsPDF (misma disposición) */
  async function downloadPdf() {
    if (!images.length) {
      alert("Agrega al menos una imagen.");
      return;
    }
    if (!window.jspdf) {
      alert("No se pudo cargar jsPDF. Revisa tu conexion o usa Imprimir > Guardar como PDF.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const paperKey = els.paperSize.value;
    // jsPDF usa mm o pt; usamos pt estilo carta
    const sizes = {
      letter: [612, 792],
      legal: [612, 1008],
      a4: [595.28, 841.89],
    };
    const [pageW, pageH] = sizes[paperKey] || sizes.letter;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [pageW, pageH],
    });

    const n = perPage();
    const { cols, rows } = gridFor(n);
    const margin = marginPt() * 1.5;
    const gap = 10;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const cellW = (usableW - gap * (cols - 1)) / cols;
    const cellH = (usableH - gap * (rows - 1)) / rows;

    const pages = totalPages();

    for (let p = 0; p < pages; p++) {
      if (p > 0) pdf.addPage([pageW, pageH]);
      for (let i = 0; i < n; i++) {
        const imgData = images[p * n + i];
        if (!imgData) break;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = margin + col * (cellW + gap);
        const y = margin + row * (cellH + gap);

        if (els.showBorders.checked) {
          pdf.setDrawColor(220);
          pdf.rect(x, y, cellW, cellH);
        }

        const rotatedSrc = await getRotatedDataUrl(imgData.src, imgData.rotation || 0);
        await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            const scale = Math.min(cellW / image.width, cellH / image.height);
            const dw = image.width * scale;
            const dh = image.height * scale;
            const dx = x + (cellW - dw) / 2;
            const dy = y + (cellH - dh) / 2;
            try {
              pdf.addImage(rotatedSrc, "JPEG", dx, dy, dw, dh);
            } catch (e) {
              try {
                pdf.addImage(rotatedSrc, "PNG", dx, dy, dw, dh);
              } catch (_) { /* ignore */ }
            }
            resolve();
          };
          image.onerror = () => resolve();
          image.src = rotatedSrc;
        });
      }
    }

    pdf.save(`PrimeApp_${Date.now()}.pdf`);
  }

  // Eventos
  els.btnBrowse.addEventListener("click", (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });
  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => {
    addFiles(els.fileInput.files);
    els.fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((ev) => {
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("dragover");
    });
  });
  els.dropzone.addEventListener("drop", (e) => {
    addFiles(e.dataTransfer.files);
  });

  els.btnClear.addEventListener("click", () => {
    if (!images.length) return;
    if (confirm("Eliminar todas las imagenes?")) {
      images = [];
      renderThumbs();
      updateCounts();
    }
  });

  els.btnPreview.addEventListener("click", () => {
    previewPageIndex = 0;
    renderPreview();
    els.previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.btnPrevPage.addEventListener("click", () => {
    previewPageIndex -= 1;
    renderPreview();
  });
  els.btnNextPage.addEventListener("click", () => {
    previewPageIndex += 1;
    renderPreview();
  });

  els.btnPrint.addEventListener("click", printDirect);
  els.btnPdf.addEventListener("click", () => {
    downloadPdf().catch((err) => {
      console.error(err);
      alert("Error al crear el PDF. Puedes usar Imprimir > Guardar como PDF.");
    });
  });

  ["paperSize", "perPage", "margins"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      updateCounts();
      if (!els.previewSection.hidden) renderPreview();
    });
  });
  els.showBorders.addEventListener("change", () => {
    if (!els.previewSection.hidden) renderPreview();
  });


  // ——— Tema claro / oscuro ———
  const THEME_KEY = "primeapp_theme";
  const btnTheme = document.getElementById("btnTheme");
  const themeIcon = document.getElementById("themeIcon");

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function setTheme(theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    localStorage.setItem(THEME_KEY, theme);

    if (themeIcon) {
      // Sol en oscuro (para pasar a claro), luna en claro (para pasar a oscuro)
      themeIcon.textContent = theme === "dark" ? "\u2600" : "\u263E";
    }
    if (btnTheme) {
      btnTheme.title =
        theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
      btnTheme.setAttribute(
        "aria-label",
        theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
      );
    }
  }

  function initTheme() {
    let theme = localStorage.getItem(THEME_KEY);
    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    setTheme(theme);

    // Si el usuario no eligio tema manual, seguir al sistema
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = (e) => {
        if (!localStorage.getItem(THEME_KEY)) {
          setTheme(e.matches ? "dark" : "light");
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (_) {}
  }

  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }
  initTheme();

  updateCounts();
})();
