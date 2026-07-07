#!/usr/bin/env python3
"""update_tour.py — manage Litty D tour dates in index.html.

A tiny interactive menu that does the only three things done when shows change:
  1) remove shows that are in the past
  2) add a new show (prompts for details, updates index.html)
  3) git commit & push

The menu loops, so any combination works in one run (just 3; 2 then 3;
1,2,3; or 2,2,2,3, etc.). No external dependencies — standard library only.

Shows live only in index.html, inside <ul class="tour-dates-list">. Each show
carries a hidden data-date="YYYY-MM-DD" attribute (invisible on the page) so the
script can tell past from future and keep the list sorted. The visible month /
day / weekday are always re-derived from that date, so they can never drift.
"""

import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

# --- config ----------------------------------------------------------------

# index.html sits next to this script.
INDEX = Path(__file__).resolve().parent / "index.html"

# Badge month labels, matching the style already used in the site ("June", "Sept").
MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "June",
          "July", "Aug", "Sept", "Oct", "Nov", "Dec"]

# Color rotation, reassigned by sorted position on every write.
COLORS = ["purple", "yellow", "red", "blue", "white"]

UL_OPEN = '<ul class="tour-dates-list">'
UL_CLOSE = "</ul>"

# --- model -----------------------------------------------------------------


class Show:
    def __init__(self, iso, name, location, url):
        self.iso = iso                # "YYYY-MM-DD" or None if legacy/unknown
        self.name = name
        self.location = location      # e.g. "San Francisco, CA"
        self.url = url

    @property
    def d(self):
        """Parsed date, or None if this show has no data-date."""
        if not self.iso:
            return None
        return datetime.strptime(self.iso, "%Y-%m-%d").date()

    def sort_key(self):
        # Shows with no known date sort to the very end (far future).
        return self.d or date.max

    def label(self):
        d = self.d
        if not d:
            return f"{self.name} — (no date) — {self.location}"
        return f"{self.name} — {MONTHS[d.month]} {d.day}, {d.year} — {self.location}"


# --- parsing / rendering ---------------------------------------------------


def read_file():
    return INDEX.read_text(encoding="utf-8")


def split_block(html):
    """Return (before, inner, after) around the tour <ul> block."""
    start = html.find(UL_OPEN)
    if start == -1:
        raise SystemExit(f"Could not find '{UL_OPEN}' in {INDEX}")
    inner_start = start + len(UL_OPEN)
    close = html.find(UL_CLOSE, inner_start)
    if close == -1:
        raise SystemExit(f"Could not find closing </ul> for the tour list in {INDEX}")
    return html[:inner_start], html[inner_start:close], html[close:]


def parse_shows(inner):
    shows = []
    for li in re.findall(r"<li\b[^>]*>.*?</li>", inner, re.DOTALL):
        m = re.search(r'data-date="([^"]+)"', li)
        iso = m.group(1) if m else None

        name = _grab(li, "tour-event-name") or ""
        venue = _grab(li, "tour-venue") or ""
        # Venue looks like "City, ST &middot; Weekday" — keep the City, ST part.
        location = re.split(r"\s*&middot;\s*", venue)[0].strip()

        um = re.search(r'<a\s+href="([^"]*)"\s+class="tour-tickets-link"', li)
        url = um.group(1) if um else ""

        shows.append(Show(iso, name, location, url))
    return shows


def _grab(li, cls):
    m = re.search(r'<span class="' + re.escape(cls) + r'">(.*?)</span>', li, re.DOTALL)
    return m.group(1).strip() if m else None


