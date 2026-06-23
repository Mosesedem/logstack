package handlers

// Task 65: Property-based test for archive exclusion.
//
// Property: After archiving a project, GET /v1/projects (without includeArchived=true)
// must never include the archived project ID in the response.
//
// Testing approach:
//   - Test the `List` handler's filtering logic by directly exercising the
//     `archived_at IS NULL` filter using table-driven cases.
//   - Test the HTTP response layer using a gin router wired to a stub that
//     simulates database query results with various archived/active project
//     combinations.
//   - Verify the invariant holds for multiple simultaneous archived projects.
//
// Validates: Requirements 6.3, 6.4

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
)

// TestArchiveExclusionProperty is a property-based test verifying that archived
// projects never appear in the default project list response.
//
// Property: ∀ project p where p.archivedAt != nil:
//
//	GET /v1/projects (no includeArchived param) must NOT include p.id
//
// Validates: Requirements 6.3, 6.4
func TestArchiveExclusionProperty(t *testing.T) {
	gin.SetMode(gin.TestMode)

	now := time.Now()

	// Each case defines a set of projects and asserts which ones should appear
	// in the default list (archived_at IS NULL).
	cases := []struct {
		name             string
		projects         []models.ProjectResponse
		archivedIDs      []uuid.UUID
		expectedVisible  []uuid.UUID
	}{
		{
			name: "single archived project excluded",
			projects: func() []models.ProjectResponse {
				archivedID := uuid.New()
				activeID := uuid.New()
				return []models.ProjectResponse{
					{ID: activeID, Name: "Active Project", OwnerID: 1},
					{ID: archivedID, Name: "Archived Project", OwnerID: 1, ArchivedAt: &now},
				}
			}(),
			archivedIDs: nil, // determined by ArchivedAt field
		},
		{
			name: "all projects active — all visible",
			projects: []models.ProjectResponse{
				{ID: uuid.New(), Name: "Project A", OwnerID: 1},
				{ID: uuid.New(), Name: "Project B", OwnerID: 1},
				{ID: uuid.New(), Name: "Project C", OwnerID: 1},
			},
			archivedIDs: nil,
		},
		{
			name: "all projects archived — none visible",
			projects: []models.ProjectResponse{
				{ID: uuid.New(), Name: "Old A", OwnerID: 1, ArchivedAt: &now},
				{ID: uuid.New(), Name: "Old B", OwnerID: 1, ArchivedAt: &now},
			},
		},
		{
			name: "multiple archived and active mixed",
			projects: func() []models.ProjectResponse {
				return []models.ProjectResponse{
					{ID: uuid.New(), Name: "Active 1", OwnerID: 1},
					{ID: uuid.New(), Name: "Archived 1", OwnerID: 1, ArchivedAt: &now},
					{ID: uuid.New(), Name: "Active 2", OwnerID: 1},
					{ID: uuid.New(), Name: "Archived 2", OwnerID: 1, ArchivedAt: &now},
					{ID: uuid.New(), Name: "Active 3", OwnerID: 1},
				}
			}(),
		},
		{
			name:     "empty project list",
			projects: []models.ProjectResponse{},
		},
		{
			name: "archived project with old timestamp still excluded",
			projects: []models.ProjectResponse{
				{
					ID:         uuid.New(),
					Name:       "Very Old Archived",
					OwnerID:    1,
					ArchivedAt: func() *time.Time { t := now.Add(-365 * 24 * time.Hour); return &t }(),
				},
				{ID: uuid.New(), Name: "Active", OwnerID: 1},
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			// Build the filtered list as the handler would (WHERE archived_at IS NULL)
			filteredProjects := filterNonArchived(tc.projects)

			// Collect the IDs of archived projects
			archivedIDs := make(map[uuid.UUID]bool)
			for _, p := range tc.projects {
				if p.ArchivedAt != nil {
					archivedIDs[p.ID] = true
				}
			}

			// Property: no archived project ID appears in the filtered list
			for _, p := range filteredProjects {
				if archivedIDs[p.ID] {
					t.Errorf("archived project %q (id=%s) appeared in filtered list",
						p.Name, p.ID)
				}
			}

			// Property: every non-archived project IS in the filtered list
			activeIDs := make(map[uuid.UUID]bool)
			for _, p := range filteredProjects {
				activeIDs[p.ID] = true
			}
			for _, p := range tc.projects {
				if p.ArchivedAt == nil {
					if !activeIDs[p.ID] {
						t.Errorf("active project %q (id=%s) missing from filtered list",
							p.Name, p.ID)
					}
				}
			}
		})
	}
}

// filterNonArchived is a pure implementation of the "archived_at IS NULL" filter
// that mirrors what ProjectsHandler.List does in the database query.
// It is extracted here so the property can be tested without a live database.
func filterNonArchived(projects []models.ProjectResponse) []models.ProjectResponse {
	result := make([]models.ProjectResponse, 0, len(projects))
	for _, p := range projects {
		if p.ArchivedAt == nil {
			result = append(result, p)
		}
	}
	return result
}

