# ELMS HTML Fixtures

Please save your sanitized HTML pages in this directory (`fixtures/elms/`).

### How to Save & Sanitize:
1. Log in to [elms.uiu.ac.bd](https://elms.uiu.ac.bd).
2. For each page below:
   - Save the page as "Webpage, HTML Only" (or open DevTools `F12` -> Elements -> right-click `<html>` -> **Copy outerHTML**).
   - **Sanitize**: Remove any personal data (your real name, student ID, personal email, tokens, and `sesskey` values).
   - Save into `fixtures/elms/<filename>`.

### Recommended Fixture Files:
- [ ] `login.html` — The logged-out login page (`/login/index.php`)
- [ ] `course-list.html` — Enrolled courses page (`/my/courses.php` or `/my/`)
- [ ] `course-view-1.html` — A typical course page (`/course/view.php?id=...`) with materials, assignments, quizzes
- [ ] `announcements.html` — Course announcements / news forum page
- [ ] `forum-view.html` — A discussion forum page (`/mod/forum/view.php?id=...`)
- [ ] `assignment-index.html` — Course assignment list (`/mod/assign/index.php?id=...`)
- [ ] `grades-course.html` — Course grades report (`/grade/report/user/index.php?id=...`)
- [ ] `calendar-upcoming.html` — Upcoming events (`/calendar/view.php?view=upcoming`)
- [ ] `notifications.html` — Notifications list (`/message/output/popup/notifications.php` or notification drawer markup)