def render_li(show, color):
    d = show.d
    if d:
        month = MONTHS[d.month]
        day = str(d.day)
        weekday = d.strftime("%A")
        venue = f"{show.location} &middot; {weekday}"
        data_attr = f' data-date="{show.iso}"'
    else:
        # Legacy show with no date: leave badge blank-ish and no data-date.
        month, day, venue, data_attr = "?", "?", show.location, ""
    # A blank ticket URL means "no tickets link yet" — omit the <a> entirely.
    link = (f'            <a href="{show.url}" class="tour-tickets-link">Tickets →</a>\n'
            if show.url else "")
    return (
        f'          <li class="tour-date-item tour-color-{color}"{data_attr}>\n'
        f'            <div class="tour-date-badge">\n'
        f'              <span class="badge-month">{month}</span>\n'
        f'              <span class="badge-day">{day}</span>\n'
        f'            </div>\n'
        f'            <div class="tour-date-info">\n'
        f'              <span class="tour-event-name">{show.name}</span>\n'
        f'              <span class="tour-venue">{venue}</span>\n'
        f'            </div>\n'
        f'{link}'
        f'          </li>'
    )


def write_shows(shows):
    """Sort by date, reassign rotating colors, and write index.html."""
    shows = sorted(shows, key=lambda s: s.sort_key())
    lis = [render_li(s, COLORS[i % len(COLORS)]) for i, s in enumerate(shows)]
    inner = "\n" + "\n".join(lis) + "\n        " if lis else "\n        "

    before, _old_inner, after = split_block(read_file())
    INDEX.write_text(before + inner + after, encoding="utf-8")
    return shows


def load_shows():
    _before, inner, _after = split_block(read_file())
    return sorted(parse_shows(inner), key=lambda s: s.sort_key())


# --- actions ---------------------------------------------------------------


def print_shows(shows):
    print("\nCurrent shows:")
    if not shows:
        print("  (none)")
        return
    for i, s in enumerate(shows, 1):
        print(f"  {i}. {s.label()}")


def remove_past(log):
    shows = load_shows()
    today = date.today()
    past = [s for s in shows if s.d and s.d < today]
    if not past:
        print("\nNo past shows to remove.")
        return
    print("\nThese shows are in the past:")
    for s in past:
        print(f"  - {s.label()}")
    if not confirm(f"Remove {len(past)} past show(s)?"):
        print("Cancelled.")
        return
    keep = [s for s in shows if not (s.d and s.d < today)]
    write_shows(keep)
    log.append(f"Remove {len(past)} past show{'s' if len(past) != 1 else ''}")
    print(f"Removed {len(past)} show(s).")


def add_show(log):
    print("\nAdd a show (blank to cancel):")
    iso = prompt_date()
    if iso is None:
        print("Cancelled.")
        return
    name = ask("  Event / venue name: ")
    if not name:
        print("Cancelled.")
        return
    location = ask("  City, State (e.g. San Francisco, CA): ")
    url = ask("  Ticket URL: ")

    shows = load_shows()
    shows.append(Show(iso, name, location, url))
    write_shows(shows)
    log.append(f"Add show: {name}")
    print(f"Added: {name} on {iso}.")


def update_show(log):
    shows = load_shows()
    if not shows:
        print("\nNo shows to update.")
        return
    print("\nUpdate a show (blank to cancel):")
    n = ask("  Which show number? ")
    if not n.isdigit() or not (1 <= int(n) <= len(shows)):
        print("Cancelled.")
        return
    s = shows[int(n) - 1]
    print("  Press Enter to keep the current value for each field.")

    # Date
    while True:
        cur = human_date(s.iso)
        raw = ask(f"  Date (MM-DD-YY) [{cur}]: ")
        if not raw:
            break
        iso = parse_mmddyy(raw)
        if iso:
            s.iso = iso
            break
        print("    Please use MM-DD-YY (e.g. 08-15-26).")

    # Name
    raw = ask(f"  Event / venue name [{s.name}]: ")
    if raw:
        s.name = raw

    # City, State
    raw = ask(f"  City, State [{s.location}]: ")
    if raw:
        s.location = raw

    # Ticket URL — Enter keeps, '-' clears it to blank (no tickets link).
    cur_url = s.url if s.url else "(none)"
    raw = ask(f"  Ticket URL [{cur_url}] (Enter=keep, - to clear): ")
    if raw == "-":
        s.url = ""
    elif raw:
        s.url = raw

    write_shows(shows)
    log.append(f"Update show: {s.name}")
    print(f"Updated: {s.name}.")