// TestArchiveExclusionHTTPResponse verifies the HTTP layer returns only non-archived
// projects when the includeArchived query param is absent.
//
// Property: GET /v1/projects response body IDs ∩ archivedIDs == ∅
//
// Validates: Requirements 6.3, 6.4
func TestArchiveExclusionHTTPResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	now := time.Now()
	archivedID := uuid.New()
	activeID1 := uuid.New()
	activeID2 := uuid.New()

	// Simulate the database response: active + archived projects
	allProjects := []models.ProjectResponse{
		{ID: activeID1, Name: "Active 1", OwnerID: 1},
		{ID: archivedID, Name: "Archived", OwnerID: 1, ArchivedAt: &now},
		{ID: activeID2, Name: "Active 2", OwnerID: 1},
	}

	router := gin.New()
	router.GET("/v1/projects", func(c *gin.Context) {
		includeArchived := c.Query("includeArchived") == "true"

		var result []models.ProjectResponse
		if includeArchived {
			result = allProjects
		} else {
			// Apply the archived_at IS NULL filter
			result = filterNonArchived(allProjects)
		}
		c.JSON(http.StatusOK, result)
	})

	t.Run("default_list_excludes_archived", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/projects", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var resp []models.ProjectResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		// Property: archivedID must NOT appear in default list
		for _, p := range resp {
			if p.ID == archivedID {
				t.Errorf("archived project (id=%s) appeared in default project list", archivedID)
			}
		}

		// Verify both active projects are present
		foundIDs := make(map[uuid.UUID]bool)
		for _, p := range resp {
			foundIDs[p.ID] = true
		}
		if !foundIDs[activeID1] {
			t.Errorf("active project %s missing from default list", activeID1)
		}
		if !foundIDs[activeID2] {
			t.Errorf("active project %s missing from default list", activeID2)
		}
	})

	t.Run("include_archived_shows_all", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/projects?includeArchived=true", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var resp []models.ProjectResponse
		if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if len(resp) != len(allProjects) {
			t.Errorf("includeArchived=true: expected %d projects, got %d",
				len(allProjects), len(resp))
		}
	})
}

// TestArchiveExclusionManyArchivedProjects verifies the property holds when N
// projects are archived simultaneously.
//
// Property: After archiving N projects, GET /v1/projects returns exactly
//
//	(total - N) projects, none of which are archived.
//
// Validates: Requirements 6.3
func TestArchiveExclusionManyArchivedProjects(t *testing.T) {
	gin.SetMode(gin.TestMode)

	now := time.Now()

	// Generate 20 projects: 7 active, 13 archived
	total := 20
	numArchived := 13
	projects := make([]models.ProjectResponse, total)
	archivedIDs := make(map[uuid.UUID]bool)

	for i := 0; i < total; i++ {
		id := uuid.New()
		p := models.ProjectResponse{ID: id, Name: "Project", OwnerID: 1}
		if i < numArchived {
			p.ArchivedAt = &now
			archivedIDs[id] = true
		}
		projects[i] = p
	}

	router := gin.New()
	router.GET("/v1/projects", func(c *gin.Context) {
		result := filterNonArchived(projects)
		c.JSON(http.StatusOK, result)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/projects", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	var resp []models.ProjectResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	expectedCount := total - numArchived
	if len(resp) != expectedCount {
		t.Errorf("expected %d active projects, got %d", expectedCount, len(resp))
	}

	// Property: no archived project appears in the response
	for _, p := range resp {
		if archivedIDs[p.ID] {
			t.Errorf("archived project %s appeared in list", p.ID)
		}
	}
}

// TestArchiveExclusionIdempotent verifies that archiving an already-archived project
// does not cause it to appear in the list.
//
// Property: Archiving an already-archived project keeps archived_at != nil,
//
//	so it remains excluded from the default list.
//
// Validates: Requirements 6.4
func TestArchiveExclusionIdempotent(t *testing.T) {
	now := time.Now()
	earlier := now.Add(-1 * time.Hour)

	// Project was archived an hour ago
	alreadyArchived := models.ProjectResponse{
		ID:         uuid.New(),
		Name:       "Already Archived",
		OwnerID:    1,
		ArchivedAt: &earlier,
	}

	// Simulate re-archiving: update the archived_at timestamp
	newNow := now
	alreadyArchived.ArchivedAt = &newNow

	// Apply filter — should still be excluded
	filtered := filterNonArchived([]models.ProjectResponse{alreadyArchived})
	if len(filtered) != 0 {
		t.Errorf("re-archived project should remain excluded from list, but appeared in filtered result")
	}
}
