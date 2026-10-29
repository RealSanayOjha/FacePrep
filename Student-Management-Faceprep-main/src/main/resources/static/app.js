(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const defaultCourses = ["Computer Science", "Information Technology", "Electronics", "Mechanical Engineering", "Business Administration"];
  const state = { page: 0, size: 8, totalPages: 0, total: 0, students: [], courses: [], loading: false, sequence: 0, editingId: null, deleting: null, saving: false, deleteBusy: false };
  const number = new Intl.NumberFormat();
  let searchTimer, toastTimer;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(path, { ...options, signal: controller.signal,
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
      });
      if (response.status === 204) return null;
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.message || `Request failed (${response.status}).`);
        error.status = response.status;
        error.fields = data?.fieldErrors || {};
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The server took too long to respond. Please try again.");
      if (error instanceof TypeError) throw new Error("Cannot reach the server. Check your connection and try again.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  function connection(online) {
    $("connectionStatus").className = `connection ${online ? "online" : "offline"}`;
    $("connectionLabel").textContent = online ? "Database connected" : "Connection issue";
  }
  function syncFilters() {
    $("courseFilter").value = state.course || "";
    $("statusFilter").value = state.status || "";
    $("yearFilter").value = state.yearLevel || "";
    $("sortFilter").value = state.sort || "newest";
    $("searchInput").value = state.search || "";
  }
  function resetFilters() {
    clearTimeout(searchTimer);
    Object.assign(state, { page: 0, search: "", course: "", status: "", yearLevel: "", sort: "newest" });
    syncFilters();
  }
  function renderPagination() {
    const start = state.total ? state.page * state.size + 1 : 0;
    const end = Math.min((state.page + 1) * state.size, state.total);
    $("pageSummary").textContent = state.total ? `Showing ${number.format(start)}–${number.format(end)} of ${number.format(state.total)} students` : "No matching student records";
    $("pageLabel").textContent = `Page ${state.page + 1} of ${Math.max(1, state.totalPages)}`;
    $("previousPage").disabled = state.loading || state.page === 0;
    $("nextPage").disabled = state.loading || state.page >= state.totalPages - 1;
  }
  function renderRows() {
    const body = $("studentRows");
    const fragment = document.createDocumentFragment();
    if (state.loading && !state.students.length) {
      const row = element("tr"), cell = element("td", "table-placeholder", "Loading student records…");
      cell.colSpan = 5; row.append(cell); fragment.append(row);
    } else if (!state.students.length) {
      const row = element("tr"), cell = element("td", "table-placeholder");
      cell.colSpan = 5;
      const empty = element("div", "empty-state");
      const filtered = state.search || state.course || state.status || state.yearLevel;
      empty.append(icon("users"), element("strong", "", filtered ? "No students match your filters" : "Your registry starts here"),
        element("p", "", filtered ? "Try a different search or clear your filters." : "Add your first student to get started."));
      const button = element("button", "button secondary", filtered ? "Clear filters" : "Add student");
      button.addEventListener("click", () => filtered ? (resetFilters(), refresh()) : openForm());
      empty.append(button); cell.append(empty); row.append(cell); fragment.append(row);
    } else {
      state.students.forEach(student => {
        const row = element("tr");
        const identity = element("td"), identityWrap = element("div", "student-cell");
        const fullName = `${student.firstName} ${student.lastName}`;
        const color = [...fullName].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
        const avatar = element("span", `avatar color-${color}`, `${student.firstName[0] || ""}${student.lastName[0] || ""}`.toUpperCase());
        avatar.setAttribute("aria-hidden", "true");
        const details = element("div");
        details.append(element("span", "student-name", fullName), element("span", "student-email", student.email));
        identityWrap.append(avatar, details); identity.append(identityWrap);
        const code = element("td"); code.append(element("code", "student-code", student.studentCode));
        const course = element("td"); course.append(element("span", "course-name", student.course), element("span", "course-year", `Year ${student.yearLevel}`));
        const status = element("td");
        const label = student.status.charAt(0) + student.status.slice(1).toLowerCase();
        status.append(element("span", `status-badge ${student.status.toLowerCase()}`, label));
        const actions = element("td"), buttons = element("div", "row-actions");
        const edit = element("button", "icon-button"), remove = element("button", "icon-button delete-action");
        edit.type = remove.type = "button";
        edit.setAttribute("aria-label", `Edit ${fullName}`); edit.title = "Edit student";
        remove.setAttribute("aria-label", `Delete ${fullName}`); remove.title = "Delete student";
        edit.append(icon("edit")); remove.append(icon("trash"));
        edit.addEventListener("click", () => openForm(student));
        remove.addEventListener("click", () => openDelete(student));
        buttons.append(edit, remove); actions.append(buttons);
        row.append(identity, code, course, status, actions); fragment.append(row);
      });
    }
    body.replaceChildren(fragment);
    body.setAttribute("aria-busy", String(state.loading));
    $("directoryCount").textContent = state.loading ? "…" : number.format(state.total);
    renderPagination();
  }
  async function loadStudents() {
    const sequence = ++state.sequence;
    state.loading = true;
    renderPagination();
    if (!state.students.length) renderRows();
    const params = new URLSearchParams({ page: state.page, size: state.size, sort: state.sort || "newest" });
    for (const key of ["search", "course", "status", "yearLevel"]) if (state[key]) params.set(key, state[key]);
    try {
      const data = await api(`/api/students?${params}`);
      if (sequence !== state.sequence) return;
      state.total = data.totalElements;
      state.totalPages = data.totalPages;
      if (data.content.length === 0 && data.totalElements > 0 && state.page >= data.totalPages) {
        state.page = Math.max(0, data.totalPages - 1);
        state.loading = false;
        await loadStudents();
        return;
      }
      state.students = data.content;
      $("errorBanner").hidden = true;
    } catch (error) {
      if (sequence !== state.sequence) return;
      state.students = []; state.total = 0; state.totalPages = 0;
      $("errorMessage").textContent = error.message;
      $("errorBanner").hidden = false;
      throw error;
    } finally {
      if (sequence === state.sequence) { state.loading = false; renderRows(); }
    }
  }
  function updateCourseOptions() {
    const courses = [...new Set([...defaultCourses, ...state.courses, ...(state.course ? [state.course] : [])])].sort();
    const filter = document.createDocumentFragment();
    filter.append(new Option("All courses", ""));
    const datalist = document.createDocumentFragment();
    courses.forEach(course => { filter.append(new Option(course, course)); datalist.append(new Option(course, course)); });
    $("courseFilter").replaceChildren(filter); $("courseOptions").replaceChildren(datalist);
    $("courseFilter").value = state.course || "";
  }
  async function loadStats() {
    try {
      const stats = await api("/api/dashboard/stats");
      $("totalStudents").textContent = number.format(stats.totalStudents);
      $("activeStudents").textContent = number.format(stats.activeStudents);
      $("graduatedStudents").textContent = number.format(stats.graduatedStudents);
      $("courseCount").textContent = number.format(stats.byCourse.length);
      state.courses = stats.byCourse.map(item => item.course);
      updateCourseOptions();
      const fragment = document.createDocumentFragment();
      const max = Math.max(1, ...stats.byCourse.map(item => item.count));
      if (!stats.byCourse.length) fragment.append(element("p", "muted", "Course statistics will appear when you add a student."));
      stats.byCourse.forEach(item => {
        const bar = element("div", "course-bar"), label = element("div", "course-bar-label");
        label.append(element("span", "", item.course), element("strong", "", `${number.format(item.count)} ${item.count === 1 ? "student" : "students"}`));
        const track = element("div", "bar-track"), fill = element("div", "bar-fill");
        fill.style.width = `${Math.max(2, item.count / max * 100)}%`;
        track.append(fill); bar.append(label, track); fragment.append(bar);
      });
      $("courseBars").replaceChildren(fragment);
    } catch (error) {
      ["totalStudents", "activeStudents", "graduatedStudents", "courseCount"].forEach(id => $(id).textContent = "—");
      $("courseBars").replaceChildren(element("p", "muted", "Statistics are unavailable. Use Try again above to reconnect."));
      throw error;
    }
  }
  async function refresh() {
    const results = await Promise.allSettled([loadStudents(), loadStats()]);
    connection(results.every(result => result.status === "fulfilled"));
  }
  function toast(message, isError = false) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").className = `toast${isError ? " error" : ""}`;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => $("toast").hidden = true, 5000);
  }
  function clearFormErrors() {
    $("formError").hidden = true;
    $("studentForm").querySelectorAll(".field-error").forEach(node => node.textContent = "");
    $("studentForm").querySelectorAll("[aria-invalid]").forEach(node => node.removeAttribute("aria-invalid"));
  }
  function openForm(student) {
    $("studentForm").reset(); clearFormErrors();
    state.editingId = student?.id || null;
    $("dialogTitle").textContent = student ? "Edit student" : "Add student";
    $("saveStudent").textContent = student ? "Save changes" : "Add student";
    if (student) ["studentCode", "firstName", "lastName", "email", "course", "yearLevel", "status"].forEach(key => $(key).value = student[key]);
    $("studentDialog").showModal();
    $("studentCode").focus();
  }
  function setFormBusy(busy) {
    state.saving = busy;
    ["saveStudent", "cancelDialog", "closeDialog"].forEach(id => $(id).disabled = busy);
    $("saveStudent").textContent = busy ? "Saving…" : state.editingId ? "Save changes" : "Add student";
  }
  async function saveStudent(event) {
    event.preventDefault();
    if (state.saving || !$("studentForm").reportValidity()) return;
    clearFormErrors(); setFormBusy(true);
    const payload = Object.fromEntries(new FormData($("studentForm")).entries());
    payload.yearLevel = Number(payload.yearLevel);
    const editing = Boolean(state.editingId);
    try {
      await api(editing ? `/api/students/${state.editingId}` : "/api/students", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      $("studentDialog").close();
      toast(editing ? "Student record updated." : "Student added to the registry.");
      if (!editing) resetFilters();
      await refresh();
    } catch (error) {
      $("formError").textContent = error.message; $("formError").hidden = false;
      Object.entries(error.fields).forEach(([field, message]) => {
        const input = $(field), hint = $(`${field}Error`);
        if (hint) hint.textContent = message;
        if (input instanceof HTMLElement) input.setAttribute("aria-invalid", "true");
      });
    } finally { setFormBusy(false); }
  }
  function openDelete(student) {
    state.deleting = student;
    $("deleteDescription").textContent = `You are about to delete ${student.firstName} ${student.lastName} (${student.studentCode}).`;
    $("deleteError").hidden = true;
    $("deleteDialog").showModal(); $("cancelDelete").focus();
  }
  function setDeleteBusy(busy) {
    state.deleteBusy = busy;
    ["confirmDelete", "cancelDelete", "closeDelete"].forEach(id => $(id).disabled = busy);
    $("confirmDelete").textContent = busy ? "Deleting…" : "Delete student";
  }
  async function deleteStudent() {
    if (!state.deleting || state.deleteBusy) return;
    setDeleteBusy(true);
    try {
      await api(`/api/students/${state.deleting.id}`, { method: "DELETE" });
      if (state.students.length === 1 && state.page > 0) state.page--;
      $("deleteDialog").close(); toast("Student record deleted.");
      await refresh();
    } catch (error) {
      $("deleteError").textContent = error.message; $("deleteError").hidden = false;
    } finally { setDeleteBusy(false); }
  }

  $("filterForm").addEventListener("submit", event => event.preventDefault());
  $("searchInput").addEventListener("input", event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = event.target.value.trim(); state.page = 0; refresh(); }, 300);
  });
  [["courseFilter", "course"], ["statusFilter", "status"], ["yearFilter", "yearLevel"], ["sortFilter", "sort"]].forEach(([id, key]) => {
    $(id).addEventListener("change", event => { state[key] = event.target.value; state.page = 0; refresh(); });
  });
  $("resetFilters").addEventListener("click", () => { resetFilters(); refresh(); });
  $("retryButton").addEventListener("click", refresh);
  $("previousPage").addEventListener("click", () => { if (state.page > 0) { state.page--; loadStudents().catch(() => connection(false)); } });
  $("nextPage").addEventListener("click", () => { if (state.page < state.totalPages - 1) { state.page++; loadStudents().catch(() => connection(false)); } });
  ["topAddButton"].forEach(id => $(id).addEventListener("click", () => openForm()));
  ["closeDialog", "cancelDialog"].forEach(id => $(id).addEventListener("click", () => { if (!state.saving) $("studentDialog").close(); }));
  $("studentDialog").addEventListener("cancel", event => { if (state.saving) event.preventDefault(); });
  $("studentForm").addEventListener("submit", saveStudent);
  ["closeDelete", "cancelDelete"].forEach(id => $(id).addEventListener("click", () => { if (!state.deleteBusy) $("deleteDialog").close(); }));
  $("deleteDialog").addEventListener("cancel", event => { if (state.deleteBusy) event.preventDefault(); });
  $("confirmDelete").addEventListener("click", deleteStudent);
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector("dialog[open]") && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault(); $("searchInput").focus();
    }
  });
  updateCourseOptions();
  refresh();
})();
