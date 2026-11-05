package questops

import (
	"errors"
	"testing"
	"time"
)

func TestPlanUsesEarliestFreeSlotWithoutMovingExisting(t *testing.T) {
	loc := time.FixedZone("WIB", 7*3600)
	now := time.Date(2026, 11, 2, 8, 45, 0, 0, loc)
	existing := Slot{Start: now.Add(15*time.Minute), End: now.Add(75*time.Minute)}
	slot, err := Plan(now, now.Add(24*time.Hour), 60,
		Capacity{DailyMinutes: 480, StartMinute: 540, Workdays: "12345"}, []Slot{existing}, loc)
	if err != nil {
		t.Fatal(err)
	}
	if !slot.Start.Equal(existing.End) || overlap(slot, existing) {
		t.Fatalf("allocated overlapping slot: %+v", slot)
	}
}

func TestPlanRejectsUnconfiguredOrImpossibleWork(t *testing.T) {
	loc := time.FixedZone("WIB", 7*3600)
	now := time.Date(2026, 11, 2, 10, 0, 0, 0, loc)
	_, err := Plan(now, now.Add(24*time.Hour), 30, Capacity{}, nil, loc)
	if !errors.Is(err, ErrNoCapacity) {
		t.Fatalf("unconfigured capacity accepted: %v", err)
	}
	_, err = Plan(now, now.Add(5*time.Minute), 60,
		Capacity{DailyMinutes: 480, StartMinute: 540, Workdays: "12345"}, nil, loc)
	if !errors.Is(err, ErrNoSlot) {
		t.Fatalf("impossible deadline accepted: %v", err)
	}
}

func TestPlanSkipsNonWorkingDaysAndCapsWorkday(t *testing.T) {
	loc := time.FixedZone("WIB", 7*3600)
	friday := time.Date(2026, 11, 6, 17, 0, 0, 0, loc)
	slot, err := Plan(friday, friday.Add(96*time.Hour), 120,
		Capacity{DailyMinutes: 480, StartMinute: 540, Workdays: "12345"}, nil, loc)
	if err != nil {
		t.Fatal(err)
	}
	if slot.Start.Weekday() != time.Monday || slot.Start.Hour() != 9 {
		t.Fatalf("expected Monday 09:00, got %s", slot.Start)
	}
}
