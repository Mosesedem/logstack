package models

// LogAnalyticsResponse holds aggregated analytics data for a project's logs.
type LogAnalyticsResponse struct {
	TotalCount   int64              `json:"totalCount"`
	CountByLevel map[string]int64   `json:"countByLevel"`
	ErrorRate    float64            `json:"errorRate"` // percentage 0-100
	TimeSeries   []TimeSeriesBucket `json:"timeSeries"`
}

// TimeSeriesBucket represents a single hourly bucket in the log time series.
type TimeSeriesBucket struct {
	Timestamp string `json:"timestamp"` // RFC3339, hourly
	Count     int64  `json:"count"`
}
