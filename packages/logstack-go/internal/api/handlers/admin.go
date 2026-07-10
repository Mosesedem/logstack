package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

// ---------- Stats ----------

func (h *AdminHandler) GetSystemStats(c *gin.Context) {
	var stats struct {
		TotalUsers           int64 `json:"totalUsers"`
		TotalProjects        int64 `json:"totalProjects"`
		TotalLogs            int64 `json:"totalLogs"`
		ActiveSubscriptions  int64 `json:"activeSubscriptions"`
		AdminUsers           int64 `json:"adminUsers"`
	}

	h.db.Model(&models.User{}).Count(&stats.TotalUsers)
	h.db.Model(&models.Project{}).Count(&stats.TotalProjects)
	h.db.Model(&models.Log{}).Count(&stats.TotalLogs)
	h.db.Model(&models.User{}).Where("role = ?", "admin").Count(&stats.AdminUsers)
	h.db.Model(&models.Subscription{}).
		Where("status = ?", "active").
		Where("tier <> ?", "free").
		Count(&stats.ActiveSubscriptions)

	c.JSON(http.StatusOK, stats)
}

// ---------- Users ----------

type adminCreateUserRequest struct {
	Email         string `json:"email" binding:"required,email"`
	Name          string `json:"name" binding:"required,min=1,max=100"`
	Password      string `json:"password" binding:"required,min=8,max=72"`
	Role          string `json:"role" binding:"omitempty,oneof=user admin"`
	EmailVerified *bool  `json:"emailVerified"`
}

type adminUpdateUserRequest struct {
	Email         *string `json:"email" binding:"omitempty,email"`
	Name          *string `json:"name" binding:"omitempty,min=1,max=100"`
	Role          *string `json:"role" binding:"omitempty,oneof=user admin"`
	EmailVerified *bool   `json:"emailVerified"`
	Password      *string `json:"password" binding:"omitempty,min=8,max=72"`
}

// GetUsers handles GET /v1/admin/users
func (h *AdminHandler) GetUsers(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	search := strings.TrimSpace(c.Query("search"))
	role := strings.TrimSpace(c.Query("role"))

	query := h.db.Model(&models.User{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("email ILIKE ? OR name ILIKE ?", like, like)
	}
	if role == "admin" || role == "user" {
		query = query.Where("role = ?", role)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to count users",
		})
		return
	}

	var users []models.User
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to fetch users",
		})
		return
	}

	responses := make([]models.UserResponse, len(users))
	for i := range users {
		responses[i] = users[i].ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{
		"users":  responses,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetUser handles GET /v1/admin/users/:id
func (h *AdminHandler) GetUser(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "Invalid user id",
		})
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "USER_NOT_FOUND",
			Message: "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, user.ToResponse())
}

// CreateUser handles POST /v1/admin/users
func (h *AdminHandler) CreateUser(c *gin.Context) {
	var req adminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	name := strings.TrimSpace(req.Name)
	role := req.Role
	if role == "" {
		role = "user"
	}

	var existing models.User
	if err := h.db.Where("email = ?", email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, ErrorResponse{
			Code:    "EMAIL_EXISTS",
			Message: "An account with this email already exists",
		})
		return
	}

	user := models.User{
		Email:         email,
		Name:          name,
		Role:          role,
		EmailVerified: false,
	}
	if req.EmailVerified != nil {
		user.EmailVerified = *req.EmailVerified
	}
	if err := user.SetPassword(req.Password); err != nil {
		slog.Error("Admin create user: password hash failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create user",
		})
		return
	}

	if err := h.db.Create(&user).Error; err != nil {
		slog.Error("Admin create user failed", "error", err, "email", email)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create user",
		})
		return
	}

	actorID, _ := c.Get("userID")
	slog.Info("Admin created user", "actorID", actorID, "userID", user.ID, "email", email, "role", role)
	c.JSON(http.StatusCreated, user.ToResponse())
}

