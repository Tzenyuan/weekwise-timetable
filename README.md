# Weekwise

Weekwise is a lightweight, responsive timetable maker for planning a recurring weekly class schedule. It runs in the browser with no framework, build tools, or account required.

**Live app:** [tzenyuan.github.io/weekwise-timetable](https://tzenyuan.github.io/weekwise-timetable/)

## Features

- Add courses with a name, venue, weekday, and start and end times.
- Browse dated weeks in the recurring Monday-to-Friday schedule, with an option to expand it to Saturday and Sunday.
- Set the semester start date and length, and see the percentage of the semester remaining.
- Choose a color for each course and mark it as in person or online.
- Edit or remove courses and get warned about overlapping classes.
- Drag courses to another day and time; moves snap to 15-minute increments and prevent overlaps.
- Automatically save courses and preferences in browser storage, with changes shared across open tabs.
- Give courses with the same name the same color.
- Choose from Sage, Ocean, Lavender, and Midnight themes.
- Keep your courses and theme saved in your browser.
- Export a print-ready timetable using **Export as PDF**. Choose **Save as PDF** in your browser's print dialog.
- Export recurring weekly courses as an `.ics` calendar file for Google Calendar or Apple Calendar.
- Switch to the Study Hub for exam countdowns, a configurable Pomodoro timer, and a deadline-based to-do list.
- Use the responsive layout on desktop and mobile.

## Use

Open the [live app](https://tzenyuan.github.io/weekwise-timetable/), or open `index.html` in a modern web browser. Use the week arrows to browse dates and **Today** to return to the current week. Set the semester start date and total weeks to track your progress. Add a course in the form; choose its format and color, then select it in the timetable to edit or remove it. Drag a course to another day or time to reschedule it. Turn on **Include weekends** to show Saturday and Sunday. Use **Clear all** to remove every course.

Open **Study hub** to add exam dates, run focus and break intervals, and manage tasks with deadlines and completion checkboxes.

Courses, semester settings, the weekend setting, theme preferences, exams, and tasks are saved automatically in the browser's local storage. They stay in that browser on that device and are not synced to other devices.

## Calendar export

Select **Export calendar** to download `weekwise-timetable.ics`. Each class is exported as a weekly recurring event with its course name, venue, and local start and end times. The first event is scheduled for its next upcoming weekday; the recurrence continues weekly.

- **Google Calendar:** Open Google Calendar, go to **Settings → Import & export → Import**, and select the downloaded `.ics` file and destination calendar.
- **Apple Calendar:** Open the `.ics` file, or use **File → Import** in Calendar, then choose the destination calendar.

Calendar events use floating local times, so the receiving calendar applies its local time zone.

## Development

The app is a static site and has no build step or external runtime dependencies. To work on it locally, clone the repository and open `index.html` in a browser:

```sh
git clone https://github.com/Tzenyuan/weekwise-timetable.git
cd weekwise-timetable
```

Edit `index.html`, then reload it in your browser to see changes. The site is deployed from the `main` branch using GitHub Pages.

## License

This project is available under the [MIT License](LICENSE).
