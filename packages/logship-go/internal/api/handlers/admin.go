package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

func (h *AdminHandler) GetSystemStats(c *gin.Context) {
	var stats struct {
		TotalUsers    int64 `json:"totalUsers"`
		TotalProjects int64 `json:"totalProjects"`
		TotalLogs     int64 `json:"totalLogs"`
	}

	h.db.Model(&models.User{}).Count(&stats.TotalUsers)
	h.db.Model(&models.Project{}).Count(&stats.TotalProjects)
	h.db.Model(&models.Log{}).Count(&stats.TotalLogs)

	c.JSON(http.StatusOK, stats)
}

func (h *AdminHandler) GetUsers(c *gin.Context) {
	var users []models.User
	if err := h.db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *AdminHandler) GetProjects(c *gin.Context) {
	var projects []models.Project
	if err := h.db.Preload("Owner").Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch projects"})
		return
	}
	c.JSON(http.StatusOK, projects)
}