// UpdateUser handles PUT /v1/admin/users/:id
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "Invalid user id",
		})
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "USER_NOT_FOUND",
			Message: "User not found",
		})
		return
	}

	var req adminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	actorID, _ := c.Get("userID")
	actorUint, _ := actorID.(uint)

	if req.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*req.Email))
		var existing models.User
		if err := h.db.Where("email = ? AND id != ?", email, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, ErrorResponse{
				Code:    "EMAIL_EXISTS",
				Message: "Email is already in use by another account",
			})
			return
		}
		user.Email = email
	}
	if req.Name != nil {
		user.Name = strings.TrimSpace(*req.Name)
	}
	if req.Role != nil {
		// Prevent demoting yourself if you are the last admin
		if user.Role == "admin" && *req.Role != "admin" {
			if actorUint == user.ID {
				if !h.hasOtherAdmins(user.ID) {
					c.JSON(http.StatusBadRequest, ErrorResponse{
						Code:    "LAST_ADMIN",
						Message: "Cannot demote the last admin account",
					})
					return
				}
			}
		}
		user.Role = *req.Role
	}
	if req.EmailVerified != nil {
		user.EmailVerified = *req.EmailVerified
	}
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		if err := user.SetPassword(*req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to update password",
			})
			return
		}
	}

	if err := h.db.Save(&user).Error; err != nil {
		slog.Error("Admin update user failed", "error", err, "userID", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update user",
		})
		return
	}

	slog.Info("Admin updated user", "actorID", actorID, "userID", user.ID)
	c.JSON(http.StatusOK, user.ToResponse())
}

// DeleteUser handles DELETE /v1/admin/users/:id
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "Invalid user id",
		})
		return
	}

	actorID, _ := c.Get("userID")
	actorUint, _ := actorID.(uint)
	if actorUint == id {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "CANNOT_DELETE_SELF",
			Message: "You cannot delete your own account from the admin panel",
		})
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "USER_NOT_FOUND",
			Message: "User not found",
		})
		return
	}

	if user.Role == "admin" && !h.hasOtherAdmins(user.ID) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "LAST_ADMIN",
			Message: "Cannot delete the last admin account",
		})
		return
	}

	// Cascade-safe delete: remove owned projects first, then user-scoped rows.
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var projects []models.Project
		if err := tx.Where("owner_id = ?", id).Find(&projects).Error; err != nil {
			return err
		}
		for _, p := range projects {
			if err := adminDeleteProject(tx, p.ID); err != nil {
				return err
			}
		}

		if err := tx.Where("user_id = ?", id).Delete(&models.OrganizationMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", id).Delete(&models.PushToken{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", id).Delete(&models.Subscription{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", id).Delete(&models.Invoice{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", id).Delete(&models.MobileRefreshToken{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", id).Delete(&models.LogEscalation{}).Error; err != nil {
			return err
		}

		result := tx.Delete(&models.User{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Code:    "USER_NOT_FOUND",
				Message: "User not found",
			})
			return
		}
		slog.Error("Admin delete user failed", "error", err, "userID", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to delete user",
		})
		return
	}

	slog.Info("Admin deleted user", "actorID", actorID, "userID", id)
	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

func (h *AdminHandler) hasOtherAdmins(excludeID uint) bool {
	var count int64
	h.db.Model(&models.User{}).
		Where("role = ? AND id <> ?", "admin", excludeID).
		Count(&count)
	return count > 0
}

// ---------- Projects ----------

type adminUpdateProjectRequest struct {
	Name        *string `json:"name" binding:"omitempty,min=1,max=100"`
	Environment *string `json:"environment" binding:"omitempty,oneof=development staging production"`
	OwnerID     *uint   `json:"ownerId"`
}