def commit_push(log):
    """Commit & push. Returns True on a successful push (so the app can quit)."""
    shows_changed = git_has_changes()
    if not shows_changed:
        print("\nNothing to commit — index.html has no uncommitted changes.")
        return False
    msg = "; ".join(log) if log else "Update tour dates"
    print(f'\nCommit message: "{msg}"')
    if not confirm("Commit and push?"):
        print("Cancelled.")
        return False
    steps = [
        ["git", "add", "index.html"],
        ["git", "commit", "-m", msg],
        ["git", "push"],
    ]
    for cmd in steps:
        r = subprocess.run(cmd, cwd=INDEX.parent, capture_output=True, text=True)
        out = (r.stdout + r.stderr).strip()
        if out:
            print(out)
        if r.returncode != 0:
            print(f"\n'{' '.join(cmd)}' failed — stopping.")
            return False
    log.clear()
    print("Pushed.")
    return True


# --- helpers ---------------------------------------------------------------


def ask(text):
    try:
        return input(text).strip()
    except EOFError:
        return ""


def confirm(text):
    return ask(f"{text} [y/N]: ").lower() in ("y", "yes")


def parse_mmddyy(raw):
    """MM-DD-YY -> ISO 'YYYY-MM-DD' (year assumed 20YY), or None if invalid."""
    m = re.fullmatch(r"\s*(\d{1,2})-(\d{1,2})-(\d{2})\s*", raw)
    if not m:
        return None
    month, day, yy = (int(g) for g in m.groups())
    try:
        return date(2000 + yy, month, day).strftime("%Y-%m-%d")
    except ValueError:
        return None


def human_date(iso):
    """ISO 'YYYY-MM-DD' -> 'MM-DD-YY' for display; '' if no date."""
    if not iso:
        return ""
    d = datetime.strptime(iso, "%Y-%m-%d").date()
    return d.strftime("%m-%d-%y")


def prompt_date():
    """Prompt for MM-DD-YY; the year's first two digits are assumed to be 20.

    Stored internally as ISO (YYYY-MM-DD) for sorting and past-detection.
    """
    while True:
        raw = ask("  Date (MM-DD-YY): ")
        if not raw:
            return None
        iso = parse_mmddyy(raw)
        if iso:
            return iso
        print("    Please use MM-DD-YY (e.g. 08-15-26).")


def git_has_changes():
    r = subprocess.run(
        ["git", "status", "--porcelain", "index.html"],
        cwd=INDEX.parent, capture_output=True, text=True,
    )
    return bool(r.stdout.strip())


# --- main loop -------------------------------------------------------------


def main():
    if not INDEX.exists():
        raise SystemExit(f"index.html not found at {INDEX}")

    log = []  # human-readable descriptions of changes made this session
    while True:
        print_shows(load_shows())
        print(
            "\n  [1] Remove past shows"
            "\n  [2] Add a show"
            "\n  [3] Update a show"
            "\n  [4] Commit & push"
            "\n  [5] Quit"
        )
        choice = ask("Choose: ")
        if choice == "1":
            remove_past(log)
        elif choice == "2":
            add_show(log)
        elif choice == "3":
            update_show(log)
        elif choice == "4":
            if commit_push(log):
                print("Bye.")
                return
        elif choice in ("5", "q", ""):
            if git_has_changes():
                print("\nHeads up: index.html has uncommitted changes "
                      "you haven't pushed (option 4).")
            print("Bye.")
            return
        else:
            print("Please choose 1, 2, 3, 4, or 5.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nBye.")
        sys.exit(0)
