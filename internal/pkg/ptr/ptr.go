package ptr

import (
	"time"
)

func String(s string) *string {
	return &s
}

func Int(i int) *int {
	return &i
}

func Int64(i int64) *int64 {
	return &i
}

func Int32(i int32) *int32 {
	return &i
}

func Bool(b bool) *bool {
	return &b
}

func Time(t time.Time) *time.Time {
	return &t
}

func Float64(f float64) *float64 {
	return &f
}

func Float32(f float32) *float32 {
	return &f
}

func Pointer[T any](t T) *T {
	return &t
}