// GetProjects handles GET /v1/admin/projects
func (h *AdminHandler) GetProjects(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	search := strings.TrimSpace(c.Query("search"))

	query := h.db.Model(&models.Project{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name ILIKE ?", like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to count projects",
		})
		return
	}

	var projects []models.Project
	if err := query.Preload("Owner").Order("created_at DESC").Limit(limit).Offset(offset).Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to fetch projects",
		})
		return
	}

	type projectAdminRow struct {
		models.ProjectResponse
		Owner *models.UserResponse `json:"owner,omitempty"`
	}

	rows := make([]projectAdminRow, len(projects))
	for i, p := range projects {
		rows[i] = projectAdminRow{ProjectResponse: p.ToResponse()}
		if p.Owner.ID != 0 {
			owner := p.Owner.ToResponse()
			rows[i].Owner = &owner
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"projects": rows,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// GetProject handles GET /v1/admin/projects/:id
func (h *AdminHandler) GetProject(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	var project models.Project
	if err := h.db.Preload("Owner").First(&project, "id = ?", projectID).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	resp := gin.H{
		"id":          project.ID,
		"name":        project.Name,
		"ownerId":     project.OwnerID,
		"environment": project.Environment,
		"archivedAt":  project.ArchivedAt,
		"createdAt":   project.CreatedAt,
	}
	if project.Owner.ID != 0 {
		resp["owner"] = project.Owner.ToResponse()
	}
	c.JSON(http.StatusOK, resp)
}

// UpdateProject handles PUT /v1/admin/projects/:id
func (h *AdminHandler) UpdateProject(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	var project models.Project
	if err := h.db.First(&project, "id = ?", projectID).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	var req adminUpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	if req.Name != nil {
		project.Name = strings.TrimSpace(*req.Name)
	}
	if req.Environment != nil {
		project.Environment = *req.Environment
	}
	if req.OwnerID != nil {
		var owner models.User
		if err := h.db.First(&owner, *req.OwnerID).Error; err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Code:    "OWNER_NOT_FOUND",
				Message: "New owner does not exist",
			})
			return
		}
		project.OwnerID = *req.OwnerID
	}

	if err := h.db.Save(&project).Error; err != nil {
		slog.Error("Admin update project failed", "error", err, "projectID", projectID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update project",
		})
		return
	}

	actorID, _ := c.Get("userID")
	slog.Info("Admin updated project", "actorID", actorID, "projectID", projectID)
	c.JSON(http.StatusOK, project.ToResponse())
}

// DeleteProject handles DELETE /v1/admin/projects/:id
func (h *AdminHandler) DeleteProject(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		return adminDeleteProject(tx, projectID)
	}); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Code:    "PROJECT_NOT_FOUND",
				Message: "Project not found",
			})
			return
		}
		slog.Error("Admin delete project failed", "error", err, "projectID", projectID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to delete project",
		})
		return
	}

	actorID, _ := c.Get("userID")
	slog.Info("Admin deleted project", "actorID", actorID, "projectID", projectID)
	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

// adminDeleteProject removes a project and child rows without owner scoping.
func adminDeleteProject(tx *gorm.DB, projectID uuid.UUID) error {
	var project models.Project
	if err := tx.Where("id = ?", projectID).First(&project).Error; err != nil {
		return err
	}

	if err := tx.Where(
		"alert_rule_id IN (SELECT id FROM alert_rules WHERE project_id = ?)",
		projectID,
	).Delete(&models.AlertHistory{}).Error; err != nil {
		return err
	}
	if err := tx.Where("project_id = ?", projectID).Delete(&models.AlertRule{}).Error; err != nil {
		return err
	}
	if err := tx.Where("project_id = ?", projectID).Delete(&models.Log{}).Error; err != nil {
		return err
	}
	if err := tx.Where("project_id = ?", projectID).Delete(&models.UsageLog{}).Error; err != nil {
		return err
	}
	if err := tx.Where("project_id = ?", projectID).Delete(&models.LogEscalation{}).Error; err != nil {
		return err
	}

	result := tx.Where("id = ?", projectID).Delete(&models.Project{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ---------- helpers ----------

func parseUintParam(s string) (uint, error) {
	n, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(n), nil
}

func parseLimit(raw string, def, max int) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

func parseOffset(raw string) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return 0
	}
	return n
}
