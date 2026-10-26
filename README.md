# Weekwise

Weekwise is a lightweight, responsive timetable maker for planning a recurring weekly class schedule. It runs in the browser with no framework, build tools, or account required.

**Live app:** [tzenyuan.github.io/weekwise-timetable](https://tzenyuan.github.io/weekwise-timetable/)

## Features

- Add courses with a name, venue, weekday, and start and end times.
- View the recurring Monday-to-Friday schedule in an animated weekly grid.
- Edit or remove courses and get warned about overlapping classes.
- Choose from Sage, Ocean, Lavender, and Midnight themes.
- Keep your courses and theme saved in your browser.
- Export a print-ready timetable using **Export as PDF**. Choose **Save as PDF** in your browser's print dialog.
- Use the responsive layout on desktop and mobile.

## Use

Open the [live app](https://tzenyuan.github.io/weekwise-timetable/), or open `index.html` in a modern web browser. Add a course in the form; select a course in the timetable to edit or remove it. Use **Clear all** to remove every course.

Courses and theme preferences are stored in the browser's local storage. They stay in that browser on that device and are not synced to other devices.

## Development

The app is a static site and has no build step or external runtime dependencies. To work on it locally, clone the repository and open `index.html` in a browser:

```sh
git clone https://github.com/Tzenyuan/weekwise-timetable.git
cd weekwise-timetable
```

Edit `index.html`, then reload it in your browser to see changes. The site is deployed from the `main` branch using GitHub Pages.

## License

This project is available under the [MIT License](LICENSE).
