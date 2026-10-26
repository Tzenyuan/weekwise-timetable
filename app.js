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
        const savedTheme = readPreference("weekwise-theme-v1");
        const weekendPreference = readPreference(weekendStorageKey);
        const semesterSettings = loadSemesterSettings();
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
        function renderSemesterProgress() {
          const start = parseLocalDate(semesterStartInput.value);
          const weeks = Number(semesterWeeksInput.value);
          if (!start || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) return;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const elapsedDays = dateOrdinal(today) - dateOrdinal(start);
          const totalDays = weeks * 7;
          const remaining = Math.max(0, Math.min(100, Math.round((totalDays - elapsedDays) / totalDays * 100)));
          const elapsedWeeks = Math.max(0, Math.floor(elapsedDays / 7) + 1);
          const label = elapsedDays < 0
            ? `Starts in ${Math.ceil(-elapsedDays / 7)} week${Math.ceil(-elapsedDays / 7) === 1 ? "" : "s"} · ${remaining}% left`
            : elapsedDays >= totalDays
              ? "Semester complete · 0% left"
              : `Week ${elapsedWeeks} of ${weeks} · ${remaining}% left`;
          document.getElementById("semester-progress-fill").style.width = `${remaining}%`;
          document.getElementById("semester-progress").setAttribute("aria-valuenow", String(remaining));
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
          const planner = page === "planner";
          document.getElementById("planner-page").hidden = !planner;
          document.getElementById("study-page").hidden = planner;
          document.getElementById("planner-tab").setAttribute("aria-selected", String(planner));
          document.getElementById("study-tab").setAttribute("aria-selected", String(!planner));
          const nextHash = planner ? "#timetable" : "#study-hub";
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
        function tickPomodoro() {
          timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
          if (timerRemaining === 0) {
            timerRunning = false;
            stopPomodoroInterval();
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
        window.addEventListener("hashchange", () => showPage(window.location.hash === "#study-hub" ? "study" : "planner"));
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
        showPage(window.location.hash === "#study-hub" ? "study" : "planner");
        setInterval(renderExams, 60000);
        setInterval(renderSemesterProgress, 3600000);
      })();
