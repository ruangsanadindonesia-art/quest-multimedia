package questops

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrNoCapacity = errors.New("kapasitas atau kalender kerja belum dikonfigurasi")
	ErrNoSlot = errors.New("tidak ada slot aman sebelum deadline")
)

// Capacity is explicitly configured for each PIC; empty values never silently grant free time.
// Workdays uses ISO weekdays: 1=Monday through 7=Sunday.
type Capacity struct {
	DailyMinutes int
	StartMinute int
	Workdays string
}

type Slot struct {
	Start time.Time
	End time.Time
}

func overlap(a, b Slot) bool {
	return a.Start.Before(b.End) && b.Start.Before(a.End)
}

func ceil15(t time.Time) time.Time {
	t = t.Truncate(time.Minute)
	if t.Minute()%15 == 0 {
		return t
	}
	return t.Add(time.Duration(15-t.Minute()%15) * time.Minute)
}

// Plan finds the earliest non-overlapping working-hour slot, never moving a
// pre-existing allocation. A long job must be split into per-day tasks.
// Inputs and existing allocations are interpreted in the same absolute timeline.
func Plan(now, due time.Time, effort int, cap Capacity, occupied []Slot, loc *time.Location) (Slot, error) {
	if loc == nil {
		loc = time.UTC
	}
	if effort < 15 || effort > 720 || cap.DailyMinutes < 15 ||
		cap.DailyMinutes > 720 || effort > cap.DailyMinutes ||
		cap.StartMinute < 0 || cap.StartMinute+cap.DailyMinutes > 1440 ||
		cap.Workdays == "" {
		return Slot{}, ErrNoCapacity
	}
	for _, r := range cap.Workdays {
		if r < '1' || r > '7' {
			return Slot{}, ErrNoCapacity
		}
	}
	if !due.After(now) || due.After(now.AddDate(1, 0, 0)) {
		return Slot{}, ErrNoSlot
	}
	localNow := now.In(loc)
	day := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc)
	for d := 0; d <= 366 && day.Before(due); d++ {
		weekday := int(day.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		if !strings.ContainsRune(cap.Workdays, rune('0'+weekday)) {
			day = day.AddDate(0, 0, 1)
			continue
		}
		start := day.Add(time.Duration(cap.StartMinute) * time.Minute)
		end := start.Add(time.Duration(cap.DailyMinutes) * time.Minute)
		candidate := start
		if now.After(candidate) {
			candidate = ceil15(now.In(loc))
		}
		for !candidate.Add(time.Duration(effort)*time.Minute).After(end) &&
			!candidate.Add(time.Duration(effort)*time.Minute).After(due) {
			proposed := Slot{Start: candidate, End: candidate.Add(time.Duration(effort) * time.Minute)}
			conflict := false
			for _, booked := range occupied {
				if overlap(proposed, booked) {
					if booked.End.After(candidate) {
						candidate = ceil15(booked.End.In(loc))
					} else {
						candidate = candidate.Add(15*time.Minute)
					}
					conflict = true
					break
				}
			}
			if !conflict {
				return proposed, nil
			}
		}
		day = day.AddDate(0, 0, 1)
	}
	return Slot{}, ErrNoSlot
}
