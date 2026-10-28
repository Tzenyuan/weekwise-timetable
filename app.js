      (() => {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const palette = [
          "#668b70", "#4c7899", "#98655b", "#9270a1", "#b18648", "#54877e",
          "#bd6470", "#5868a0", "#82934c", "#c67c4b", "#466a64", "#6b7080"
        ];
        const storageKey = "weekwise-courses-v1";
        const weekendStorageKey = "weekwise-weekends-v1";
        const semesterStorageKey = "weekwise-semester-v1";
        const examsStorageKey = "weekwise-exams-v1";
        const todosStorageKey = "weekwise-todos-v1";
        const notesStorageKey = "weekwise-notes-v1";
        const chimeStorageKey = "weekwise-pomodoro-chime-v1";
        const courseColorPicker = document.getElementById("course-color-picker");
        const courseFormat = document.getElementById("course-format");
        const venueLabel = document.getElementById("venue-label");
        const calendarEndInput = document.getElementById("calendar-end-date");
        const semesterStartInput = document.getElementById("semester-start");
        const semesterWeeksInput = document.getElementById("semester-weeks");
        const calendarBody = document.getElementById("calendar-body");
        const headings = document.getElementById("day-headings");
        const form = document.getElementById("course-form");
        const error = document.getElementById("form-error");
        const toast = document.getElementById("toast");
        const courseName = document.getElementById("course-name");
        const courseVenue = document.getElementById("course-venue");
        const courseDay = document.getElementById("course-day");
        const courseStart = document.getElementById("course-start");
        const courseEnd = document.getElementById("course-end");
        const themeSelect = document.getElementById("theme-select");
        const weekendToggle = document.getElementById("weekend-toggle");
        const autoSaveStatus = document.getElementById("auto-save-status");
        const autoSaveLabel = document.getElementById("auto-save-label");
        const noteTitleInput = document.getElementById("note-title");
        const noteContentInput = document.getElementById("note-content");
        const notesSaveStatus = document.getElementById("notes-save-status");
        const notesSaveLabel = document.getElementById("notes-save-label");
        const pomodoroChimeToggle = document.getElementById("pomodoro-chime");
        let courses = loadCourses();
        let editingId = null;
        let toastTimer;
        let weekOffset = 0;
        let selectedCourseColor = palette[0];
        let exams = loadCollection(examsStorageKey);
        let todos = loadCollection(todosStorageKey);
        let timerMode = "focus";
        let timerRunning = false;
        let timerRemaining = 25 * 60;
        let timerDeadline = 0;
        let timerInterval = null;
        let noteSaveTimer = null;
        let audioContext = null;
        const savedTheme = readPreference("weekwise-theme-v1");
        const weekendPreference = readPreference(weekendStorageKey);
        const semesterSettings = loadSemesterSettings();
        const savedNote = loadNote();
        noteTitleInput.value = savedNote.title;
        noteContentInput.value = savedNote.content;
        pomodoroChimeToggle.checked = readPreference(chimeStorageKey) !== "false";
        weekendToggle.checked = weekendPreference === "true";
        semesterStartInput.value = semesterSettings.start;
        semesterWeeksInput.value = String(semesterSettings.weeks);
        if (["sage", "ocean", "lavender", "midnight", "rose", "sand", "slate"].includes(savedTheme)) {
          document.body.dataset.theme = savedTheme;
          themeSelect.value = savedTheme;
        }

        function readPreference(key) {
          try { return localStorage.getItem(key); }
          catch (storageError) { console.error("Could not read saved preference.", storageError); return null; }
        }
        function loadNote() {
          try {
            const saved = JSON.parse(localStorage.getItem(notesStorageKey) || "null");
            return {
              title: typeof saved?.title === "string" ? saved.title.slice(0, 80) : "My study notes",
              content: typeof saved?.content === "string" ? saved.content : ""
            };
          } catch (storageError) {
            console.error("Could not load saved notes.", storageError);
            return { title: "My study notes", content: "" };
          }
        }
        function loadCourses() {
          try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
            return normalizeCourses(saved);
          } catch (storageError) {
            console.error("Could not load saved timetable.", storageError);
            return [];
          }
        }
        function loadCollection(key) {
          try {
            const saved = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(saved) ? saved : [];
          } catch (storageError) {
            console.error(`Could not load saved data for ${key}.`, storageError);
            return [];
          }
        }
        function localDateString(date) {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        }
        function dateOrdinal(date) {
          return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
        }
        function parseLocalDate(value) {
          if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
          const [year, month, day] = value.split("-").map(Number);
          const date = new Date(year, month - 1, day);
          return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
        }
        function loadSemesterSettings() {
          const today = new Date();
          const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
          try {
            const saved = JSON.parse(localStorage.getItem(semesterStorageKey) || "null");
            const start = parseLocalDate(saved?.start);
            const weeks = Number(saved?.weeks);
            return { start: start ? localDateString(start) : localDateString(monday), weeks: Number.isInteger(weeks) && weeks >= 1 && weeks <= 52 ? weeks : 16 };
          } catch (storageError) {
            console.error("Could not load semester settings.", storageError);
            return { start: localDateString(monday), weeks: 16 };
          }
        }
        function normalizeCourses(saved) {
          if (!Array.isArray(saved)) return [];
          const normalized = saved.filter(item =>
              item && typeof item.id === "string" && typeof item.name === "string" &&
              typeof item.venue === "string" && Number.isInteger(item.day) &&
              item.day >= 0 && item.day < days.length && validTime(item.start) && validTime(item.end) &&
              minutes(item.start) >= 8 * 60 && minutes(item.end) <= 20 * 60 && minutes(item.end) > minutes(item.start)
            ).map(item => ({
              ...item,
              format: item.format === "online" ? "online" : "physical",
              color: validColor(item.color) ? item.color : colorForName(item.name)
            }));
          const colorsByName = new Map();
          return normalized.map(course => {
            const key = course.name.trim().toLocaleLowerCase();
            if (!colorsByName.has(key)) colorsByName.set(key, course.color);
            return { ...course, color: colorsByName.get(key) };
          });
        }
        function validTime(value) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
        function validColor(value) { return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value); }
        function setSaveStatus(state, label) {
          autoSaveStatus.dataset.state = state;
          autoSaveLabel.textContent = label;
        }
        function saveCourses() {
          try {
            localStorage.setItem(storageKey, JSON.stringify(courses));
            setSaveStatus("saved", "Auto-saved");
          } catch (storageError) {
            console.error("Could not save timetable.", storageError);
            setSaveStatus("error", "Save failed");
            showToast("Could not save your timetable in this browser.");
          }
        }
        function savePreference(key, value) {
          try {
            localStorage.setItem(key, value);
            setSaveStatus("saved", "Auto-saved");
          } catch (storageError) {
            console.error("Could not save preference.", storageError);
            setSaveStatus("error", "Save failed");
            showToast("Could not save your preference in this browser.");
          }
        }
        function saveCollection(key, collection) {
          try {
            localStorage.setItem(key, JSON.stringify(collection));
            setSaveStatus("saved", "Auto-saved");
          } catch (storageError) {
            console.error(`Could not save data for ${key}.`, storageError);
            setSaveStatus("error", "Save failed");
            showToast("Could not save this study data in your browser.");
          }
        }
        function saveNote() {
          clearTimeout(noteSaveTimer);
          notesSaveStatus.dataset.state = "saving";
          notesSaveLabel.textContent = "Saving…";
          renderNotePreview();
          renderNoteWordCount();
          noteSaveTimer = setTimeout(() => {
            try {
              localStorage.setItem(notesStorageKey, JSON.stringify({
                title: noteTitleInput.value,
                content: noteContentInput.value
              }));
              notesSaveStatus.dataset.state = "saved";
              notesSaveLabel.textContent = "Saved in this browser";
            } catch (storageError) {
              console.error("Could not save your notes.", storageError);
              notesSaveStatus.dataset.state = "error";
              notesSaveLabel.textContent = "Save failed";
            }
          }, 250);
        }
        function saveSemesterSettings() {
          const settings = { start: semesterStartInput.value, weeks: Number(semesterWeeksInput.value) };
          if (!parseLocalDate(settings.start) || !Number.isInteger(settings.weeks) || settings.weeks < 1 || settings.weeks > 52) return;
          try {
            localStorage.setItem(semesterStorageKey, JSON.stringify(settings));
            setSaveStatus("saved", "Auto-saved");
          } catch (storageError) {
            console.error("Could not save semester settings.", storageError);
            setSaveStatus("error", "Save failed");
            showToast("Could not save your semester settings.");
          }
          renderSemesterProgress();
          renderWeek();
        }
        function minutes(value) {
          const [hours, mins] = value.split(":").map(Number);
          return hours * 60 + mins;
        }
        function colorForName(name) {
          let hash = 0;
          for (const character of name.trim().toLocaleLowerCase()) hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
          return palette[Math.abs(hash) % palette.length];
        }
        function colorForCourse(course) {
          return validColor(course.color) ? course.color : colorForName(course.name);
        }
        function selectedColorForName(name, fallback) {
          const normalizedName = name.trim().toLocaleLowerCase();
          return courses.find(course => course.name.trim().toLocaleLowerCase() === normalizedName)?.color || fallback;
        }
        function renderColorPicker() {
          courseColorPicker.replaceChildren();
          palette.forEach((color, index) => {
            const swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = "course-color-swatch";
            swatch.style.setProperty("--swatch", color);
            swatch.dataset.color = color;
            swatch.setAttribute("role", "radio");
            const selected = color.toLowerCase() === selectedCourseColor.toLowerCase();
            swatch.setAttribute("aria-label", `Course color ${index + 1} (${color})`);
            swatch.setAttribute("aria-checked", String(selected));
            swatch.tabIndex = selected ? 0 : -1;
            swatch.addEventListener("click", () => {
              selectedCourseColor = color;
              renderColorPicker();
            });
            swatch.addEventListener("keydown", event => {
              const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!delta) return;
              event.preventDefault();
              const nextIndex = (index + delta + palette.length) % palette.length;
              selectedCourseColor = palette[nextIndex];
              renderColorPicker();
              courseColorPicker.children[nextIndex].focus();
            });
            courseColorPicker.appendChild(swatch);
          });
        }
        function chooseCourseColor(color) {
          selectedCourseColor = validColor(color) ? color : palette[0];
          renderColorPicker();
        }
        function weekDate(dayIndex) {
          const now = new Date();
          const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
          monday.setDate(monday.getDate() + dayIndex);
          return monday;
        }
        function appendInlineMarkdown(parent, text) {
          const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`([^`]+)`/g;
          let cursor = 0;
          let match;
          while ((match = pattern.exec(text))) {
            parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
            if (match[2]) {
              const link = document.createElement("a");
              link.textContent = match[1];
              const url = new URL(match[2], window.location.href);
              if (["http:", "https:", "mailto:"].includes(url.protocol)) {
                link.href = url.href;
                if (url.protocol !== "mailto:") {
                  link.target = "_blank";
                  link.rel = "noopener noreferrer";
                }
                parent.appendChild(link);
              } else {
                parent.appendChild(document.createTextNode(match[0]));
              }
            } else {
              const element = document.createElement(match[3] || match[4] ? "strong" : match[5] || match[6] ? "em" : "code");
              element.textContent = match[3] || match[4] || match[5] || match[6] || match[7];
              parent.appendChild(element);
            }
            cursor = pattern.lastIndex;
          }
          parent.appendChild(document.createTextNode(text.slice(cursor)));
        }
        function renderNotePreview() {
          const preview = document.getElementById("note-preview");
          preview.replaceChildren();
          const source = noteContentInput.value;
          if (!source.trim()) {
            const empty = document.createElement("p");
            empty.className = "markdown-empty";
            empty.textContent = "Your ideas will find their shape here.";
            preview.appendChild(empty);
            return;
          }
          let paragraph = [];
          let list = null;
          let codeLines = null;
          const flushParagraph = () => {
            if (!paragraph.length) return;
            const element = document.createElement("p");
            appendInlineMarkdown(element, paragraph.join(" "));
            preview.appendChild(element);
            paragraph = [];
          };
          const stopList = () => { list = null; };
          source.split(/\r?\n/).forEach(line => {
            if (line.trimStart().startsWith("```")) {
              flushParagraph();
              stopList();
              if (codeLines) {
                const pre = document.createElement("pre");
                const code = document.createElement("code");
                code.textContent = codeLines.join("\n");
                pre.appendChild(code);
                preview.appendChild(pre);
                codeLines = null;
              } else {
                codeLines = [];
              }
              return;
            }
            if (codeLines) {
              codeLines.push(line);
              return;
            }
            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
            const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
            const quote = line.match(/^\s*>\s?(.*)$/);
            if (heading) {
              flushParagraph();
              stopList();
              const element = document.createElement(`h${heading[1].length}`);
              appendInlineMarkdown(element, heading[2]);
              preview.appendChild(element);
            } else if (unordered || ordered) {
              flushParagraph();
              const kind = unordered ? "ul" : "ol";
              if (!list || list.tagName.toLowerCase() !== kind) {
                list = document.createElement(kind);
                preview.appendChild(list);
              }
              const item = document.createElement("li");
              appendInlineMarkdown(item, (unordered || ordered)[1]);
              list.appendChild(item);
            } else if (quote) {
              flushParagraph();
              stopList();
              const element = document.createElement("blockquote");
              appendInlineMarkdown(element, quote[1]);
              preview.appendChild(element);
            } else if (/^\s*---+\s*$/.test(line)) {
              flushParagraph();
              stopList();
              preview.appendChild(document.createElement("hr"));
            } else if (!line.trim()) {
              flushParagraph();
              stopList();
            } else {
              stopList();
              paragraph.push(line.trim());
            }
          });
          flushParagraph();
          if (codeLines) {
            const pre = document.createElement("pre");
            const code = document.createElement("code");
            code.textContent = codeLines.join("\n");
            pre.appendChild(code);
            preview.appendChild(pre);
          }
        }
        function renderNoteWordCount() {
          const words = noteContentInput.value.trim().match(/\S+/g)?.length || 0;
          document.getElementById("note-word-count").textContent = `${words} word${words === 1 ? "" : "s"}`;
        }
        function downloadNote(extension) {
          const safeName = noteTitleInput.value.trim()
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
            .replace(/\s+/g, "-")
            .replace(/[. ]+$/g, "")
            .slice(0, 80) || "study-notes";
          const blob = new Blob([noteContentInput.value], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${safeName}.${extension}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          showToast(`Note downloaded as .${extension}`);
        }
        function renderSemesterProgress() {
          const start = parseLocalDate(semesterStartInput.value);
          const weeks = Number(semesterWeeksInput.value);
          if (!start || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) return;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const elapsedDays = dateOrdinal(today) - dateOrdinal(start);
          const totalDays = weeks * 7;
          const completed = Math.max(0, Math.min(100, Math.round(elapsedDays / totalDays * 100)));
          const elapsedWeeks = Math.max(0, Math.floor(elapsedDays / 7) + 1);
          const label = elapsedDays < 0
            ? `Starts in ${Math.ceil(-elapsedDays / 7)} week${Math.ceil(-elapsedDays / 7) === 1 ? "" : "s"} · 0% done`
            : elapsedDays >= totalDays
              ? "Semester complete · 100% done"
              : `Week ${elapsedWeeks} of ${weeks} · ${completed}% done`;
          document.getElementById("semester-progress-fill").style.width = `${completed}%`;
          document.getElementById("semester-progress").setAttribute("aria-valuenow", String(completed));
          document.getElementById("semester-progress-label").textContent = label;
        }
        function renderWeek() {
          const visibleDayCount = weekendToggle.checked ? days.length : 5;
          const visibleCourses = courses.filter(course => course.day < visibleDayCount);
          const firstDate = weekDate(0);
          const lastDate = weekDate(visibleDayCount - 1);
          const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
          const dayNumberFormat = new Intl.DateTimeFormat(undefined, { day: "numeric" });
          document.getElementById("week-label").textContent = `${dateFormat.format(firstDate)} – ${dateFormat.format(lastDate)}`;
          const columnsStyle = `57px repeat(${visibleDayCount}, minmax(105px, 1fr))`;
          headings.style.gridTemplateColumns = columnsStyle;
          headings.style.setProperty("--visible-day-count", visibleDayCount);
          calendarBody.style.gridTemplateColumns = columnsStyle;
          calendarBody.style.setProperty("--visible-day-count", visibleDayCount);
          document.querySelector(".timetable").style.minWidth = `${57 + visibleDayCount * 105}px`;
          headings.innerHTML = '<div></div>' + days.slice(0, visibleDayCount).map((day, index) => {
            const date = weekDate(index);
            const isToday = date.toDateString() === new Date().toDateString();
            return `<div class="day-heading${isToday ? " today" : ""}">${day}<strong>${dayNumberFormat.format(date)}</strong></div>`;
          }).join("");
          calendarBody.querySelectorAll(".day-column").forEach(column => column.remove());
          const timeColumn = document.getElementById("time-column");
          timeColumn.innerHTML = Array.from({ length: 12 }, (_, i) => {
            const hour = i + 8;
            return `<div class="time-label">${hour < 12 ? hour + " AM" : hour === 12 ? "12 PM" : (hour - 12) + " PM"}</div>`;
          }).join("");
          for (let day = 0; day < visibleDayCount; day++) {
            const column = document.createElement("div");
            column.className = "day-column";
            column.dataset.day = String(day);
            const dayCourses = courses.filter(course => course.day === day);
            dayCourses.forEach(course => {
              const start = minutes(course.start);
              const end = minutes(course.end);
              const top = (start - 8 * 60) / 60 * 52;
              const height = Math.max((end - start) / 60 * 52 - 4, 36);
              const color = colorForCourse(course);
              const card = document.createElement("button");
              card.type = "button";
              card.className = "course-card" + (height < 58 ? " compact" : "");
              card.style.cssText = `top:${top}px;height:${height}px;--course-bg:color-mix(in srgb, ${color} 19%, var(--paper));--course-color:${color};--course-text:var(--ink)`;
              card.style.animationDelay = `${dayCourses.indexOf(course) * 35}ms`;
              card.dataset.courseId = course.id;
              const formatLabel = course.format === "online" ? "Online" : "In person";
              card.setAttribute("aria-label", `${course.name}, ${formatLabel}, ${course.start} to ${course.end}, ${course.venue}. Select to edit.`);
              card.innerHTML = `<div class="course-name"></div><div class="course-meta"></div>`;
              card.querySelector(".course-name").textContent = course.name;
              card.querySelector(".course-meta").textContent = `${formatLabel} · ${formatTime(course.start)} – ${formatTime(course.end)} · ${course.venue}`;
              card.addEventListener("click", () => editCourse(course.id));
              column.appendChild(card);
            });
            calendarBody.appendChild(column);
          }
          if (visibleCourses.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.innerHTML = `<div><span>✳</span>${courses.length && !weekendToggle.checked ? "Your weekday schedule is clear.<br>Weekend classes are hidden." : "Your week is wide open.<br>Add a course to get started."}</div>`;
            calendarBody.appendChild(empty);
          } else {
            const empty = calendarBody.querySelector(".empty-state");
            if (empty) empty.remove();
          }
          document.getElementById("course-count").textContent = String(courses.length);
          const totalMinutes = courses.reduce((total, course) => total + minutes(course.end) - minutes(course.start), 0);
          document.getElementById("hours-count").textContent = `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 ? ` ${totalMinutes % 60}m` : ""}`;
        }
        function formatTime(value) {
          const [hour, minute] = value.split(":").map(Number);
          return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
        }
        function showToast(message) {
          toast.textContent = message;
          toast.classList.add("visible");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => toast.classList.remove("visible"), 2500);
        }
        function showPage(page) {
          const pages = {
            planner: ["planner-page", "planner-tab", "#timetable"],
            study: ["study-page", "study-tab", "#study-hub"],
            notes: ["notes-page", "notes-tab", "#notes"]
          };
          const selectedPage = pages[page] ? page : "planner";
          Object.entries(pages).forEach(([name, [pageId, tabId]]) => {
            document.getElementById(pageId).hidden = name !== selectedPage;
            document.getElementById(tabId).setAttribute("aria-selected", String(name === selectedPage));
          });
          const nextHash = pages[selectedPage][2];
          if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
        }
        function renderExams() {
          const list = document.getElementById("exam-list");
          list.replaceChildren();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const validExams = exams.filter(exam => exam && typeof exam.id === "string" && typeof exam.name === "string" && parseLocalDate(exam.date))
            .sort((a, b) => a.date.localeCompare(b.date));
          if (!validExams.length) {
            const empty = document.createElement("p");
            empty.className = "study-empty";
            empty.textContent = "No exams yet. Add one to start your countdown.";
            list.appendChild(empty);
            return;
          }
          validExams.forEach(exam => {
            const examDate = parseLocalDate(exam.date);
            const daysAway = dateOrdinal(examDate) - dateOrdinal(today);
            const item = document.createElement("div");
            item.className = "exam-item";
            const copy = document.createElement("div");
            copy.style.minWidth = "0";
            copy.style.flex = "1";
            const title = document.createElement("div");
            title.className = "exam-title";
            title.textContent = exam.name;
            const date = document.createElement("div");
            date.className = "exam-date";
            date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(examDate);
            const countdown = document.createElement("div");
            countdown.className = "exam-countdown";
            countdown.textContent = daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : daysAway > 0 ? `In ${daysAway} days` : `${Math.abs(daysAway)} days ago`;
            const remove = document.createElement("button");
            remove.className = "exam-remove";
            remove.type = "button";
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Remove ${exam.name}`);
            remove.addEventListener("click", () => {
              exams = exams.filter(item => item.id !== exam.id);
              saveCollection(examsStorageKey, exams);
              renderExams();
            });
            copy.append(title, date);
            item.append(copy, countdown, remove);
            list.appendChild(item);
          });
        }
        function renderTodos() {
          const list = document.getElementById("todo-list");
          list.replaceChildren();
          const validTodos = todos.filter(todo => todo && typeof todo.id === "string" && typeof todo.title === "string" && parseLocalDate(todo.deadline))
            .sort((a, b) => Number(a.done) - Number(b.done) || a.deadline.localeCompare(b.deadline));
          if (!validTodos.length) {
            const empty = document.createElement("p");
            empty.className = "study-empty";
            empty.textContent = "Your list is clear. Add a task when you are ready.";
            list.appendChild(empty);
            return;
          }
          const today = localDateString(new Date());
          validTodos.forEach(todo => {
            const item = document.createElement("div");
            item.className = `todo-item${todo.done ? " completed" : ""}`;
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(todo.done);
            checkbox.setAttribute("aria-label", `Mark ${todo.title} as ${todo.done ? "incomplete" : "complete"}`);
            checkbox.addEventListener("change", () => {
              todos = todos.map(entry => entry.id === todo.id ? { ...entry, done: checkbox.checked } : entry);
              saveCollection(todosStorageKey, todos);
              renderTodos();
            });
            const copy = document.createElement("div");
            copy.className = "todo-copy";
            const title = document.createElement("div");
            title.className = "todo-title";
            title.textContent = todo.title;
            const deadline = document.createElement("div");
            deadline.className = `todo-deadline${!todo.done && todo.deadline < today ? " todo-overdue" : ""}`;
            const deadlineDate = parseLocalDate(todo.deadline);
            deadline.textContent = `${!todo.done && todo.deadline < today ? "Overdue · " : "Due "}${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(deadlineDate)}`;
            const remove = document.createElement("button");
            remove.className = "todo-remove";
            remove.type = "button";
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Remove task ${todo.title}`);
            remove.addEventListener("click", () => {
              todos = todos.filter(entry => entry.id !== todo.id);
              saveCollection(todosStorageKey, todos);
              renderTodos();
            });
            copy.append(title, deadline);
            item.append(checkbox, copy, remove);
            list.appendChild(item);
          });
        }
        function timerDuration(mode) {
          const value = Number(document.getElementById(mode === "focus" ? "focus-minutes" : "break-minutes").value);
          return Math.min(mode === "focus" ? 90 : 30, Math.max(1, Number.isFinite(value) ? value : mode === "focus" ? 25 : 5)) * 60;
        }
        function renderPomodoro() {
          const minutes = Math.floor(timerRemaining / 60);
          const seconds = timerRemaining % 60;
          document.getElementById("pomodoro-time").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
          document.getElementById("pomodoro-mode").textContent = timerMode === "focus" ? "Focus time" : "Break time";
          document.getElementById("pomodoro-toggle").textContent = timerRunning ? "Pause" : timerRemaining === timerDuration(timerMode) ? `Start ${timerMode}` : "Resume";
          const progress = Math.max(0, Math.min(100, (1 - timerRemaining / timerDuration(timerMode)) * 100));
          document.getElementById("pomodoro-clock").style.setProperty("--timer-progress", `${progress}%`);
        }
        function stopPomodoroInterval() {
          if (timerInterval !== null) clearInterval(timerInterval);
          timerInterval = null;
        }
        function preparePomodoroAudio() {
          const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextConstructor) {
            showToast("This browser does not support the focus timer chime.");
            return;
          }
          try {
            if (!audioContext) audioContext = new AudioContextConstructor();
            if (audioContext.state === "suspended") {
              audioContext.resume().catch(audioError => {
                console.error("Could not enable the Pomodoro chime.", audioError);
                showToast("Allow audio in your browser to hear the timer chime.");
              });
            }
          } catch (audioError) {
            console.error("Could not enable the Pomodoro chime.", audioError);
            showToast("Could not enable the timer chime in this browser.");
          }
        }
        function playPomodoroChime() {
          if (!audioContext || audioContext.state !== "running") return;
          const notes = [659.25, 783.99, 987.77];
          const startAt = audioContext.currentTime;
          notes.forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator();
            const volume = audioContext.createGain();
            const noteStart = startAt + index * 0.28;
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            volume.gain.setValueAtTime(0.0001, noteStart);
            volume.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.025);
            volume.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.62);
            oscillator.connect(volume);
            volume.connect(audioContext.destination);
            oscillator.start(noteStart);
            oscillator.stop(noteStart + 0.64);
          });
        }
        function tickPomodoro() {
          timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
          if (timerRemaining === 0) {
            timerRunning = false;
            stopPomodoroInterval();
            if (pomodoroChimeToggle.checked) playPomodoroChime();
            timerMode = timerMode === "focus" ? "break" : "focus";
            timerRemaining = timerDuration(timerMode);
            showToast(timerMode === "break" ? "Focus session complete. Take a break!" : "Break is over. Ready to focus?");
          }
          renderPomodoro();
        }
        function savePomodoroSettings() {
          const focus = document.getElementById("focus-minutes");
          const pause = document.getElementById("break-minutes");
          focus.value = String(Math.min(90, Math.max(1, Number(focus.value) || 25)));
          pause.value = String(Math.min(30, Math.max(1, Number(pause.value) || 5)));
          timerRunning = false;
          stopPomodoroInterval();
          timerRemaining = timerDuration(timerMode);
          renderPomodoro();
        }
        function resetForm() {
          editingId = null;
          form.reset();
          courseStart.value = "09:00";
          courseEnd.value = "10:00";
          chooseCourseColor(palette[0]);
          updateVenueField();
          document.getElementById("form-title").textContent = "Add a course";
          document.getElementById("submit-button").innerHTML = 'Add to timetable <span class="button-icon">↗</span>';
          document.getElementById("delete-course-button").hidden = true;
          error.style.display = "none";
        }
        function editCourse(id) {
          const course = courses.find(item => item.id === id);
          if (!course) return;
          if (course.day >= 5 && !weekendToggle.checked) {
            weekendToggle.checked = true;
            savePreference(weekendStorageKey, "true");
            updateWeekendOptions();
            renderWeek();
          }
          editingId = id;
          courseName.value = course.name;
          courseVenue.value = course.venue;
          courseDay.value = String(course.day);
          courseStart.value = course.start;
          courseEnd.value = course.end;
          courseFormat.value = course.format || "physical";
          chooseCourseColor(colorForCourse(course));
          updateVenueField();
          document.getElementById("form-title").textContent = "Edit course";
          document.getElementById("submit-button").innerHTML = 'Save changes <span class="button-icon">↗</span>';
          document.getElementById("delete-course-button").hidden = false;
          error.style.display = "none";
          courseName.focus();
          if (window.matchMedia("(max-width: 760px)").matches) document.querySelector(".form-panel").scrollIntoView({ behavior: "smooth", block: "center" });
        }
        function updateWeekendOptions() {
          [...courseDay.options].forEach(option => {
            if (Number(option.value) >= 5) {
              option.disabled = !weekendToggle.checked;
              option.textContent = weekendToggle.checked ? days[Number(option.value)] : `${days[Number(option.value)]} (enable weekends)`;
            }
          });
        }
        function updateVenueField() {
          const online = courseFormat.value === "online";
          venueLabel.textContent = online ? "Platform or meeting link" : "Venue";
          courseVenue.placeholder = online ? "e.g. Zoom · course.example.edu" : "e.g. Arts Building · 204";
        }
        function icalEscape(value) {
          return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
        }
        function foldIcalLine(line) {
          const chunks = [];
          let current = "";
          let byteLength = 0;
          for (const character of line) {
            const size = new TextEncoder().encode(character).length;
            if (byteLength + size > 75) {
              chunks.push(current);
              current = " ";
              byteLength = 1;
            }
            current += character;
            byteLength += size;
          }
          chunks.push(current);
          return chunks.join("\r\n");
        }
        function icalDateTime(date, time) {
          return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}T${time.replace(":", "")}00`;
        }
        function nextCourseDate(day, start) {
          const now = new Date();
          const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          let daysAhead = (day - ((now.getDay() + 6) % 7) + 7) % 7;
          if (daysAhead === 0 && minutes(start) <= now.getHours() * 60 + now.getMinutes()) daysAhead = 7;
          date.setDate(date.getDate() + daysAhead);
          return date;
        }
        function exportCalendar() {
          const dayCodes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
          const exportEndDate = calendarEndInput.value ? parseLocalDate(calendarEndInput.value) : null;
          if (calendarEndInput.value && !exportEndDate) {
            showToast("Choose a valid calendar export end date.");
            return;
          }
          const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
          const lines = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Weekwise//Timetable//EN",
            "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Weekwise timetable",
            "X-WR-CALDESC:Weekly class timetable exported from Weekwise"
          ];
          let omittedCourses = 0;
          courses.forEach(course => {
            const startDate = nextCourseDate(course.day, course.start);
            if (exportEndDate && dateOrdinal(startDate) > dateOrdinal(exportEndDate)) {
              omittedCourses++;
              return;
            }
            const untilRule = exportEndDate
              ? `;UNTIL=${localDateString(exportEndDate).replace(/-/g, "")}T235959`
              : "";
            lines.push(
              "BEGIN:VEVENT",
              `UID:${course.id}@weekwise.app`,
              `DTSTAMP:${stamp}`,
              `DTSTART:${icalDateTime(startDate, course.start)}`,
              `DTEND:${icalDateTime(startDate, course.end)}`,
              `RRULE:FREQ=WEEKLY;BYDAY=${dayCodes[course.day]}${untilRule}`,
              `SUMMARY:${icalEscape(course.name)}`,
              `LOCATION:${icalEscape(course.venue)}`,
              `DESCRIPTION:${icalEscape(`${course.format === "online" ? "Online class" : "In-person class"} at ${course.venue}`)}`,
              "END:VEVENT"
            );
          });
          lines.push("END:VCALENDAR");
          const blob = new Blob([lines.map(foldIcalLine).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "weekwise-timetable.ics";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          showToast(omittedCourses
            ? `Calendar exported; ${omittedCourses} class${omittedCourses === 1 ? "" : "es"} start after the end date.`
            : "Recurring calendar file exported");
        }

        form.addEventListener("submit", event => {
          event.preventDefault();
          const name = courseName.value.trim();
          const venue = courseVenue.value.trim();
          const format = courseFormat.value === "online" ? "online" : "physical";
          const color = editingId ? selectedCourseColor : selectedColorForName(name, selectedCourseColor);
          const day = Number(courseDay.value);
          const start = courseStart.value;
          const end = courseEnd.value;
          if (!name || !venue) {
            error.textContent = format === "online" ? "Add a course name and online platform or meeting link to continue." : "Add a course name and venue to continue.";
            error.style.display = "block";
            return;
          }
          if (!validTime(start) || !validTime(end) || minutes(end) <= minutes(start)) {
            error.textContent = "The end time must be later than the start time.";
            error.style.display = "block";
            return;
          }
          if (minutes(start) < 8 * 60 || minutes(end) > 20 * 60) {
            error.textContent = "Choose times between 8:00 AM and 8:00 PM.";
            error.style.display = "block";
            return;
          }
          if (!Number.isInteger(day) || day < 0 || day >= days.length || (day >= 5 && !weekendToggle.checked)) {
            error.textContent = "Enable weekends before scheduling a Saturday or Sunday class.";
            error.style.display = "block";
            return;
          }
          const overlapping = courses.some(course => course.id !== editingId && course.day === day &&
            minutes(start) < minutes(course.end) && minutes(end) > minutes(course.start));
          if (overlapping) {
            error.textContent = "This class overlaps another course on that day.";
            error.style.display = "block";
            return;
          }
          const wasEditing = Boolean(editingId);
          if (editingId) {
            const updatedName = name.toLocaleLowerCase();
            courses = courses.map(course => {
              if (course.id === editingId) return { ...course, name, venue, format, day, start, end, color };
              return course.name.trim().toLocaleLowerCase() === updatedName ? { ...course, color } : course;
            });
          } else {
            courses.push({ id: crypto.randomUUID(), name, venue, format, day, start, end, color: selectedColorForName(name, color) });
          }
          courses.sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start));
          saveCourses();
          renderWeek();
          resetForm();
          showToast(wasEditing ? "Course updated" : "Course added to your week");
        });

        themeSelect.addEventListener("change", () => {
          document.body.dataset.theme = themeSelect.value;
          savePreference("weekwise-theme-v1", themeSelect.value);
        });
        courseName.addEventListener("input", () => {
          const matchingColor = selectedColorForName(courseName.value, "");
          if (matchingColor) chooseCourseColor(matchingColor);
        });
        weekendToggle.addEventListener("change", () => {
          updateWeekendOptions();
          savePreference(weekendStorageKey, String(weekendToggle.checked));
          renderWeek();
        });
        courseFormat.addEventListener("change", updateVenueField);
        [semesterStartInput, semesterWeeksInput].forEach(input => input.addEventListener("change", saveSemesterSettings));
        document.getElementById("previous-week").addEventListener("click", () => { weekOffset--; renderWeek(); });
        document.getElementById("next-week").addEventListener("click", () => { weekOffset++; renderWeek(); });
        document.getElementById("today-button").addEventListener("click", () => { weekOffset = 0; renderWeek(); });
        document.getElementById("planner-tab").addEventListener("click", () => showPage("planner"));
        document.getElementById("study-tab").addEventListener("click", () => showPage("study"));
        document.getElementById("notes-tab").addEventListener("click", () => showPage("notes"));
        window.addEventListener("hashchange", () => {
          const pages = { "#study-hub": "study", "#notes": "notes" };
          showPage(pages[window.location.hash] || "planner");
        });
        [noteTitleInput, noteContentInput].forEach(input => input.addEventListener("input", saveNote));
        document.getElementById("download-txt-button").addEventListener("click", () => downloadNote("txt"));
        document.getElementById("download-md-button").addEventListener("click", () => downloadNote("md"));
        document.getElementById("exam-form").addEventListener("submit", event => {
          event.preventDefault();
          const name = document.getElementById("exam-name").value.trim();
          const date = document.getElementById("exam-date").value;
          if (!name || !parseLocalDate(date)) return;
          exams.push({ id: crypto.randomUUID(), name, date });
          exams.sort((a, b) => a.date.localeCompare(b.date));
          saveCollection(examsStorageKey, exams);
          event.currentTarget.reset();
          renderExams();
          showToast("Exam countdown added");
        });
        document.getElementById("todo-form").addEventListener("submit", event => {
          event.preventDefault();
          const title = document.getElementById("todo-title-input").value.trim();
          const deadline = document.getElementById("todo-deadline-input").value;
          if (!title || !parseLocalDate(deadline)) return;
          todos.push({ id: crypto.randomUUID(), title, deadline, done: false });
          saveCollection(todosStorageKey, todos);
          event.currentTarget.reset();
          renderTodos();
          showToast("Task added to your list");
        });
        document.getElementById("pomodoro-toggle").addEventListener("click", () => {
          if (timerRunning) {
            tickPomodoro();
            timerRunning = false;
            stopPomodoroInterval();
          } else {
            if (pomodoroChimeToggle.checked) preparePomodoroAudio();
            timerDeadline = Date.now() + timerRemaining * 1000;
            timerRunning = true;
            timerInterval = setInterval(tickPomodoro, 250);
          }
          renderPomodoro();
        });
        document.getElementById("pomodoro-reset").addEventListener("click", () => {
          timerRunning = false;
          stopPomodoroInterval();
          timerRemaining = timerDuration(timerMode);
          renderPomodoro();
        });
        ["focus-minutes", "break-minutes"].forEach(id => document.getElementById(id).addEventListener("change", savePomodoroSettings));
        pomodoroChimeToggle.addEventListener("change", () => {
          savePreference(chimeStorageKey, String(pomodoroChimeToggle.checked));
          if (pomodoroChimeToggle.checked) preparePomodoroAudio();
        });
        document.getElementById("clear-button").addEventListener("click", () => {
          if (!courses.length) { showToast("Your timetable is already clear"); return; }
          if (!window.confirm("Remove all courses from your timetable?")) return;
          courses = [];
          saveCourses();
          renderWeek();
          resetForm();
          showToast("All courses removed");
        });
        document.getElementById("delete-course-button").addEventListener("click", () => {
          const course = courses.find(item => item.id === editingId);
          if (!course || !window.confirm(`Remove "${course.name}" from your timetable?`)) return;
          courses = courses.filter(item => item.id !== course.id);
          saveCourses();
          renderWeek();
          resetForm();
          showToast("Course removed");
        });
        document.getElementById("export-button").addEventListener("click", () => {
          const previousTitle = document.title;
          document.title = "my-timetable";
          window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
          window.print();
        });
        document.getElementById("calendar-export-button").addEventListener("click", exportCalendar);
        window.addEventListener("storage", event => {
          if (event.key === storageKey) {
            try { courses = normalizeCourses(JSON.parse(event.newValue || "[]")); }
            catch (storageError) { console.error("Could not read timetable updated in another tab.", storageError); }
            renderWeek();
            setSaveStatus("saved", "Updated in another tab");
          } else if (event.key === examsStorageKey) {
            exams = loadCollection(examsStorageKey);
            renderExams();
          } else if (event.key === todosStorageKey) {
            todos = loadCollection(todosStorageKey);
            renderTodos();
          } else if (event.key === semesterStorageKey) {
            const settings = loadSemesterSettings();
            semesterStartInput.value = settings.start;
            semesterWeeksInput.value = String(settings.weeks);
            renderSemesterProgress();
          } else if (event.key === weekendStorageKey) {
            weekendToggle.checked = event.newValue === "true";
            updateWeekendOptions();
            renderWeek();
          } else if (event.key === "weekwise-theme-v1") {
            const theme = event.newValue;
            if (["sage", "ocean", "lavender", "midnight", "rose", "sand", "slate"].includes(theme)) {
              document.body.dataset.theme = theme;
              themeSelect.value = theme;
            }
          } else if (event.key === notesStorageKey) {
            const note = loadNote();
            noteTitleInput.value = note.title;
            noteContentInput.value = note.content;
            renderNotePreview();
            renderNoteWordCount();
          } else if (event.key === chimeStorageKey) {
            pomodoroChimeToggle.checked = event.newValue !== "false";
          }
        });
        updateWeekendOptions();
        updateVenueField();
        renderColorPicker();
        renderWeek();
        renderSemesterProgress();
        renderExams();
        renderTodos();
        renderPomodoro();
        renderNotePreview();
        renderNoteWordCount();
        showPage(({ "#study-hub": "study", "#notes": "notes" })[window.location.hash] || "planner");
        setInterval(renderExams, 60000);
        setInterval(renderSemesterProgress, 3600000);
      })();
